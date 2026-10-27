from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from constellation.claude.transcript import Timeline, Transcript

from .conftest import TRANSCRIPTS


def read(name: str) -> tuple[Transcript, Timeline]:
    transcript, timeline = Transcript(TRANSCRIPTS / name, name), Timeline()
    transcript.read(timeline)
    return transcript, timeline


def test_lab_session_entries():
    t, tl = read("lab-a.1-main.jsonl")
    kinds = Counter(i.kind for i in tl.items)
    starters = [(i.kind, i.text) for i in tl.items if i.starter]

    assert starters[0] == ("slash", "/rename lab-a")
    assert [text for kind, text in starters if kind == "prompt"][0].startswith("Run this exact shell command")
    # One row for the /compact you ran, in the design system's form; the command line after it isn't repeated.
    (compact,) = [i for i in tl.items if i.kind == "compact"]
    assert (compact.text, compact.detail) == ("/compact", "55k → 12k tokens")
    assert ("slash", "/compact") not in starters
    assert kinds["question"] == 1 and kinds["answer"] == 1 and kinds["interrupt"] == 1
    assert tl.turn == len(starters)

    answer = next(i for i in tl.items if i.kind == "answer")
    assert answer.text == "Color: Blue"  # the design system's answered record: header, then the answer
    assert t.title == "lab-a" and t.permission_mode == "default"


def test_a_rewound_prompt_is_left_behind():
    # lab-a interrupted a prompt before any reply and sent it again: Claude Code continued from the same parent.
    t, tl = read("lab-a.1-main.jsonl")
    prompts = [i for i in tl.items if i.kind == "prompt" and i.text.startswith("Write a detailed")]
    assert [p.abandoned for p in prompts] == [True, False] and prompts[0].parent == prompts[1].parent
    assert tl.abandoned == {prompts[0].turn}
    assert all(i.abandoned for i in tl.items if i.turn == prompts[0].turn)  # its interrupt too
    assert not any(i.abandoned for i in tl.items if i.turn != prompts[0].turn)
    assert t.first_prompt.startswith("Run this exact shell command")


def test_messages_and_subagents():
    t, tl = read("lab-a.1-main.jsonl")
    sent = [i for i in tl.items if i.kind == "sent"]
    assert {i.peer for i in sent} == {"lab-b", "uds:/run/user/1000/cc-socks/cst-sniff.sock"}
    assert all(i.msg_id for i in sent) and len(t.sent) == 2

    received = next(i for i in tl.items if i.kind == "received")
    assert received.peer == "lab-b" and received.text == "pong" and received.starter
    assert t.received[0]["from"].endswith("/3121904.sock")

    (agent,) = t.agents.values()
    assert agent["status"] == "reported"
    assert any(i.kind == "subagent_reported" and i.agent_id == agent["id"] for i in tl.items)


def test_tool_results_attach_to_their_call():
    _, tl = read("lab-a.1-main.jsonl")
    bash = next(i for i in tl.items if i.kind == "tool" and i.tool == "Bash")
    assert bash.detail and bash.result_error is False and bash.result_offset is not None


def test_entry_content_reads_from_the_file():
    t, tl = read("lab-a.1-main.jsonl")
    question = next(i for i in tl.items if i.kind == "question")
    content = t.content(question)
    assert "Which color do you prefer?" in (content.input or "")
    assert "Blue" in (content.result or "")
    reply = next(i for i in tl.items if i.kind == "reply")
    assert t.content(reply).text.strip()


def test_incremental_reads_match_a_full_read(tmp_path: Path):
    source = (TRANSCRIPTS / "lab-a.1-main.jsonl").read_bytes()
    target = tmp_path / "s.jsonl"
    t, tl = Transcript(target, "s"), Timeline()
    target.write_bytes(b"")
    for start in range(0, len(source), 997):  # cuts lines in half on purpose
        with target.open("ab") as fh:
            fh.write(source[start : start + 997])
        t.read(tl)
    _, full = read("lab-a.1-main.jsonl")
    assert [(i.id, i.kind, i.text) for i in tl.items] == [(i.id, i.kind, i.text) for i in full.items]
    assert t.offset == len(source)


def test_raw_api_lines_are_skipped(tmp_path: Path):
    path = tmp_path / "s.jsonl"
    path.write_text('{"type":"api-request","huge":"x"}\nnot json\n')
    t, tl = Transcript(path, "s"), Timeline()
    assert t.read(tl) == [] and t.offset == path.stat().st_size


def test_a_mode_change_is_a_record_and_images_are_counted(tmp_path: Path):
    lines = [
        {"type": "permission-mode", "permissionMode": "default"},
        {
            "type": "user",
            "uuid": "p1",
            "message": {
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "aGk="}},
                    {"type": "text", "text": "look"},
                ]
            },
        },
        {"type": "permission-mode", "permissionMode": "default"},
        {"type": "permission-mode", "permissionMode": "plan"},
        # An SDK session marks only its prompts: the mode on the prompt line counts the same, and once.
        {"type": "user", "uuid": "p2", "permissionMode": "acceptEdits", "message": {"content": "go"}},
        {"type": "permission-mode", "permissionMode": "acceptEdits"},
    ]
    path = tmp_path / "s.jsonl"
    path.write_text("\n".join(json.dumps(x) for x in lines) + "\n")
    t, tl = Transcript(path, "s"), Timeline()
    t.read(tl)
    modes = [i.text for i in tl.items if i.kind in ("mode", "prompt")]
    assert modes == ["look", "plan", "acceptEdits", "go"]  # changes only, each before the prompt it applies to
    prompt = next(i for i in tl.items if i.kind == "prompt")
    assert prompt.images == 1 and t.image(prompt, 0) == ("image/png", b"hi") and t.image(prompt, 1) is None
