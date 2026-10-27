from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path

import pytest

from constellation.usage import Ledger, Today, tokens, window

OPUS = "claude-opus-5-5"


def usage(inp=0, out=0, read=0, write=0, hour=0, searches=0) -> dict:
    return {
        "input_tokens": inp,
        "output_tokens": out,
        "cache_read_input_tokens": read,
        "cache_creation_input_tokens": write,
        "cache_creation": {"ephemeral_5m_input_tokens": write - hour, "ephemeral_1h_input_tokens": hour},
        "server_tool_use": {"web_search_requests": searches},
    }


def test_a_reply_is_priced_by_its_model_with_both_cache_writes_and_searches():
    t = tokens(usage(inp=1_000_000, out=1_000_000, read=1_000_000, write=2_000_000, hour=1_000_000, searches=3), OPUS)
    # input 4 + output 20 + read 0.20 + 5-minute writes 5 + 1-hour writes 8 + searches 0.03
    assert t.cost == pytest.approx(37.23)
    assert tokens(usage(inp=1000), "claude-opus-5-5[1m]").cost == pytest.approx(0.004)  # cost-state's spelling
    assert tokens(usage(inp=1000), "<synthetic>").cost == 0
    assert window(OPUS) == 1_000_000 and window("claude-haiku-4-5-20251001") == 200_000 and window("gpt") is None


def test_haiku_5_5_charges_its_long_rate_above_100k_prompt_tokens():
    short = tokens(usage(inp=100_000, out=1_000_000), "claude-haiku-5-5").cost
    long = tokens(usage(inp=100_001, out=1_000_000), "claude-haiku-5-5").cost
    assert short == pytest.approx(0.01 + 0.5) and long == pytest.approx(0.0500005 + 2.5)


def test_a_reply_counts_once_and_a_process_costs_its_cost_state_plus_what_came_after():
    ledger = Ledger()
    ledger.reply("m1", 1_000, 1, OPUS, usage(out=100_000))
    ledger.reply("m1", 1_500, 1, OPUS, usage(out=200_000))  # the same reply's later line: replaces, keeps its time
    assert ledger.turns[1].output == 200_000 and ledger.replies["m1"].at == 1_000
    assert ledger.cost(process_start=0) == (pytest.approx(4.0), True)  # nothing recorded: all estimated

    ledger.cost_state(start=0, at=2_000, total=5.0)  # Claude Code's own figure, which also counts side calls
    assert ledger.cost(0) == (5.0, False)
    ledger.reply("m2", 600_000, 2, OPUS, usage(out=50_000))
    assert ledger.cost(0) == (pytest.approx(6.0), True)
    # Another process of the same session, resumed 10 minutes in: that cost-state isn't its own.
    assert ledger.cost(process_start=590_000) == (pytest.approx(1.0), True)
    assert ledger.cost(process_start=900_000) == (None, False)


def test_a_subagents_replies_count_in_the_turn_they_happened_in(tmp_path: Path):
    ledger = Ledger()
    ledger.reply("m1", 1_000, 1, OPUS, usage(out=10))
    ledger.reply("m2", 5_000, 2, OPUS, usage(out=10))
    path = tmp_path / "agent-a.jsonl"
    message = {"id": "s1", "model": OPUS, "usage": usage(out=7)}
    reply = {"type": "assistant", "timestamp": "1970-01-01T00:00:02Z", "message": message}
    path.write_text(json.dumps(reply) + "\n" + '{"type": "assistant", "message": {"id": "s2"')  # second line unfinished
    ledger.subagent(path)
    assert ledger.turns[1].output == 17 and "s2" not in ledger.replies
    ledger.subagent(path)  # nothing new
    assert ledger.turns[1].output == 17


def test_today_adds_up_todays_replies_in_every_transcript(tmp_path: Path):
    projects = tmp_path / "projects"
    (projects / "p" / "s1" / "subagents").mkdir(parents=True)
    now = datetime.now().astimezone()
    today = now.isoformat()
    yesterday = datetime.fromtimestamp(time.time() - 2 * 86400).astimezone().isoformat()
    line = lambda mid, at, out: json.dumps(  # noqa: E731
        {"type": "assistant", "timestamp": at, "message": {"id": mid, "model": OPUS, "usage": usage(out=out)}}
    )
    main = projects / "p" / "s1.jsonl"
    lines = [line("old", yesterday, 1_000_000), line("a", today, 50_000), line("a", today, 100_000)]
    main.write_text("\n".join(lines) + "\n")
    (projects / "p" / "s1" / "subagents" / "agent-x.jsonl").write_text(line("b", today, 50_000) + "\n")
    stale = projects / "p" / "s0.jsonl"
    stale.write_text(line("c", yesterday, 1_000_000) + "\n")
    old = time.time() - 2 * 86400
    os.utime(stale, (old, old))

    t = Today(tmp_path)
    assert t.refresh(force=True) and t.usd == pytest.approx(3.0)  # 100k + 50k output tokens at $20/M
    with main.open("a") as fh:
        fh.write(line("d", today, 50_000) + "\n")
    assert t.refresh(force=True) and t.usd == pytest.approx(4.0)
    assert not t.refresh()  # read at most once a minute
