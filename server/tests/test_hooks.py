from __future__ import annotations

import json
import os
import shutil
import subprocess
import time

import pytest
from fastapi.testclient import TestClient

from constellation import hooks
from constellation.app import create_app
from constellation.collector import Collector
from constellation.hooks import Reports
from constellation.inbox import Inbox

AUTH = {"Authorization": "Bearer secret"}
QUESTION = {
    "session_id": "s1",
    "hook_event_name": "PreToolUse",
    "tool_name": "AskUserQuestion",
    "tool_use_id": "toolu_1",
    "tool_input": {"questions": [{"question": "Color?", "header": "Color", "options": [{"label": "Red"}]}]},
}


def test_install_keeps_your_settings_and_removes_cleanly(claude):
    settings = claude.root / "settings.json"
    mine = {
        "model": "opus",
        "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "x"}]}]},
    }
    settings.write_text(json.dumps(mine))
    assert not hooks.status(claude.root).installed

    status = hooks.install(claude.root)
    assert status.installed and os.access(status.script, os.X_OK)
    installed = json.loads(settings.read_text())
    assert installed["model"] == "opus" and len(installed["hooks"]["PreToolUse"]) == 2
    assert installed["hooks"]["PreToolUse"][1]["matcher"] == "AskUserQuestion"
    assert installed["hooks"]["PermissionRequest"][0]["hooks"][0]["command"] == status.script
    hooks.install(claude.root)  # twice: still one entry each
    assert len(json.loads(settings.read_text())["hooks"]["PreToolUse"]) == 2

    assert not hooks.uninstall(claude.root).installed
    assert json.loads(settings.read_text()) == mine and not os.path.exists(status.script)


def test_install_leaves_a_broken_settings_file_alone(claude):
    (claude.root / "settings.json").write_text("{not json")
    with pytest.raises(ValueError):
        hooks.install(claude.root)
    assert (claude.root / "settings.json").read_text() == "{not json"


@pytest.mark.skipif(not shutil.which("curl"), reason="the hook script uses curl")
def test_the_script_does_nothing_without_a_server(tmp_path):
    script = tmp_path / "hook.sh"
    script.write_text(hooks.SCRIPT)
    script.chmod(0o755)
    started = time.time()
    done = subprocess.run(
        [str(script)],
        input=json.dumps(QUESTION),
        capture_output=True,
        text=True,
        env={**os.environ, "XDG_RUNTIME_DIR": str(tmp_path)},
        timeout=10,
    )
    assert done.returncode == 0 and done.stdout == "" and time.time() - started < 1


def test_reports_last_until_answered():
    reports = Reports()
    reports.add(QUESTION)
    reports.add({**QUESTION, "hook_event_name": "PermissionRequest"})  # both hooks for one question: one request
    (request,) = reports.current("s1", waiting=True, settled=set())
    assert (
        request.kind == "question" and request.source == "hook" and request.input["questions"][0]["header"] == "Color"
    )
    assert reports.current("s1", waiting=True, settled={"toolu_1"}) == []  # written to the transcript: answered

    reports.add(
        {
            **QUESTION,
            "tool_use_id": None,
            "tool_name": "Bash",
            "tool_input": {"command": "rm x"},
            "permission_suggestions": [{"type": "addRules", "rules": [{"toolName": "Bash", "ruleContent": "rm x"}]}],
        }
    )
    (request,) = reports.current("s1", waiting=True, settled=set())
    assert request.kind == "permission" and request.rules == ["Bash(rm x)"]
    assert reports.current("s1", waiting=False, settled=set()) == []  # it was waiting, now it isn't


def test_reported_questions_show_on_the_terminal_session(claude, me, tmp_path):
    claude.register(me, "s1", "lab-a", status="waiting")
    collector = Collector(claude.root, waiting_for=dict)
    app = create_app(collector, "secret", poll_interval=0.05, inbox=Inbox(tmp_path / "socks"))
    with TestClient(app, base_url="http://127.0.0.1") as client:
        assert client.post("/api/hooks/report", json=QUESTION).status_code == 401
        assert client.post("/api/hooks/report", json=QUESTION, headers=AUTH).status_code == 204
        (session,) = client.get("/api/snapshot", headers=AUTH).json()["sessions"]
        assert session["kind"] == "external" and session["pending"][0]["source"] == "hook"


def test_without_hooks_an_open_question_shows_from_the_transcript(claude, me):
    # Claude Code 2.1.311 writes the call while the question is open; its result comes with the answer.
    claude.register(me, "s1", "lab-a", status="waiting")
    block = {"type": "tool_use", "id": "toolu_q", "name": "AskUserQuestion", "input": QUESTION["tool_input"]}
    call = {"type": "assistant", "uuid": "a1", "timestamp": "2026-10-27T12:00:00Z", "message": {"content": [block]}}
    path = claude.transcript("/lab/a", "s1")
    path.write_text(json.dumps(call) + "\n")
    collector = Collector(claude.root, waiting_for=lambda: {"s1": "input needed"})
    collector.poll()
    (request,) = collector.snapshot().sessions[0].pending
    assert (request.kind, request.source, request.input["questions"][0]["header"]) == (
        "question",
        "transcript",
        "Color",
    )

    answer = {
        "type": "user",
        "uuid": "u2",
        "message": {"content": [{"type": "tool_result", "tool_use_id": "toolu_q", "content": "Red"}]},
        "toolUseResult": {"answers": {"Color?": "Red"}},
    }
    with path.open("a") as fh:
        fh.write(json.dumps(answer) + "\n")
    claude.register(me, "s1", "lab-a", status="busy")
    collector.poll()
    assert collector.snapshot().sessions[0].pending == []


def test_install_writes_through_a_symlinked_settings_file(claude, tmp_path):
    real = tmp_path / "dotfiles" / "settings.json"
    real.parent.mkdir()
    real.write_text('{"model": "opus"}')
    real.chmod(0o640)
    (claude.root / "settings.json").symlink_to(real)
    hooks.install(claude.root)
    assert (claude.root / "settings.json").is_symlink() and oct(real.stat().st_mode & 0o777) == "0o640"
    assert "PermissionRequest" in json.loads(real.read_text())["hooks"]


def test_the_token_stays_out_of_the_process_list_and_another_servers_files_stay(tmp_path, monkeypatch):
    monkeypatch.setenv("XDG_RUNTIME_DIR", str(tmp_path))
    assert "$token" not in hooks.SCRIPT and '@"$d/header"' in hooks.SCRIPT
    hooks.publish("http://127.0.0.1:7337", "mine")
    assert oct(hooks.header_file().stat().st_mode & 0o777) == "0o600"
    hooks.publish("http://127.0.0.1:7340", "theirs")  # a second server started since
    hooks.unpublish("mine")
    assert hooks.address_file().read_text() == "http://127.0.0.1:7340\n"
    hooks.unpublish("theirs")
    assert not hooks.address_file().exists() and not hooks.header_file().exists()
