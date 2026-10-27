"""What a managed session's / menu and model picker offer, from Claude Code's own list (get_server_info).

Claude Code lists every command a session can run without its terminal screen. The design system's
CommandMenu also keeps the terminal-only ones on screen, disabled, with the reason; and Constellation draws
its own version of a few commands (pickers instead of text), which it adds when Claude Code doesn't list them.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .claude import files
from .protocol import CommandInfo, ModelInfo, SessionOptions

# Commands that only make sense on Claude Code's terminal screen (design system: CommandMenu).
TERMINAL_ONLY = {
    "theme": "Change the color theme",
    "terminal-setup": "Set up your terminal's keys",
    "login": "Sign in to your Anthropic account",
    "color": "Set the prompt bar color",
}
# Commands Claude Code doesn't list for the SDK, that Constellation draws as pickers.
OWN = {
    "resume": ("Resume a past session", ""),
    "rewind": ("Rewind the conversation or the files to a prompt", ""),
    "fork": ("Continue this conversation in a new session", "[name]"),
}
SOURCE_NOTE = re.compile(r"\s*\(([^()]*)\)\s*$")  # "… (user)", "… (project)", "… (claude.ai sync)"


def _source(command: dict[str, Any], cwd: str, claude_dir: Path) -> str:
    name = command.get("name", "")
    if command.get("builtin"):
        return "built-in"
    if name.startswith("mcp__") or "(MCP)" in command.get("description", ""):
        return "mcp"
    if ":" in name:
        return "plugin"
    folders = (Path(cwd) / ".claude" / "commands", claude_dir / "commands")
    if any((folder / f"{name}.md").exists() for folder in folders):
        return "command"
    return "skill"


def commands(info: dict[str, Any], cwd: str, claude_dir: Path = files.CLAUDE_DIR) -> list[CommandInfo]:
    listed: dict[str, CommandInfo] = {}
    for command in info.get("commands") or []:
        name = command.get("name")
        if not isinstance(name, str) or not name or name.startswith("__"):
            continue
        description = SOURCE_NOTE.sub("", command.get("description") or "")
        listed[name] = CommandInfo(
            name=name,
            description=description.split(". ")[0][:160],
            argument_hint=command.get("argumentHint") or "",
            source=_source(command, cwd, claude_dir),  # type: ignore[arg-type]
            aliases=[a for a in command.get("aliases") or [] if isinstance(a, str)],
            unavailable="terminal-only" if name in TERMINAL_ONLY else None,
        )
    for name, (description, hint) in OWN.items():
        listed.setdefault(name, CommandInfo(name=name, description=description, argument_hint=hint, source="built-in"))
    for name, description in TERMINAL_ONLY.items():
        listed.setdefault(
            name, CommandInfo(name=name, description=description, source="built-in", unavailable="terminal-only")
        )
    return sorted(listed.values(), key=lambda c: c.name)


def models(info_models: list[dict[str, Any]]) -> list[ModelInfo]:
    found = []
    for model in info_models:
        value = model.get("value")
        if not isinstance(value, str):
            continue
        found.append(
            ModelInfo(
                value=value,
                name=model.get("displayName") or value,
                description=model.get("description") or "",
                model=model.get("resolvedModel"),
                efforts=[e for e in model.get("supportedEffortLevels") or [] if isinstance(e, str)],
            )
        )
    return found


# Claude Code's aliases, for the launcher before any session has reported the real list.
FALLBACK_MODELS = [
    ModelInfo(value=alias, name=alias, efforts=["low", "medium", "high", "xhigh", "max"])
    for alias in ("default", "opus", "sonnet", "haiku", "fable")
]


def session_options(
    info: dict[str, Any], cwd: str, model: str | None, effort: str | None, claude_dir: Path = files.CLAUDE_DIR
) -> SessionOptions:
    return SessionOptions(
        commands=commands(info, cwd, claude_dir), models=models(info.get("models") or []), model=model, effort=effort
    )
