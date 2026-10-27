"""Sessions Constellation starts and drives, through the Claude Agent SDK.

Each managed session is one Claude Code process behind one `ClaudeSDKClient`. The manager keeps the
client, the prompts waiting for the current turn to end, and what only the SDK stream knows: whether
a turn is running, the live model and mode, and the questions and permission prompts the session is
waiting on. The conversation itself, the registry entry and the transcript are Claude Code's files,
which the collector reads for managed sessions exactly as for any other (see docs/sdk-check.md).

Managed sessions live as long as the server: closing a browser leaves them running, stopping the
server stops them. Their transcripts stay, so they can be resumed.

A session can also start from an old one: resumed (the resume picker, or adopting a terminal session once its
terminal copy exits), forked, or restarted at an earlier point to rewind its conversation.
"""

from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
import os
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
    PermissionUpdate,
    ResultMessage,
    SystemMessage,
    TaskNotificationMessage,
    TaskStartedMessage,
    TaskUpdatedMessage,
    ToolPermissionContext,
)
from claude_agent_sdk.types import TERMINAL_TASK_STATUSES

from .claude import files

log = logging.getLogger(__name__)

SETTING_SOURCES = ["user", "project", "local"]  # your settings, CLAUDE.md, skills, plugins, MCP servers
QUESTION_TOOL = "AskUserQuestion"
PLAN_TOOL = "ExitPlanMode"
# Set to empty so the session doesn't claim the server's tmux pane: the SDK can only add variables.
NOT_IN_TMUX = {"TMUX": "", "TMUX_PANE": ""}
# What a Claude Code session sets for the commands it runs. A server started from inside one (`! ./dev`) must not
# hand them on: its sessions would write no transcript (child session) and claim that session's inbox and id.
# Your own CLAUDE_CODE_* settings (a provider, an output limit) aren't on this list and pass through.
SESSION_ENV = (
    "CLAUDECODE",
    "CLAUDE_PID",
    "CLAUDE_EFFORT",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_EXECPATH",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_SESSION_ATTENDED",
    "CLAUDE_CODE_MESSAGING_SOCKET",
    "CLAUDE_CODE_MESSAGING_TOKEN",
)
# Without this flag a session can never be switched to bypass. Constellation still asks for the second key
# that names the session before it does (design system principle 5).
ALLOW_BYPASS = {"allow-dangerously-skip-permissions": None}
ADOPT_POLL_S = 0.5


def leave_parent_session() -> None:
    """Drops the variables of a Claude Code session this server may have been started from (SESSION_ENV)."""
    for name in SESSION_ENV:
        os.environ.pop(name, None)


class Client(Protocol):
    """The part of `ClaudeSDKClient` the manager uses (tests pass a fake)."""

    async def connect(self) -> None: ...
    async def get_server_info(self) -> dict[str, Any] | None: ...
    async def query(self, prompt: str) -> None: ...
    def receive_messages(self) -> Any: ...
    async def interrupt(self) -> None: ...
    async def disconnect(self) -> None: ...
    async def set_model(self, model: str | None = None) -> None: ...
    async def set_permission_mode(self, mode: Any) -> None: ...
    async def get_context_usage(self) -> Any: ...
    async def get_mcp_status(self) -> Any: ...
    async def reconnect_mcp_server(self, server_name: str) -> None: ...
    async def toggle_mcp_server(self, server_name: str, enabled: bool) -> None: ...
    async def rewind_files(self, user_message_id: str) -> None: ...
    async def stop_task(self, task_id: str) -> None: ...


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
    name: str | None = None
    client: Client | None = None
    info: dict[str, Any] = field(default_factory=dict)  # get_server_info at connect: commands, models
    queue: list[Prompt] = field(default_factory=list)
    busy: bool = False
    session_id: str | None = None
    model: str | None = None
    mode: str | None = None
    activity: str | None = None  # "compacting" while Claude Code compacts
    error: str | None = None  # how the last turn failed, if it did
    cost_usd: float | None = None
    effort: str | None = None  # set here; until then, the effortLevel in your settings applies
    mcp: list[dict[str, Any]] | None = None  # the last get_mcp_status
    compact_at: float | None = None  # where auto-compact fires, as a share of the window
    replaces: str | None = None  # the node this one took over from: adopted, or restarted to rewind
    tasks: dict[str, dict[str, Any]] = field(default_factory=dict)  # background tasks running, by task id
    pending: dict[str, Pending] = field(default_factory=dict)
    # Notes for tool calls you allowed with changes, by tool_use_id: the PostToolUse hook tells the session.
    edits: dict[str, str] = field(default_factory=dict)
    reader: asyncio.Task | None = None
    sending: bool = False


@dataclass
class Fork:
    """A session forked from another, for the record in both conversations."""

    parent: str | None  # node id, if the parent ran here
    parent_name: str
    child: str
    at: int


@dataclass
class Adoption:
    """A terminal session to resume here as soon as its terminal copy exits."""

    session_id: str
    cwd: str
    name: str | None
    pid: int
    proc_start: str | None
    task: asyncio.Task | None = None


class Manager:
    def __init__(self, client_factory: ClientFactory = ClaudeSDKClient, cli_path: str | None = None) -> None:
        self.client_factory = client_factory
        self.cli_path = cli_path or shutil.which("claude")  # your Claude Code, not the SDK's bundled copy
        self.sessions: dict[str, Managed] = {}
        self.adopting: dict[str, Adoption] = {}  # by the external session's node id
        self.windows: dict[str, int] = {}  # context window per model, learned from get_context_usage
        self.models: list[dict[str, Any]] = []  # the latest model list any session reported, for the launcher
        self.forks: list[Fork] = []
        self.notify: Callable[[str], None] = lambda text: log.warning("%s", text)  # the app shows these
        self._ids = itertools.count(1)
        self._tasks: set[asyncio.Task] = set()

    # ── Lifecycle ─────────────────────────────────────────────────────────

    async def start(
        self,
        cwd: str,
        model: str | None = None,
        mode: str | None = None,
        name: str | None = None,
        *,
        resume: str | None = None,
        fork: bool = False,
        resume_at: str | None = None,
        replaces: str | None = None,
        effort: str | None = None,
    ) -> Managed:
        """Start a session in `cwd`, or resume `resume` there (forked, or cut back to `resume_at`)."""
        folder = Path(cwd).expanduser()
        if not folder.is_dir():
            raise ManagerError(f"no such folder: {cwd}")
        managed = Managed(cwd=str(folder.resolve()), name=name, replaces=replaces)

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
            extra_args={**ALLOW_BYPASS, **({"name": name} if name else {})},
            can_use_tool=can_use_tool,
            hooks={"PostToolUse": [HookMatcher(hooks=[after_tool])]},
            stderr=lambda line: log.debug("claude: %s", line),
            enable_file_checkpointing=True,  # for rewinding files
            resume=resume,
            fork_session=fork,
            resume_session_at=resume_at,
            effort=effort,  # type: ignore[arg-type]
        )
        client = self.client_factory(options)
        try:
            await client.connect()
        except Exception as error:  # noqa: BLE001 - a refused resume, a missing binary: say why
            raise ManagerError(f"Claude Code didn't start: {error}") from error
        info = await client.get_server_info() or {}
        pid = info.get("pid")
        if not isinstance(pid, int):
            await client.disconnect()
            raise ManagerError("Claude Code started but didn't report its process id")
        managed.client, managed.pid, managed.info = client, pid, info
        managed.id = f"{pid}-{files.proc_start(pid)}"
        managed.mode = info.get("current_permission_mode") or mode
        managed.model = model
        managed.effort = effort
        # Resumed (not forked), it is that session from the start: fork and rewind work before its first turn.
        managed.session_id = resume if resume and not fork else None
        if info.get("models"):
            self.models = info["models"]
        managed.reader = asyncio.create_task(self._read(managed))
        self.sessions[managed.id] = managed
        self._refresh_mcp(managed)
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
        for key in list(self.adopting):
            self.cancel_adoption(key)
        for key in list(self.sessions):
            await self.stop(key)

    async def fork(self, key: str, name: str | None = None, parent_name: str | None = None) -> Managed:
        """A new session that starts with this one's conversation (fork_session), in a new pane."""
        managed = self._get(key)
        if not managed.session_id:
            raise ManagerError("nothing to fork yet: send a prompt first")
        child = await self.start(
            managed.cwd, managed.model, name=name, resume=managed.session_id, fork=True, effort=managed.effort
        )
        self.record_fork(key, parent_name or managed.name or "session", child.id)
        return child

    def record_fork(self, parent: str | None, parent_name: str, child: str) -> None:
        self.forks.append(Fork(parent=parent, parent_name=parent_name, child=child, at=int(time.time() * 1000)))

    async def rewind(
        self, key: str, prompt: str, parent: str | None, *, files_too: bool, conversation: bool
    ) -> Managed:
        """Rewind to just before `prompt`: restore its files (checkpoints), and/or restart the session cut back
        to `parent`, the line the prompt continued from. The cut-back restart is a new process: a new node."""
        managed = self._get(key)
        if managed.busy:
            raise ManagerError("a turn is running: interrupt it first")
        if files_too and managed.client:
            try:
                await managed.client.rewind_files(prompt)
            except Exception as error:  # noqa: BLE001 - no checkpoint for it, for one
                raise ManagerError(f"files not restored: {error}") from error
        if not conversation:
            return managed
        if not managed.session_id:
            raise ManagerError("nothing to rewind yet")
        session_id = managed.session_id
        # The restart carries on as it was: same model, mode and effort. One process per session, so the old one
        # stops first; if the cut-back one won't start, the session comes back as it was.
        same = {"model": managed.model, "mode": managed.mode, "name": managed.name, "effort": managed.effort}
        await self.stop(key)
        try:
            if parent is None:  # before the first prompt: an empty conversation
                return await self.start(managed.cwd, replaces=key, **same)
            return await self.start(managed.cwd, resume=session_id, resume_at=parent, replaces=key, **same)
        except ManagerError as error:
            await self.start(managed.cwd, resume=session_id, replaces=key, **same)
            raise ManagerError(f"the conversation wasn't rewound, the session is back as it was: {error}") from error

    # ── Adopting a terminal session ───────────────────────────────────────

    def adopt(self, key: str, session_id: str, cwd: str, name: str | None, pid: int, proc_start: str | None) -> None:
        """Resume an external session here once its terminal copy exits: one process per session."""
        if key in self.adopting:
            return
        adoption = Adoption(session_id=session_id, cwd=cwd, name=name, pid=pid, proc_start=proc_start)
        adoption.task = asyncio.create_task(self._adopt(key, adoption))
        self.adopting[key] = adoption

    def cancel_adoption(self, key: str) -> None:
        adoption = self.adopting.pop(key, None)
        if adoption and adoption.task:
            adoption.task.cancel()

    async def _adopt(self, key: str, adoption: Adoption) -> None:
        while files.proc_start(adoption.pid) == adoption.proc_start:
            await asyncio.sleep(ADOPT_POLL_S)
        try:
            await self.start(adoption.cwd, name=adoption.name, resume=adoption.session_id, replaces=key)
        except ManagerError as error:  # its terminal copy is gone already; `claude --resume <id>` still works
            self.notify(
                f"{adoption.name or adoption.session_id[:8]} wasn't adopted: {error}. "
                f"Its terminal copy has exited; claude --resume {adoption.session_id} brings it back."
            )
        finally:
            self.adopting.pop(key, None)

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

    async def set_model(self, key: str, model: str) -> None:
        """Applies from the next turn. The status line shows it as soon as Claude Code confirms (init)."""
        managed = self._get(key)
        assert managed.client is not None
        await managed.client.set_model(model)
        known = next((m for m in managed.info.get("models") or [] if m.get("value") == model), None)
        managed.model = (known or {}).get("resolvedModel") or model

    async def set_mode(self, key: str, mode: str) -> None:
        """Applies from the next tool call."""
        managed = self._get(key)
        assert managed.client is not None
        try:
            await managed.client.set_permission_mode(mode)
        except Exception as error:  # noqa: BLE001 - Claude Code says why (bypass without the flag, say)
            raise ManagerError(str(error)) from error
        managed.mode = mode

    async def set_effort(self, key: str, effort: str) -> int:
        """Effort is a local command (/effort): no model call. Queued like a prompt."""
        managed = self._get(key)
        queued = await self.prompt(key, f"/effort {effort}")
        managed.effort = effort
        return queued

    async def context(self, key: str) -> dict[str, Any]:
        """The /context breakdown. Also teaches the collector this model's window size."""
        managed = self._get(key)
        assert managed.client is not None
        usage = dict(await managed.client.get_context_usage())
        if usage.get("model") and usage.get("rawMaxTokens"):
            self.windows[usage["model"]] = usage["rawMaxTokens"]
        if usage.get("isAutoCompactEnabled") and usage.get("autoCompactThreshold") and usage.get("rawMaxTokens"):
            managed.compact_at = usage["autoCompactThreshold"] / usage["rawMaxTokens"]
        return usage

    async def stop_task(self, key: str, task_id: str) -> None:
        """Stops one background task (stop_task()); the session reports its end in the stream."""
        managed = self._get(key)
        assert managed.client is not None
        if task_id not in managed.tasks:
            raise ManagerError("no such background task, or it has ended")
        try:
            await managed.client.stop_task(task_id)
        except Exception as error:  # noqa: BLE001 - say why
            raise ManagerError(f"not stopped: {error}") from error

    async def mcp(self, key: str) -> list[dict[str, Any]]:
        managed = self._get(key)
        assert managed.client is not None
        managed.mcp = list((await managed.client.get_mcp_status()).get("mcpServers") or [])
        return managed.mcp

    async def mcp_reconnect(self, key: str, server: str) -> list[dict[str, Any]]:
        managed = self._get(key)
        assert managed.client is not None
        try:
            await managed.client.reconnect_mcp_server(server)
        except Exception as error:  # noqa: BLE001 - the server said no: show why
            raise ManagerError(f"{server} didn't reconnect: {error}") from error
        return await self.mcp(key)

    async def mcp_toggle(self, key: str, server: str, enabled: bool) -> list[dict[str, Any]]:
        managed = self._get(key)
        assert managed.client is not None
        try:
            await managed.client.toggle_mcp_server(server, enabled)
        except Exception as error:  # noqa: BLE001
            raise ManagerError(f"{server} wasn't {'enabled' if enabled else 'disabled'}: {error}") from error
        return await self.mcp(key)

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
        mode: str | None = None,
    ) -> None:
        """Answer a pending question or permission prompt.

        Remember applies only the suggested allow rules: Claude Code also suggests switching mode,
        which a "remember" must never do (docs/sdk-check.md). `mode` is for plan approval only: approve, then
        work in that mode, as Claude Code's own "yes, and auto-accept edits" does.
        """
        managed = self._get(key)
        pending = managed.pending.get(request_id)
        if pending is None or pending.answer.done():
            raise ManagerError("no such question or prompt, or it was already answered")
        if allow:
            rules = [s for s in pending.suggestions if getattr(s, "type", None) == "addRules"] if remember else []
            if mode is not None:
                if pending.tool != PLAN_TOOL or mode == "bypassPermissions":
                    raise ManagerError("a mode can only come with a plan approval, and never bypass")
                rules.append(PermissionUpdate(type="setMode", mode=mode, destination="session"))
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

    def _refresh_mcp(self, managed: Managed) -> None:
        """MCP health for the status line, read in the background after start and after every turn."""

        async def refresh() -> None:
            with contextlib.suppress(Exception):  # an old Claude Code, or the session just ended
                await self.mcp(managed.id)

        if managed.client is not None and self.sessions.get(managed.id) is managed:
            task = asyncio.get_running_loop().create_task(refresh())
            self._tasks.add(task)  # kept until done, so it isn't collected mid-run
            task.add_done_callback(self._tasks.discard)

    async def _read(self, managed: Managed) -> None:
        assert managed.client is not None
        try:
            async for message in managed.client.receive_messages():
                self._on_message(managed, message)
                if isinstance(message, ResultMessage):
                    self._refresh_mcp(managed)
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
        # Background tasks: started, then ended by a terminal status from either of two messages (SDK docs).
        if isinstance(message, TaskStartedMessage):
            managed.tasks[message.task_id] = {"description": message.description, "type": message.task_type}
            return
        if isinstance(message, TaskNotificationMessage) or (
            isinstance(message, TaskUpdatedMessage) and message.patch.get("status") in TERMINAL_TASK_STATUSES
        ):
            managed.tasks.pop(message.task_id, None)
            return
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
