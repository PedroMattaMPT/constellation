"""A model-written one-liner about what a session is doing, only when you ask for one (s on the map).

It runs one print-mode Claude Code call on a small model with your normal login: no tools, no MCP servers,
none of your settings, and nothing saved (--no-session-persistence). While it runs it has a registry entry
like any session; it runs in its own folder so the map can leave it out.
"""

from __future__ import annotations

import asyncio
import os
import shutil
from pathlib import Path

from .claude import files

MODEL = "haiku"
TIMEOUT_S = 90
LINES = 40
ASK = (
    "Below is the latest activity of a Claude Code session, oldest first. In one line of at most 12 words, "
    "present tense, lowercase, no final period, say what the session is doing now or last did. "
    "Reply with that line only.\n\n"
)


def folder() -> Path:
    """Where the summary call runs. The collector skips registry entries with this cwd."""
    return files.runtime_dir() / "constellation" / "summary"


async def summarize(task: str | None, activity: list[str], cli_path: str | None = None) -> str:
    cli = cli_path or shutil.which("claude")
    if not cli:
        raise RuntimeError("claude isn't on the PATH")
    where = folder()
    where.mkdir(parents=True, exist_ok=True, mode=0o700)
    text = ASK + (f"Its task: {task}\n" if task else "") + "\n".join(activity[-LINES:])
    env = {**os.environ, "TMUX": "", "TMUX_PANE": ""}
    process = await asyncio.create_subprocess_exec(
        cli,
        "-p",
        "--model",
        MODEL,
        "--no-session-persistence",
        "--setting-sources",
        "",
        "--strict-mcp-config",
        "--tools",
        "",
        cwd=where,
        env=env,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(process.communicate(text.encode()), TIMEOUT_S)
    except TimeoutError:
        process.kill()
        await process.wait()
        raise RuntimeError("no summary within 90 s") from None
    if process.returncode != 0:
        last = (err or out).decode(errors="replace").strip().splitlines()[-1:]
        raise RuntimeError(last[0] if last else "it failed")
    line = next((x.strip() for x in out.decode(errors="replace").splitlines() if x.strip()), "")
    return line.rstrip(".")[:160]
