"""Past sessions for the resume picker, through the Agent SDK's session functions (they read the transcripts)."""

from __future__ import annotations

import json
from pathlib import Path

from claude_agent_sdk import get_session_messages, list_sessions, tag_session

from .claude import files
from .claude.transcript import SKIP_PREFIX, first_line
from .protocol import PastPrompt, PastSession, PreviewLine, SessionPreview

PREVIEW_LINES = 8
PROMPTS_TAIL = 8 << 20  # the end of history.jsonl is enough for C-r
PROMPTS_MAX = 200
WHOLE_FILE_MAX = 32 << 20  # bigger transcripts are previewed from their end only
TAIL = 8 << 20


def past(running: dict[str, str], query: str = "", limit: int = 200) -> list[PastSession]:
    """Every session on this machine, newest first. `running` maps the session ids open right now to their node."""
    found = []
    needle = query.lower().strip()
    for info in list_sessions(limit=limit if not needle else None):
        name = info.custom_title or info.summary or info.first_prompt or info.session_id[:8]
        project = Path(info.cwd).name if info.cwd else ""
        if needle and needle not in f"{name} {project} {info.tag or ''} {info.first_prompt or ''}".lower():
            continue
        found.append(
            PastSession(
                session_id=info.session_id,
                name=first_line(name, 80),
                project=project,
                cwd=info.cwd,
                modified=info.last_modified,
                tag=info.tag,
                first_prompt=first_line(info.first_prompt, 120) or None,
                branch=info.git_branch,
                running=running.get(info.session_id),
            )
        )
        if len(found) >= limit:
            break
    return found


def _text(message) -> str:
    content = (message or {}).get("content") if isinstance(message, dict) else None
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def _line(kind: str, message) -> PreviewLine | None:
    text = first_line(_text(message), 160)
    if not text or text.startswith(("<", "[Request interrupted", "This session is being continued")):
        return None
    return PreviewLine(kind="prompt" if kind == "user" else "reply", text=text)


def _tail(path: Path, session_id: str) -> SessionPreview:
    """A huge transcript: the prompts and replies in its last few megabytes, without following branches."""
    with path.open("rb") as fh:
        fh.seek(max(0, path.stat().st_size - TAIL))
        raw = fh.read().split(b"\n")[1:]  # the first line is cut
    lines: list[PreviewLine] = []
    for chunk in raw:
        if not chunk or chunk.startswith(SKIP_PREFIX):
            continue
        try:
            entry = json.loads(chunk)
        except ValueError:
            continue
        if not isinstance(entry, dict) or entry.get("isMeta") or entry.get("isSidechain"):
            continue
        if entry.get("type") in ("user", "assistant") and (line := _line(entry["type"], entry.get("message"))):
            lines.append(line)
    turns = sum(1 for line in lines if line.kind == "prompt")
    return SessionPreview(session_id=session_id, turns=turns, lines=lines[-PREVIEW_LINES:], partial=True)


def preview(session_id: str, cwd: str | None = None) -> SessionPreview:
    """How many turns it had, and its last few prompts and replies, on the branch it ended on."""
    path = files.transcript_path(cwd, session_id) if cwd else None
    if path and path.exists() and path.stat().st_size > WHOLE_FILE_MAX:
        return _tail(path, session_id)
    lines: list[PreviewLine] = []
    for message in get_session_messages(session_id, directory=cwd):
        if line := _line(message.type, message.message):
            lines.append(line)
    turns = sum(1 for line in lines if line.kind == "prompt")
    return SessionPreview(session_id=session_id, turns=turns, lines=lines[-PREVIEW_LINES:])


def tag(session_id: str, value: str | None) -> None:
    tag_session(session_id, value.strip() if value and value.strip() else None)


def prompts(cwd: str, query: str = "", claude_dir: Path = files.CLAUDE_DIR) -> list[PastPrompt]:
    """Your prompts in that folder, newest first, once each: Claude Code's own history (C-r)."""
    path = claude_dir / "history.jsonl"
    try:
        with path.open("rb") as fh:
            fh.seek(max(0, path.stat().st_size - PROMPTS_TAIL))
            raw = fh.read().split(b"\n")
    except OSError:
        return []
    needle = query.lower().strip()
    seen: set[str] = set()
    found: list[PastPrompt] = []
    for chunk in reversed(raw):
        try:
            entry = json.loads(chunk)
        except ValueError:
            continue
        if not isinstance(entry, dict) or entry.get("project") != cwd:
            continue
        text = entry.get("display")
        if not isinstance(text, str) or not text.strip() or text in seen or needle not in text.lower():
            continue
        seen.add(text)
        found.append(PastPrompt(text=text, at=entry.get("timestamp") or 0))
        if len(found) >= PROMPTS_MAX:
            break
    return found
