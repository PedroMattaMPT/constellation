"""Claude Code's own files and the process table: where things are and how to read them.

Formats are documented in docs/data-sources.md. Everything here is read-only.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

CLAUDE_DIR = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))


def transcript_path(cwd: str, session_id: str, claude_dir: Path = CLAUDE_DIR) -> Path:
    """Claude Code names a project folder after its cwd, with every non-alphanumeric as '-'."""
    return claude_dir / "projects" / re.sub(r"[^A-Za-z0-9]", "-", cwd) / f"{session_id}.jsonl"


def proc_start(pid: int) -> str | None:
    """Field 22 of /proc/<pid>/stat: start time in clock ticks. Tells a reused pid apart."""
    try:
        return Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[19]
    except (OSError, IndexError):
        return None


def live_registry(claude_dir: Path = CLAUDE_DIR) -> list[dict]:
    """~/.claude/sessions/<pid>.json, keeping only entries whose process is still the same one."""
    sessions = []
    for path in (claude_dir / "sessions").glob("*.json"):
        try:
            entry = json.loads(path.read_text())
        except (OSError, ValueError):
            continue  # being rewritten right now; the next poll gets it
        pid = entry.get("pid")
        if isinstance(pid, int) and entry.get("sessionId") and proc_start(pid) == entry.get("procStart"):
            sessions.append(entry)
    return sessions


def waiting_for() -> dict[str, str]:
    """sessionId -> what it waits on ('permission prompt', 'input needed', ...), from `claude agents --json`."""
    try:
        out = subprocess.run(["claude", "agents", "--json", "--all"], capture_output=True, text=True, timeout=10).stdout
        return {a["sessionId"]: a["waitingFor"] for a in json.loads(out) if a.get("sessionId") and a.get("waitingFor")}
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError):
        return {}


def subagent_meta(transcript: Path, agent_id: str) -> dict | None:
    """<sessionId>/subagents/agent-<id>.meta.json: agentType, description, spawnDepth, requestShape."""
    try:
        return json.loads((transcript.with_suffix("") / "subagents" / f"agent-{agent_id}.meta.json").read_text())
    except (OSError, ValueError):
        return None
