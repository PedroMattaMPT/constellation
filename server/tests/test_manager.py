from __future__ import annotations

import asyncio
import os

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
        assert options.extra_args == {"name": "lab"}
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


def test_api_refuses_bypass_at_start_and_unknown_sessions(claude, me, tmp_path):
    claude.register(me, "s1", "lab-a")
    collector = Collector(claude.root, waiting_for=dict, manager=Manager(client_factory=FakeClient))
    app = create_app(collector, "secret", poll_interval=0.05)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        start = {"cwd": str(tmp_path), "model": None, "mode": "bypassPermissions", "name": None}
        assert client.post("/api/sessions", json=start, headers=AUTH).status_code == 422
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
