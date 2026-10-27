from __future__ import annotations

import asyncio
import os
import sys

import pytest
from claude_agent_sdk import (
    PermissionResultAllow,
    PermissionResultDeny,
    PermissionUpdate,
    ResultMessage,
    SystemMessage,
    ToolPermissionContext,
)
from claude_agent_sdk.types import PermissionRuleValue  # not re-exported at the top level
from fastapi.testclient import TestClient

from constellation.app import create_app
from constellation.claude.files import proc_start
from constellation.collector import Collector
from constellation.inbox import Inbox
from constellation.manager import Manager, ManagerError

AUTH = {"Authorization": "Bearer secret"}


def result(session_id: str = "s1", *, error: bool = False, reason: str = "completed", cost: float = 0.01):
    return ResultMessage(
        subtype="error_during_execution" if error else "success",
        duration_ms=1,
        duration_api_ms=1,
        is_error=error,
        num_turns=1,
        session_id=session_id,
        total_cost_usd=cost,
        terminal_reason=reason,
    )


class FakeClient:
    """Stands in for ClaudeSDKClient: records what is sent, and streams what a test pushes."""

    made: list[FakeClient] = []

    def __init__(self, options):
        self.options = options
        self.sent: list[str] = []
        self.calls: list[tuple] = []
        self.stream: asyncio.Queue = asyncio.Queue()
        self.interrupted = False
        self.closed = False
        FakeClient.made.append(self)

    async def connect(self):
        pass

    async def get_server_info(self):
        return {"pid": os.getpid(), "current_permission_mode": "auto"}

    async def query(self, prompt):
        self.sent.append(prompt)

    async def receive_messages(self):
        while (message := await self.stream.get()) is not None:
            yield message

    async def interrupt(self):
        self.interrupted = True
        await self.stream.put(result(error=True, reason="aborted_streaming"))

    async def disconnect(self):
        self.closed = True
        await self.stream.put(None)

    async def set_model(self, model=None):
        self.calls.append(("set_model", model))

    async def set_permission_mode(self, mode):
        if mode == "bypassPermissions" and "allow-dangerously-skip-permissions" not in self.options.extra_args:
            raise RuntimeError("not launched with --dangerously-skip-permissions")
        self.calls.append(("set_permission_mode", mode))

    async def get_context_usage(self):
        return {
            "model": "claude-test-1",
            "totalTokens": 1000,
            "maxTokens": 1_000_000,
            "rawMaxTokens": 2_000_000,
            "percentage": 0.05,
            "isAutoCompactEnabled": True,
            "autoCompactThreshold": 1_500_000,
            "categories": [{"id": "messages", "name": "Messages", "tokens": 1000, "kind": "used"}],
            "memoryFiles": [{"path": "/x/CLAUDE.md", "tokens": 12}],
        }

    async def get_mcp_status(self):
        return {
            "mcpServers": [
                {"name": "one", "status": "connected", "tools": [{"name": "t"}]},
                {"name": "two", "status": "failed", "error": "boom"},
            ]
        }

    async def reconnect_mcp_server(self, name):
        self.calls.append(("reconnect", name))

    async def toggle_mcp_server(self, name, enabled):
        self.calls.append(("toggle", name, enabled))

    async def rewind_files(self, message_id):
        self.calls.append(("rewind_files", message_id))


async def settle():
    for _ in range(5):
        await asyncio.sleep(0)


def run(test):
    return asyncio.run(test())


def test_start_uses_your_setup_and_leaves_tmux_and_mode_alone(tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient, cli_path="/usr/bin/claude")
        managed = await manager.start(str(tmp_path), model="claude-haiku-5-5", name="lab")
        options = FakeClient.made[-1].options
        assert managed.id == f"{os.getpid()}-{proc_start(os.getpid())}"
        assert options.cwd == str(tmp_path.resolve()) and options.cli_path == "/usr/bin/claude"
        assert options.setting_sources == ["user", "project", "local"]
        assert options.env == {"TMUX": "", "TMUX_PANE": ""}
        assert options.permission_mode is None and managed.mode == "auto"  # your default mode
        # bypass can be chosen later (behind Constellation's confirming key); files can be rewound
        assert options.extra_args == {"allow-dangerously-skip-permissions": None, "name": "lab"}
        assert options.enable_file_checkpointing and options.resume is None
        with pytest.raises(ManagerError):
            await manager.start(str(tmp_path / "missing"))
        await manager.close()

    run(go)


def test_prompts_queue_behind_a_running_turn(tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient)
        managed = await manager.start(str(tmp_path))
        client = FakeClient.made[-1]
        both = await asyncio.gather(manager.prompt(managed.id, "one"), manager.prompt(managed.id, "two"))
        assert client.sent == ["one"] and sorted(both) == [0, 1] and managed.busy

        assert await manager.prompt(managed.id, "three") == 2
        await client.stream.put(result())
        await settle()
        assert client.sent == ["one", "two"] and [q.text for q in managed.queue] == ["three"]

        await manager.prompt(managed.id, "look", [("image/png", "aGk=")])
        assert [q.label() for q in managed.queue] == ["three", "look [1 image]"]
        manager.clear_queue(managed.id)
        await client.stream.put(result())
        await settle()
        assert client.sent == ["one", "two"] and not managed.busy

        await manager.prompt(managed.id, "what is it?", [("image/png", "aGk=")])
        (message,) = [m async for m in client.sent[-1]]  # one streamed message of content blocks
        assert [b["type"] for b in message["message"]["content"]] == ["image", "text"]
        await manager.close()

    run(go)


def test_stream_updates_mode_model_session_cost_and_errors(tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient)
        managed = await manager.start(str(tmp_path))
        client = FakeClient.made[-1]
        await manager.prompt(managed.id, "hi")
        await client.stream.put(
            SystemMessage(
                subtype="init", data={"session_id": "s1", "model": "claude-haiku-5-5", "permissionMode": "plan"}
            )
        )
        await client.stream.put(SystemMessage(subtype="status", data={"status": "compacting"}))
        await settle()
        assert (managed.session_id, managed.model, managed.mode, managed.activity) == (
            "s1",
            "claude-haiku-5-5",
            "plan",
            "compacting",
        )

        await client.stream.put(result("s2", cost=0.5))  # after /clear the new id arrives with the result
        await settle()
        assert managed.session_id == "s2" and managed.cost_usd == 0.5 and managed.activity is None

        await manager.prompt(managed.id, "long one")
        await manager.interrupt(managed.id)
        await settle()
        assert client.interrupted and managed.error is None and not managed.busy  # an interrupt isn't a failure

        await manager.prompt(managed.id, "fails")
        await client.stream.put(result(error=True))
        await settle()
        assert managed.error == "error_during_execution"
        await manager.close()

    run(go)


def ask(manager_client, tool, tool_input, suggestions=()):
    context = ToolPermissionContext(suggestions=list(suggestions), tool_use_id="t1")
    return asyncio.create_task(manager_client.options.can_use_tool(tool, tool_input, context))


def test_questions_and_permissions_wait_for_an_answer(tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient)
        managed = await manager.start(str(tmp_path))
        client = FakeClient.made[-1]
        rule = PermissionUpdate(
            type="addRules",
            rules=[PermissionRuleValue(tool_name="Bash", rule_content="touch x")],
            behavior="allow",
            destination="localSettings",
        )
        accept_edits = PermissionUpdate(type="setMode", mode="acceptEdits", destination="session")

        waiting = ask(client, "Bash", {"command": "touch x"}, [rule, accept_edits])
        await settle()
        (pending,) = managed.pending.values()
        assert pending.rules() == ["Bash(touch x)"]
        manager.answer(managed.id, pending.id, allow=True, remember=True)
        allowed = await waiting
        assert isinstance(allowed, PermissionResultAllow) and allowed.updated_permissions == [rule]  # never setMode
        assert not managed.pending

        # Allowed with changes: the PostToolUse hook tells the session what actually ran.
        waiting = ask(client, "Bash", {"command": "touch a", "description": "make a"})
        await settle()
        (pending,) = managed.pending.values()
        manager.answer(
            managed.id, pending.id, allow=True, updated_input={"command": "touch b", "description": "make a"}
        )
        await waiting
        (after_tool,) = client.options.hooks["PostToolUse"][0].hooks
        told = await after_tool({}, "t1", None)
        assert '"command": "touch b"' in told["hookSpecificOutput"]["additionalContext"]
        assert "description" not in told["hookSpecificOutput"]["additionalContext"]
        assert await after_tool({}, "t1", None) == {}  # said once

        waiting = ask(client, "Bash", {"command": "rm x"})
        await settle()
        (pending,) = managed.pending.values()
        manager.answer(managed.id, pending.id, allow=False, message="not now")
        denied = await waiting
        assert isinstance(denied, PermissionResultDeny) and denied.message == "not now"
        with pytest.raises(ManagerError):
            manager.answer(managed.id, pending.id, allow=True)

        question = {"questions": [{"question": "Color?", "options": [{"label": "Red"}, {"label": "Blue"}]}]}
        waiting = ask(client, "AskUserQuestion", question)
        await settle()
        (pending,) = managed.pending.values()
        manager.answer(managed.id, pending.id, allow=True, updated_input={**question, "answers": {"Color?": "Blue"}})
        assert (await waiting).updated_input["answers"] == {"Color?": "Blue"}

        waiting = ask(client, "Bash", {"command": "sleep 1"})
        await settle()
        await manager.stop(managed.id)
        assert isinstance(await waiting, PermissionResultDeny) and client.closed and managed.id not in manager.sessions

    run(go)


def test_a_session_that_exits_on_its_own_is_forgotten(tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient)
        managed = await manager.start(str(tmp_path))
        waiting = ask(FakeClient.made[-1], "Bash", {"command": "touch x"})
        await settle()
        await FakeClient.made[-1].stream.put(None)  # the process exited: the stream ends
        await settle()
        assert managed.id not in manager.sessions and isinstance(await waiting, PermissionResultDeny)

    run(go)


def test_managed_sessions_show_as_managed_and_waiting(claude, me, tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient)
        await manager.start(str(tmp_path))
        claude.register(me, "s1", "lab-a", cwd=str(tmp_path))
        collector = Collector(claude.root, waiting_for=dict, manager=manager)
        collector.poll()
        ask(FakeClient.made[-1], "AskUserQuestion", {"questions": []})
        await settle()
        (session,) = collector.snapshot().sessions
        assert session.kind == "managed" and session.status == "waiting" and session.waiting_for == "input needed"
        assert session.pending[0].kind == "question" and session.mode == "auto"
        await manager.close()

    run(go)


def test_api_refuses_bypass_without_its_confirmation_and_unknown_sessions(claude, me, tmp_path):
    claude.register(me, "s1", "lab-a")
    collector = Collector(claude.root, waiting_for=dict, manager=Manager(client_factory=FakeClient))
    app = create_app(collector, "secret", poll_interval=0.05, inbox=Inbox(tmp_path / "socks"))
    with TestClient(app, base_url="http://127.0.0.1") as client:
        start = {"cwd": str(tmp_path), "model": None, "mode": "bypassPermissions", "name": None}
        assert client.post("/api/sessions", json=start, headers=AUTH).status_code == 422
        wrong = client.post("/api/sessions", json={**start, "confirm": "nope"}, headers=AUTH)
        assert wrong.status_code == 422 and "folder's name" in wrong.json()["detail"]
        prompt = client.post("/api/sessions/nope/prompt", json={"text": "hi"}, headers=AUTH)
        assert prompt.status_code == 409 and "manages" in prompt.json()["detail"]
        cross = client.post("/api/sessions/nope/stop", headers={**AUTH, "Origin": "https://evil.example"})
        assert cross.status_code == 403

        started = client.post("/api/sessions", json={**start, "mode": None}, headers=AUTH)
        assert started.status_code == 200
        key = started.json()["id"]
        assert client.post(f"/api/sessions/{key}/prompt", json={"text": "hi"}, headers=AUTH).json() == {"queued": 0}
        assert client.post(f"/api/sessions/{key}/rename", json={"name": "  new   name "}, headers=AUTH).json() == {
            "queued": 1
        }
        assert FakeClient.made[-1].sent == ["hi"]
        assert client.post(f"/api/sessions/{key}/stop", headers=AUTH).status_code == 204


def test_model_mode_effort_context_and_mcp(tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient)
        managed = await manager.start(str(tmp_path))
        client = FakeClient.made[-1]
        managed.info = {"models": [{"value": "haiku", "resolvedModel": "claude-haiku-5-5"}]}
        await manager.set_model(managed.id, "haiku")
        assert ("set_model", "haiku") in client.calls and managed.model == "claude-haiku-5-5"

        await manager.set_mode(managed.id, "bypassPermissions")  # allowed by the launch flag
        assert managed.mode == "bypassPermissions"
        assert await manager.set_effort(managed.id, "low") == 0 and client.sent[-1] == "/effort low"
        assert managed.effort == "low"

        usage = await manager.context(managed.id)
        assert usage["totalTokens"] == 1000 and manager.windows == {"claude-test-1": 2_000_000}
        assert managed.compact_at == 0.75

        servers = await manager.mcp_toggle(managed.id, "two", False)
        assert ("toggle", "two", False) in client.calls and [m["status"] for m in servers] == ["connected", "failed"]
        await manager.close()

    run(go)


def test_plan_approval_can_switch_mode_but_never_to_bypass(tmp_path):
    async def go():
        manager = Manager(client_factory=FakeClient)
        managed = await manager.start(str(tmp_path))
        waiting = ask(FakeClient.made[-1], "ExitPlanMode", {"plan": "do it"})
        await settle()
        (pending,) = managed.pending.values()
        with pytest.raises(ManagerError):
            manager.answer(managed.id, pending.id, allow=True, mode="bypassPermissions")
        manager.answer(managed.id, pending.id, allow=True, mode="acceptEdits")
        (update,) = (await waiting).updated_permissions
        assert (update.type, update.mode, update.destination) == ("setMode", "acceptEdits", "session")
        await manager.close()

    run(go)


def test_fork_and_rewind_start_from_the_old_session(tmp_path):
    async def go():
        # Every fake session reports this test's pid, so each new one takes the previous one's place.
        manager = Manager(client_factory=FakeClient)
        managed = await manager.start(str(tmp_path), name="lab")
        managed.session_id = "s1"
        managed.model, managed.mode, managed.effort = "claude-haiku-5-5", "plan", "low"
        first = FakeClient.made[-1]
        await manager.rewind(managed.id, "p2", "line-1", files_too=True, conversation=True)
        assert ("rewind_files", "p2") in first.calls and first.closed
        options = FakeClient.made[-1].options
        assert (options.resume, options.fork_session, options.resume_session_at) == ("s1", False, "line-1")
        # it carries on as it was
        assert (options.model, options.permission_mode, options.effort) == ("claude-haiku-5-5", "plan", "low")
        # no resume_drops_turn: it refuses a resume that drops more than one turn
        assert options.resume_drops_turn is None and manager.sessions[managed.id].replaces == managed.id

        assert manager.sessions[managed.id].session_id == "s1"  # resumed: it's that session before its first turn
        await manager.fork(managed.id, "lab-fork")
        options = FakeClient.made[-1].options
        assert (options.resume, options.fork_session, options.extra_args["name"]) == ("s1", True, "lab-fork")
        await manager.close()

    run(go)


def test_adopting_waits_for_the_terminal_copy_to_exit(tmp_path):
    async def go():
        terminal = await asyncio.create_subprocess_exec(sys.executable, "-c", "import time; time.sleep(30)")
        manager = Manager(client_factory=FakeClient)
        manager.adopt("t-1", "s9", str(tmp_path), "term", terminal.pid, proc_start(terminal.pid))
        await asyncio.sleep(0.7)
        assert "t-1" in manager.adopting and not manager.sessions  # still open in its terminal
        terminal.kill()
        await terminal.wait()
        for _ in range(20):
            await asyncio.sleep(0.1)
            if manager.sessions:
                break
        (managed,) = manager.sessions.values()
        assert FakeClient.made[-1].options.resume == "s9" and managed.replaces == "t-1" and not manager.adopting
        await manager.close()

    run(go)


def test_adopting_through_the_api(claude, tmp_path):
    terminal = claude.process()
    claude.register(terminal, "s9", "term", cwd=str(tmp_path))
    collector = Collector(claude.root, waiting_for=dict, manager=Manager(client_factory=FakeClient))
    app = create_app(collector, "secret", poll_interval=0.05, inbox=Inbox(tmp_path / "socks"))
    with TestClient(app, base_url="http://127.0.0.1") as client:
        key = client.get("/api/snapshot", headers=AUTH).json()["sessions"][0]["id"]
        assert client.post(f"/api/sessions/{key}/adopt", headers=AUTH).status_code == 204
        assert client.get("/api/snapshot", headers=AUTH).json()["sessions"][0]["adopting"]
        assert client.delete(f"/api/sessions/{key}/adopt", headers=AUTH).status_code == 204
        assert not collector.manager.adopting


def test_a_rewind_that_cannot_start_brings_the_session_back(tmp_path):
    class Refusing(FakeClient):
        async def connect(self):
            if self.options.resume_session_at:
                raise RuntimeError("Resume rejected")

    async def go():
        manager = Manager(client_factory=Refusing)
        managed = await manager.start(str(tmp_path))
        managed.session_id = "s1"
        with pytest.raises(ManagerError, match="back as it was"):
            await manager.rewind(managed.id, "p2", "line-1", files_too=False, conversation=True)
        (back,) = manager.sessions.values()
        assert FakeClient.made[-1].options.resume == "s1" and FakeClient.made[-1].options.resume_session_at is None
        assert back.session_id == "s1"
        await manager.close()

    run(go)
