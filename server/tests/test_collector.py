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


def test_an_edge_opens_the_messages_between_two_sessions(claude, me):
    other = claude.process()
    claude.register(me, "a1", "lab-a", cwd="/lab/a")
    claude.register(other, "b1", "lab-b", cwd="/lab/b")
    claude.transcript("/lab/a", "a1", "lab-a.1-main.jsonl")
    claude.transcript("/lab/b", "b1", "lab-b.jsonl")
    collector = Collector(claude.root, waiting_for=no_waiting)
    collector.poll()
    ids = {s.name: s.id for s in collector.snapshot().sessions}

    found = collector.link(ids["lab-a"], ids["lab-b"])
    # Each message both ways, once from the sender's transcript and once from the receiver's, oldest first
    assert [(m.session, m.entry.kind) for m in found] == [
        (ids["lab-a"], "sent"),
        (ids["lab-b"], "received"),
        (ids["lab-b"], "sent"),
        (ids["lab-a"], "received"),
    ]
    assert found[-1].entry.text == "pong"
    assert collector.link(ids["lab-a"], "endpoint:nobody") == []


def test_rewound_turns_and_what_a_rewind_restores(claude, me):
    claude.register(me, "a1", "lab-a", cwd="/lab/a")
    path = claude.transcript("/lab/a", "a1", "lab-a.1-main.jsonl")
    collector = Collector(claude.root, waiting_for=no_waiting)
    collector.poll()
    key = collector.snapshot().sessions[0].id
    turns = collector.turns(key)
    abandoned = [t for t in turns if t.abandoned]
    assert len(abandoned) == 1 and abandoned[0].entry.abandoned and not abandoned[0].attention

    prompts = [t.entry for t in turns if t.entry.kind == "prompt"]
    preview = collector.rewind_preview(key, prompts[0].id)
    assert preview is not None and preview.turns == len(turns) - 2  # the /rename turn and the abandoned one stay out
    assert collector.rewind_preview(key, turns[0].entry.id) is None  # /rename isn't a prompt
    assert collector.prompt_parent(key, prompts[0].id) == (
        prompts[0].id and collector.nodes[key].timeline.by_id[prompts[0].id].parent,
        True,
    )

    with path.open("a") as fh:  # a Write after the last prompt: rewinding to it restores that file
        call = {
            "type": "assistant",
            "uuid": "w1",
            "message": {
                "content": [
                    {
                        "type": "tool_use",
                        "id": "toolu_w",
                        "name": "Write",
                        "input": {"file_path": "/elsewhere/x.txt", "content": "x" * 150_000},  # past content()'s cut
                    }
                ]
            },
        }
        fh.write(json.dumps(call) + "\n")
    collector.poll()
    preview = collector.rewind_preview(key, prompts[-1].id)
    assert preview.files == ["/elsewhere/x.txt"] and preview.outside == ["/elsewhere/x.txt"]


def test_constellations_own_helper_sessions_stay_off_the_map(claude, me):
    claude.register(me, "h1", "helper", cwd="/run/constellation/summary")
    collector = Collector(claude.root, waiting_for=no_waiting, ignore={"/run/constellation/summary"})
    collector.poll()
    assert collector.snapshot().sessions == []


def test_an_image_sent_with_a_prompt_can_be_read_back(claude, me):
    claude.register(me, "s1", "lab-a", cwd="/lab/a")
    image = {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "aGk="}}
    prompt = {"type": "user", "uuid": "p1", "message": {"content": [image, {"type": "text", "text": "look"}]}}
    claude.transcript("/lab/a", "s1").write_text(json.dumps(prompt) + "\n")
    collector = Collector(claude.root, waiting_for=no_waiting)
    collector.poll()
    key = collector.snapshot().sessions[0].id
    assert collector.page(key).entries[0].images == 1
    assert collector.image(key, "p1", 0) == ("image/jpeg", b"hi")
    assert collector.image(key, "p1", 1) is None and collector.image(key, "nope", 0) is None


def test_search_finds_messages_in_every_running_session_newest_first(claude, me):
    claude.register(me, "s1", "lab-a", status="idle")
    path = claude.transcript("/lab/a", "s1")
    prompt = lambda uuid, hour, text: {  # noqa: E731
        "type": "user",
        "uuid": uuid,
        "timestamp": f"2026-10-26T{hour}:00:00Z",
        "message": {"content": text},
    }
    lines = [
        prompt("u1", 10, "Find the Session Store"),
        prompt("u2", 11, "use the session store"),
        prompt("u3", 12, "something else"),
    ]
    path.write_text("".join(json.dumps(line) + "\n" for line in lines))
    collector = Collector(claude.root, waiting_for=no_waiting)
    collector.poll()
    hits = collector.search("session STORE")
    assert [h.entry.text for h in hits] == ["use the session store", "Find the Session Store"]
    assert hits[0].session == f"{me}-{proc_start(me)}"
    assert collector.search("  ") == []


def test_a_summary_comes_free_while_nothing_has_happened_since(claude, me):
    claude.register(me, "s1", "lab-a", status="idle")
    path = claude.transcript("/lab/a", "s1")
    at = "2026-10-26T10:00:00Z"
    prompt = {"type": "user", "uuid": "u1", "timestamp": at, "message": {"content": "migrate the db"}}
    recap = {
        "type": "system",
        "subtype": "away_summary",
        "uuid": "r1",
        "timestamp": "2026-10-26T10:05:00Z",
        "content": "Migrations drafted; waiting on a schema review.",
    }
    path.write_text(json.dumps(prompt) + "\n" + json.dumps(recap) + "\n")
    collector = Collector(claude.root, waiting_for=no_waiting)
    collector.poll()
    key = f"{me}-{proc_start(me)}"
    recapped = ("Migrations drafted; waiting on a schema review.", 1793009100000, "claude")
    assert collector.summary_for_free(key) == recapped

    later = {"type": "user", "uuid": "u2", "timestamp": "2026-10-26T10:10:00Z", "message": {"content": "now the api"}}
    with path.open("a") as fh:
        fh.write(json.dumps(later) + "\n")
    collector.poll()
    assert collector.summary_for_free(key) is None  # it moved on since the recap: this one needs the model

    collector.summaries[key] = ("Moving on to the API.", 1793009400000, "model")  # made at 10:10, as the prompt
    assert collector.summary_for_free(key) == ("Moving on to the API.", 1793009400000, "model")
