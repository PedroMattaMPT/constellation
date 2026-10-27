"""What a session still in its terminal is asking, reported by two Claude Code hooks (roadmap 3.12).

The transcript has a question or permission prompt only once it's answered (docs/data-sources.md). Two
hooks see it while it's open: `PermissionRequest`, and `PreToolUse` limited to `AskUserQuestion`. Both run one
small script that posts the hook's input to the Constellation server and exits at once. If the server isn't
running, the script finds no address file and does nothing. It never prints and never decides, so the
question still opens in the terminal and is answered there.

The hooks go in your user settings, so they run in every session. Installing and removing them is an
explicit action in Constellation; nothing here runs on its own.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .claude import files
from .protocol import HookStatus, PendingRequest

SCRIPT_NAME = "constellation-hook.sh"
QUESTION_TOOL = "AskUserQuestion"
FORGET_AFTER_S = 3.0  # a report whose session isn't waiting this long after was answered (or never asked)
KEEP_S = 30 * 60  # reports nobody looked at (a session that ended, a managed one) go after this
TIMEOUT_S = 5
SCRIPT = """#!/bin/sh
# Constellation (https://github.com/PedroMattaMPT/constellation): tells the Constellation server what this
# session is asking, so it can show it. Report only: it prints nothing, decides nothing and always exits 0.
# If Constellation isn't running there is no address file and it stops here. The token stays in its file
# (curl reads the header from it), so it never shows in the process list.
d="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/constellation"
[ -r "$d/server" ] && [ -r "$d/header" ] || exit 0
command -v curl >/dev/null 2>&1 || exit 0
read -r url < "$d/server"
curl -s -o /dev/null --max-time 1 -X POST -H @"$d/header" \\
  -H "Content-Type: application/json" --data-binary @- "$url/api/hooks/report" || true
exit 0
"""


def address_file() -> Path:
    return files.runtime_dir() / "constellation" / "server"


def header_file() -> Path:
    return files.runtime_dir() / "constellation" / "header"


def _private(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as fh:
        fh.write(text)


def publish(url: str, token: str) -> None:
    """Where the hook script finds this server: its address, and the header with its token, readable by you only."""
    _private(header_file(), f"Authorization: Bearer {token}\n")
    _private(address_file(), f"{url}\n")


def unpublish(token: str) -> None:
    """Takes the files away, unless another server has published its own since."""
    try:
        if header_file().read_text().strip() != f"Authorization: Bearer {token}":
            return
    except OSError:
        return
    for path in (address_file(), header_file()):
        with contextlib.suppress(FileNotFoundError):
            path.unlink()


# ── Installing ───────────────────────────────────────────────────────────


def script_path(claude_dir: Path = files.CLAUDE_DIR) -> Path:
    return claude_dir / "hooks" / SCRIPT_NAME


def settings_path(claude_dir: Path = files.CLAUDE_DIR) -> Path:
    return claude_dir / "settings.json"


def _ours(group: Any, command: str) -> bool:
    return isinstance(group, dict) and any(
        isinstance(h, dict) and h.get("command") == command for h in group.get("hooks") or []
    )


def status(claude_dir: Path = files.CLAUDE_DIR) -> HookStatus:
    command = str(script_path(claude_dir))
    try:
        hooks = json.loads(settings_path(claude_dir).read_text()).get("hooks") or {}
    except (OSError, ValueError, AttributeError):
        hooks = {}
    installed = all(
        any(_ours(g, command) for g in hooks.get(event) or []) for event in ("PermissionRequest", "PreToolUse")
    )
    return HookStatus(installed=installed, settings=str(settings_path(claude_dir)), script=command)


def _write_settings(path: Path, settings: dict) -> None:
    """Atomic, so Claude Code never reads half a file. Through a symlink to its target (dotfile managers link
    settings.json), keeping the file's mode."""
    target = path.resolve()
    temporary = target.with_name(target.name + ".constellation-tmp")
    temporary.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + "\n")
    with contextlib.suppress(FileNotFoundError):
        temporary.chmod(target.stat().st_mode & 0o7777)
    temporary.replace(target)


def install(claude_dir: Path = files.CLAUDE_DIR) -> HookStatus:
    script = script_path(claude_dir)
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text(SCRIPT)
    script.chmod(0o755)
    path = settings_path(claude_dir)
    try:
        settings = json.loads(path.read_text()) if path.exists() else {}
    except ValueError as error:
        raise ValueError(f"{path} isn't valid JSON, so it was left alone: {error}") from error
    hooks = settings.setdefault("hooks", {})
    command = str(script)
    entry = {"type": "command", "command": command, "timeout": TIMEOUT_S}
    for event, matcher in (("PermissionRequest", ""), ("PreToolUse", QUESTION_TOOL)):
        groups = hooks.setdefault(event, [])
        if not any(_ours(g, command) for g in groups):
            groups.append({"matcher": matcher, "hooks": [entry]})
    _write_settings(path, settings)
    return status(claude_dir)


def uninstall(claude_dir: Path = files.CLAUDE_DIR) -> HookStatus:
    path = settings_path(claude_dir)
    command = str(script_path(claude_dir))
    try:
        settings = json.loads(path.read_text())
    except (OSError, ValueError):
        settings = None
    if isinstance(settings, dict) and isinstance(settings.get("hooks"), dict):
        hooks = settings["hooks"]
        for event in ("PermissionRequest", "PreToolUse"):
            kept = [g for g in hooks.get(event) or [] if not _ours(g, command)]
            if kept:
                hooks[event] = kept
            else:
                hooks.pop(event, None)
        if not hooks:
            settings.pop("hooks")
        _write_settings(path, settings)
    with contextlib.suppress(FileNotFoundError):
        script_path(claude_dir).unlink()
    return status(claude_dir)


# ── Reports ──────────────────────────────────────────────────────────────


@dataclass
class Report:
    request: PendingRequest
    tool_use_id: str | None
    at: float = field(default_factory=time.time)
    seen_waiting: bool = False


class Reports:
    """What each terminal session is asking right now, by session id, until it's answered."""

    def __init__(self) -> None:
        self.by_session: dict[str, list[Report]] = {}

    def add(self, payload: dict[str, Any]) -> None:
        session_id, tool = payload.get("session_id"), payload.get("tool_name")
        tool_input = payload.get("tool_input")
        if not isinstance(session_id, str) or not isinstance(tool, str) or not isinstance(tool_input, dict):
            return
        tool_use_id = payload.get("tool_use_id") if isinstance(payload.get("tool_use_id"), str) else None
        cutoff = time.time() - KEEP_S
        for sid in [k for k, v in self.by_session.items() if all(r.at < cutoff for r in v)]:
            del self.by_session[sid]
        digest = hashlib.sha1(json.dumps([tool, tool_input], sort_keys=True).encode()).hexdigest()[:12]
        reports = self.by_session.setdefault(session_id, [])
        if any(r.request.id == f"hook-{digest}" for r in reports):  # both hooks fired for one question
            return
        rules = []
        for suggestion in payload.get("permission_suggestions") or []:
            if isinstance(suggestion, dict) and suggestion.get("type") == "addRules":
                for rule in suggestion.get("rules") or []:
                    name, content = rule.get("toolName"), rule.get("ruleContent")
                    if name:
                        rules.append(f"{name}({content})" if content else name)
        kind = "question" if tool == QUESTION_TOOL else "plan" if tool == "ExitPlanMode" else "permission"
        request = PendingRequest(
            id=f"hook-{digest}",
            kind=kind,
            tool=tool,
            input=tool_input,
            rules=rules,
            at=int(time.time() * 1000),
            source="hook",
        )
        reports.append(Report(request=request, tool_use_id=tool_use_id))

    def current(self, session_id: str, waiting: bool, settled: set[str]) -> list[PendingRequest]:
        """The open ones. A report goes once its tool call's result is in the transcript (`settled`), or once the
        session has stopped waiting."""
        reports = self.by_session.get(session_id)
        if not reports:
            return []
        now, kept = time.time(), []
        for report in reports:
            if report.tool_use_id and report.tool_use_id in settled:
                continue
            report.seen_waiting = report.seen_waiting or waiting
            if not waiting and (report.seen_waiting or now - report.at > FORGET_AFTER_S):
                continue
            kept.append(report)
        if kept:
            self.by_session[session_id] = kept
        else:
            del self.by_session[session_id]
        return [r.request for r in kept]
