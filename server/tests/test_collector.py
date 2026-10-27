from __future__ import annotations

import json

from constellation.claude.files import proc_start
from constellation.collector import Collector


def no_waiting() -> dict[str, str]:
    return {}


def test_a_session_appears_follows_clear_and_disappears(claude, me):
    claude.register(me, "s1", "lab-a", status="busy")
    claude.transcript("/lab/a", "s1", "lab-a.1-main.jsonl")
    collector = Collector(claude.root, waiting_for=no_waiting)
    assert collector.poll() == []  # the backlog is read, not pushed

    (session,) = collector.snapshot().sessions
    assert session.id == f"{me}-{proc_start(me)}"
    assert session.name == "lab-a" and session.status == "working" and session.mode == "default"
    assert session.turns > 5 and session.counts["question"] == 1

    with claude.transcript("/lab/a", "s1").open("a") as fh:
        line = {
            "type": "user",
            "uuid": "new-1",
            "timestamp": "2026-10-26T23:00:00Z",
            "origin": {"kind": "human"},
            "message": {"role": "user", "content": "hello again"},
        }
        fh.write(json.dumps(line) + "\n")
    entries = [e for e in collector.poll() if e.type == "entries"]
    assert [e.text for e in entries[0].entries] == ["hello again"]

    claude.register(me, "s2", "lab-a")  # /clear
    claude.transcript("/lab/a", "s2", "lab-a.2-after-clear.jsonl")
    sessions = [e.session for e in collector.poll() if e.type == "session"]
    assert sessions[-1].session_ids == ["s1", "s2"] and sessions[-1].id == session.id

    claude.unregister(me)
    assert "session_removed" in [e.type for e in collector.poll()]


def test_a_waiting_session_says_what_it_waits_for(claude, me):
    claude.register(me, "s1", "lab-a", status="waiting")
    collector = Collector(claude.root, waiting_for=lambda: {"s1": "input needed"})
    collector.poll()
    (session,) = collector.snapshot().sessions
    assert session.status == "waiting" and session.waiting_for == "input needed"


def test_messages_become_edges(claude, me):
    other = claude.process()
    claude.register(me, "a1", "lab-a", cwd="/lab/a")
    claude.register(other, "b1", "lab-b", cwd="/lab/b")
    claude.transcript("/lab/a", "a1", "lab-a.1-main.jsonl")
    claude.transcript("/lab/b", "b1", "lab-b.jsonl")
    collector = Collector(claude.root, waiting_for=no_waiting)
    collector.poll()
    snapshot = collector.snapshot()

    ids = {s.name: s.id for s in snapshot.sessions}
    edges = {(e.source, e.target): e.count for e in snapshot.edges}
    assert edges[(ids["lab-a"], ids["lab-b"])] == 1  # "Hello from lab-a"
    assert edges[(ids["lab-b"], ids["lab-a"])] == 1  # "pong", sent to lab-a's (old) socket address
    # The scripted sender of the lab: not a running session, named from its own message
    assert {e.name for e in snapshot.endpoints} == {"constellation"}
    assert edges[("endpoint:constellation", ids["lab-b"])] == 1
    assert len(snapshot.subagents) == 1 and snapshot.subagents[0].status == "reported"
