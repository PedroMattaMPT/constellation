"""Sessions Constellation starts and drives, through the Claude Agent SDK.

Each managed session is one Claude Code process behind one `ClaudeSDKClient`. The manager keeps the
client, the prompts waiting for the current turn to end, and what only the SDK stream knows: whether
a turn is running, the live model and mode, and the questions and permission prompts the session is
waiting on. The conversation itself, the registry entry and the transcript are Claude Code's files,
which the collector reads for managed sessions exactly as for any other (see docs/sdk-check.md).

Managed sessions live as long as the server: closing a browser leaves them running, stopping the
server stops them. Their transcripts stay, so they can be resumed.
"""

from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
import shutil
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookMatcher,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    SystemMessage,
    ToolPermissionContext,
)

from .claude import files

log = logging.getLogger(__name__)

SETTING_SOURCES = ["user", "project", "local"]  # your settings, CLAUDE.md, skills, plugins, MCP servers
QUESTION_TOOL = "AskUserQuestion"
# Set to empty so the session doesn't claim the server's tmux pane: the SDK can only add variables.
NOT_IN_TMUX = {"TMUX": "", "TMUX_PANE": ""}


class Client(Protocol):
    """The part of `ClaudeSDKClient` the manager uses (tests pass a fake)."""

    async def connect(self) -> None: ...
    async def get_server_info(self) -> dict[str, Any] | None: ...
    async def query(self, prompt: str) -> None: ...
    def receive_messages(self) -> Any: ...
    async def interrupt(self) -> None: ...
    async def disconnect(self) -> None: ...


ClientFactory = Callable[[ClaudeAgentOptions], Client]


@dataclass
class Prompt:
    """A prompt waiting to go out: text, and images as base64 with their media type."""

    text: str
    images: list[tuple[str, str]] = field(default_factory=list)

    def label(self) -> str:
        return self.text + (f" [{len(self.images)} image{'s' if len(self.images) > 1 else ''}]" if self.images else "")


class ManagerError(Exception):
    """A request the manager can't carry out; the message says why."""


@dataclass
class Pending:
    """A question or permission prompt the session is waiting on."""

    id: str
    tool: str
    input: dict[str, Any]
    suggestions: list[Any]
    at: int
    answer: asyncio.Future = field(repr=False)
    tool_use_id: str | None = None

    def rules(self) -> list[str]:
        """The allow rules "remember" would save, as Claude Code writes them: `Bash(touch x)`."""
        found = []
        for suggestion in self.suggestions:
            if getattr(suggestion, "type", None) == "addRules":
                for rule in suggestion.rules or []:
                    found.append(f"{rule.tool_name}({rule.rule_content})" if rule.rule_content else rule.tool_name)
        return found


@dataclass
class Managed:
    id: str = ""  # the collector's key, '<pid>-<procStart>'
    pid: int = 0
    cwd: str = ""
    client: Client | None = None
    queue: list[Prompt] = field(default_factory=list)
    busy: bool = False
    session_id: str | None = None
    model: str | None = None
    mode: str | None = None
    activity: str | None = None  # "compacting" while Claude Code compacts
    error: str | None = None  # how the last turn failed, if it did
    cost_usd: float | None = None
    pending: dict[str, Pending] = field(default_factory=dict)
    # Notes for tool calls you allowed with changes, by tool_use_id: the PostToolUse hook tells the session.
    edits: dict[str, str] = field(default_factory=dict)
    reader: asyncio.Task | None = None
    sending: bool = False


class Manager:
    def __init__(self, client_factory: ClientFactory = ClaudeSDKClient, cli_path: str | None = None) -> None:
        self.client_factory = client_factory
        self.cli_path = cli_path or shutil.which("claude")  # your Claude Code, not the SDK's bundled copy
        self.sessions: dict[str, Managed] = {}
        self._ids = itertools.count(1)

    # ── Lifecycle ─────────────────────────────────────────────────────────

    async def start(
        self, cwd: str, model: str | None = None, mode: str | None = None, name: str | None = None
    ) -> Managed:
        folder = Path(cwd).expanduser()
        if not folder.is_dir():
            raise ManagerError(f"no such folder: {cwd}")
        managed = Managed(cwd=str(folder.resolve()))

        async def can_use_tool(tool: str, tool_input: dict[str, Any], context: ToolPermissionContext):
            return await self._ask(managed, tool, tool_input, context)

        async def after_tool(hook_input: Any, tool_use_id: str | None, _context: Any) -> dict[str, Any]:
            # Without this the session believes its own input ran (docs/sdk-check.md).
            note = managed.edits.pop(tool_use_id or "", None)
            if note is None:
                return {}
            return {"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": note}}

        options = ClaudeAgentOptions(
            cwd=managed.cwd,
            model=model,
            permission_mode=mode,  # None: your own default mode applies
            setting_sources=SETTING_SOURCES,
            cli_path=self.cli_path,
            env=dict(NOT_IN_TMUX),
            extra_args={"name": name} if name else {},
            can_use_tool=can_use_tool,
            hooks={"PostToolUse": [HookMatcher(hooks=[after_tool])]},
            stderr=lambda line: log.debug("claude: %s", line),
        )
        client = self.client_factory(options)
        await client.connect()
        info = await client.get_server_info() or {}
        pid = info.get("pid")
        if not isinstance(pid, int):
            await client.disconnect()
            raise ManagerError("Claude Code started but didn't report its process id")
        managed.client, managed.pid = client, pid
        managed.id = f"{pid}-{files.proc_start(pid)}"
        managed.mode = info.get("current_permission_mode") or mode
        managed.model = model
        managed.reader = asyncio.create_task(self._read(managed))
        self.sessions[managed.id] = managed
        return managed

    async def stop(self, key: str) -> None:
        managed = self._get(key)
        del self.sessions[key]
        self._release(managed, "the session was stopped")
        if managed.reader:
            managed.reader.cancel()
        if managed.client:
            with contextlib.suppress(Exception):  # stopping must succeed even if the process already died
                await managed.client.disconnect()

    async def close(self) -> None:
        for key in list(self.sessions):
            await self.stop(key)

    # ── Driving ───────────────────────────────────────────────────────────

    async def prompt(self, key: str, text: str, images: list[tuple[str, str]] | None = None) -> int:
        """Send now if the session is free, else queue it. Returns how many prompts are waiting.

        `images` are (media type, base64 data) pairs, sent as image blocks before the text.
        """
        managed = self._get(key)
        if not text.strip() and not images:
            raise ManagerError("empty prompt")
        managed.queue.append(Prompt(text, list(images or [])))
        await self._send_next(managed)
        return len(managed.queue)

    async def rename(self, key: str, name: str) -> int:
        """Claude Code's own /rename, so the registry and the terminal agree on the name."""
        name = " ".join(name.split())
        if not name:
            raise ManagerError("empty name")
        return await self.prompt(key, f"/rename {name}")

    def clear_queue(self, key: str) -> None:
        self._get(key).queue.clear()

    async def interrupt(self, key: str) -> None:
        managed = self._get(key)
        if managed.client and managed.busy:
            await managed.client.interrupt()

    def answer(
        self,
        key: str,
        request_id: str,
        *,
        allow: bool,
        message: str | None = None,
        updated_input: dict[str, Any] | None = None,
        remember: bool = False,
    ) -> None:
        """Answer a pending question or permission prompt.

        Remember applies only the suggested allow rules: Claude Code also suggests switching mode,
        which a "remember" must never do (docs/sdk-check.md).
        """
        managed = self._get(key)
        pending = managed.pending.get(request_id)
        if pending is None or pending.answer.done():
            raise ManagerError("no such question or prompt, or it was already answered")
        if allow:
            rules = [s for s in pending.suggestions if getattr(s, "type", None) == "addRules"] if remember else None
            result: Any = PermissionResultAllow(updated_input=updated_input, updated_permissions=rules or None)
            if updated_input is not None and pending.tool != QUESTION_TOOL and pending.tool_use_id:
                changed = {k: v for k, v in updated_input.items() if pending.input.get(k) != v}
                if changed:
                    managed.edits[pending.tool_use_id] = (
                        "The user changed this tool call in Constellation before allowing it. "
                        f"It ran with: {json.dumps(changed)[:2000]}"
                    )
        else:
            result = PermissionResultDeny(message=message or "denied in Constellation")
        pending.answer.set_result(result)

    # ── Internals ─────────────────────────────────────────────────────────

    def _release(self, managed: Managed, why: str) -> None:
        for pending in managed.pending.values():
            if not pending.answer.done():
                pending.answer.set_result(PermissionResultDeny(message=why, interrupt=True))

    def _get(self, key: str) -> Managed:
        managed = self.sessions.get(key)
        if managed is None:
            raise ManagerError("not a session Constellation manages")
        return managed

    async def _send_next(self, managed: Managed) -> None:
        # `sending` covers the await: two prompts arriving together must not both go out.
        if managed.busy or managed.sending or not managed.queue or managed.client is None:
            return
        managed.sending = True
        try:
            prompt = managed.queue.pop(0)
            managed.busy, managed.error = True, None
            await managed.client.query(prompt.text if not prompt.images else _with_images(prompt))
        finally:
            managed.sending = False

    async def _ask(self, managed: Managed, tool: str, tool_input: dict[str, Any], context: ToolPermissionContext):
        request_id = f"r{next(self._ids)}"
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        managed.pending[request_id] = Pending(
            id=request_id,
            tool=tool,
            input=tool_input,
            suggestions=list(context.suggestions),
            at=int(time.time() * 1000),
            answer=future,
            tool_use_id=context.tool_use_id,
        )
        try:
            return await future
        finally:
            managed.pending.pop(request_id, None)

    async def _read(self, managed: Managed) -> None:
        assert managed.client is not None
        try:
            async for message in managed.client.receive_messages():
                self._on_message(managed, message)
                if isinstance(message, ResultMessage):
                    await self._send_next(managed)
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001 - the process died; it leaves the map like any exited session
            log.warning("managed session %s ended: %r", managed.id, error)
        # The stream ended: the process exited without being stopped here. Forget it, and release anything
        # still waiting on an answer.
        if self.sessions.get(managed.id) is managed:
            del self.sessions[managed.id]
            self._release(managed, "the session ended")

    def _on_message(self, managed: Managed, message: Any) -> None:
        if isinstance(message, SystemMessage):
            data = message.data
            if message.subtype == "init":
                managed.session_id = data.get("session_id") or managed.session_id
                managed.model = data.get("model") or managed.model
                managed.mode = data.get("permissionMode") or managed.mode
            elif message.subtype == "status":
                managed.mode = data.get("permissionMode") or managed.mode
                managed.activity = data.get("status")
        elif isinstance(message, ResultMessage):
            # After /clear, the new session id first shows up here (the reset message's id matches no file).
            managed.session_id = message.session_id or managed.session_id
            managed.busy, managed.activity = False, None
            managed.cost_usd = message.total_cost_usd
            if message.is_error and message.terminal_reason != "aborted_streaming":
                managed.error = "; ".join(message.errors or []) or message.subtype


async def _with_images(prompt: Prompt):
    """A prompt with images goes out as one streamed user message of content blocks."""
    blocks: list[dict[str, Any]] = [
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}}
        for media_type, data in prompt.images
    ]
    if prompt.text.strip():
        blocks.append({"type": "text", "text": prompt.text})
    yield {"type": "user", "message": {"role": "user", "content": blocks}, "parent_tool_use_id": None}
