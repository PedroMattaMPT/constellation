"""Tokens and cost (roadmap 4.3): a price table, each process's usage ledger, and today's total.

Claude Code writes each reply's `usage` to the transcript, but its own cost (`cost-state`) only at certain moments,
and per process. A process's cost here is its latest `cost-state` plus what its replies cost since, from the table
below. Checked against `cost-state` on 87 sessions: over the same span the transcript accounts for a median 93% of
the cost (Claude Code's side calls, such as titles and compaction, never reach it), and never more.
"""

from __future__ import annotations

import bisect
import json
import re
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .claude import files

# $ per million tokens: input, output, cache read. Cache writes are 1.25x input (5 minutes) or 2x (1 hour).
# From Anthropic's API reference (cached 2026-10-06); Opus 5.5 and Haiku 4.5 also match Claude Code's own cost-state.
PRICES: dict[str, tuple[float, float, float]] = {
    "claude-fable-5-1": (10, 50, 0.25),
    "claude-mythos-5-1": (10, 50, 0.25),
    "claude-fable-5": (10, 50, 1.0),
    "claude-mythos-5": (10, 50, 1.0),
    "claude-opus-5-5": (4, 20, 0.20),
    "claude-opus-5": (5, 25, 0.5),
    "claude-opus-4-8": (5, 25, 0.5),
    "claude-opus-4-7": (5, 25, 0.5),
    "claude-opus-4-6": (5, 25, 0.5),
    "claude-sonnet-5-5": (2, 10, 0.20),
    "claude-sonnet-5": (2, 10, 0.2),
    "claude-sonnet-4-6": (3, 15, 0.3),
    "claude-haiku-5-5": (0.10, 0.50, 0.01),
    "claude-haiku-4-5": (1, 5, 0.1),
}
HAIKU_LONG = (0.50, 2.50, 0.05)  # Haiku 5.5 when the prompt is over 100K tokens
HAIKU_LONG_ABOVE = 100_000
WEB_SEARCH_USD = 0.01
# Context window per model, in tokens. Every current model has 1M; Haiku 4.5 has 200K.
WINDOWS = {"claude-haiku-4-5": 200_000}
WINDOW_DEFAULT = 1_000_000
TODAY_EVERY_S = 60.0
CHUNK = 4 * 1024 * 1024  # transcripts reach gigabytes: read a piece at a time
SAME_PROCESS_MS = 120_000  # a cost-state whose start is this close to the process's start is that process's


def _key(model: str | None) -> str | None:
    model = re.sub(r"\[.*\]$", "", model or "")  # "claude-opus-5-5[1m]" in cost-state
    return next((k for k in sorted(PRICES, key=len, reverse=True) if model.startswith(k)), None)


def window(model: str | None) -> int | None:
    key = _key(model)
    return None if key is None else WINDOWS.get(key, WINDOW_DEFAULT)


@dataclass(slots=True)
class Tokens:
    input: int = 0
    cache_write: int = 0
    cache_read: int = 0
    output: int = 0
    cost: float = 0.0

    def add(self, other: Tokens, sign: int = 1) -> None:
        self.input += sign * other.input
        self.cache_write += sign * other.cache_write
        self.cache_read += sign * other.cache_read
        self.output += sign * other.output
        self.cost += sign * other.cost

    @property
    def total(self) -> int:
        return self.input + self.cache_write + self.cache_read + self.output


def tokens(usage: dict, model: str | None) -> Tokens:
    """One reply's usage, priced. An unknown model counts its tokens at no cost."""
    n = lambda k: int(usage.get(k) or 0)  # noqa: E731
    written = (usage.get("cache_creation") or {}) if isinstance(usage.get("cache_creation"), dict) else {}
    hour = int(written.get("ephemeral_1h_input_tokens") or 0)
    t = Tokens(n("input_tokens"), n("cache_creation_input_tokens"), n("cache_read_input_tokens"), n("output_tokens"))
    key = _key(model)
    if key is not None:
        price_in, price_out, price_read = PRICES[key]
        if key == "claude-haiku-5-5" and t.input + t.cache_write + t.cache_read > HAIKU_LONG_ABOVE:
            price_in, price_out, price_read = HAIKU_LONG
        five = max(0, t.cache_write - hour)
        searches = int((usage.get("server_tool_use") or {}).get("web_search_requests") or 0)
        t.cost = (
            t.input * price_in
            + t.output * price_out
            + t.cache_read * price_read
            + five * price_in * 1.25
            + hour * price_in * 2
        ) / 1e6 + searches * WEB_SEARCH_USD
    return t


@dataclass(slots=True)
class Reply:
    at: int  # unix ms
    turn: int
    model: str | None
    tokens: Tokens


@dataclass
class Ledger:
    """What one process's replies used, by message (a reply's usage is repeated on each of its lines)."""

    replies: dict[str, Reply] = field(default_factory=dict)
    turns: dict[int, Tokens] = field(default_factory=lambda: defaultdict(Tokens))
    cost_states: list[tuple[int, int, float]] = field(default_factory=list)  # (process start, written at, total $)
    turn_starts: list[tuple[int, int]] = field(default_factory=list)  # (first reply's time, turn), in order
    tails: dict[Path, int] = field(default_factory=dict)  # subagent transcripts read so far
    finished: set[str] = field(default_factory=set)  # subagents read to their end

    def reply(self, msg_id: str, at: int | None, turn: int, model: str | None, usage: dict) -> None:
        t = tokens(usage, model)
        old = self.replies.get(msg_id)
        if old is not None:
            self.turns[old.turn].add(old.tokens, -1)
            at = old.at
        at = at or int(time.time() * 1000)
        self.replies[msg_id] = Reply(at, turn, model, t)
        self.turns[turn].add(t)
        if not self.turn_starts or self.turn_starts[-1][1] < turn:
            self.turn_starts.append((at, turn))

    def subagent(self, path: Path) -> None:
        """A subagent's replies count toward its session, in the turn they happened in."""

        def one(e: dict, message: dict) -> None:
            at = to_ms(e.get("timestamp")) or int(time.time() * 1000)
            here = bisect.bisect_right(self.turn_starts, (at, float("inf"))) - 1
            turn = self.turn_starts[here][1] if here >= 0 else 0
            self.reply(message["id"], at, turn, message.get("model"), message["usage"])

        self.tails[path] = replies(path, self.tails.get(path, 0), one)

    def cost_state(self, start: int | None, at: int | None, total: float | None) -> None:
        if start is not None and total is not None:
            self.cost_states.append((start, at or int(time.time() * 1000), total))

    def since(self, start: int) -> Tokens:
        out = Tokens()
        for r in self.replies.values():
            if r.at >= start:
                out.add(r.tokens)
        return out

    def cost(self, process_start: int) -> tuple[float | None, bool]:
        """This process's cost, and whether any of it is estimated: its latest cost-state, plus replies since."""
        mine = [c for c in self.cost_states if abs(c[0] - process_start) <= SAME_PROCESS_MS]
        if mine:
            _, written, total = mine[-1]
            after = sum(r.tokens.cost for r in self.replies.values() if r.at > written)
            return total + after, after > 0
        spent = self.since(process_start)
        return (spent.cost, True) if spent.total else (None, False)


class Today:
    """Today's cost on this machine, from every transcript written to today (subagents' too). An estimate: it
    leaves out Claude Code's side calls, which never reach a transcript."""

    def __init__(self, claude_dir: Path = files.CLAUDE_DIR):
        self.projects = claude_dir / "projects"
        self.day = ""
        self.usd = 0.0
        self._files: dict[Path, tuple[int, dict[str, float]]] = {}  # path -> (offset, msg id -> cost today)
        self._checked = 0.0
        self.lock = threading.Lock()

    def refresh(self, force: bool = False) -> bool:
        """Read what was appended since the last call. Returns True if the total changed."""
        now = time.time()
        if not force and now - self._checked < TODAY_EVERY_S:
            return False
        self._checked = now
        midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        day, since_ms = midnight.date().isoformat(), int(midnight.timestamp() * 1000)
        with self.lock:
            if day != self.day:
                self.day, self._files = day, {}
            paths = [*self.projects.glob("*/*.jsonl"), *self.projects.glob("*/*/subagents/*.jsonl")]
            for path in paths:
                try:
                    stat = path.stat()
                except OSError:
                    continue
                if stat.st_mtime * 1000 < since_ms:
                    continue
                offset, costs = self._files.get(path, (0, {}))
                if stat.st_size > offset:
                    self._files[path] = (self._read(path, offset, since_ms, costs), costs)
            usd = round(sum(sum(costs.values()) for _, costs in self._files.values()), 4)
            changed, self.usd = usd != self.usd, usd
            return changed

    @staticmethod
    def _read(path: Path, offset: int, since_ms: int, costs: dict[str, float]) -> int:
        def one(e: dict, message: dict) -> None:
            at = to_ms(e.get("timestamp"))
            if at and at >= since_ms:
                costs[message["id"]] = tokens(message["usage"], message.get("model")).cost

        return replies(path, offset, one)


def replies(path: Path, offset: int, handle) -> int:
    """Calls `handle(line, message)` for each reply with usage written after `offset`, a chunk at a time.
    Returns the offset after the last complete line: an unfinished one waits for the next read."""
    try:
        fh = path.open("rb")
    except OSError:
        return offset
    with fh:
        fh.seek(offset)
        rest = b""
        while chunk := fh.read(CHUNK):
            lines = (rest + chunk).split(b"\n")
            rest = lines.pop()
            for line in lines:
                offset += len(line) + 1
                if b'"usage"' not in line or b'"assistant"' not in line:
                    continue
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                message = (e.get("message") or {}) if isinstance(e, dict) else {}
                if e.get("type") == "assistant" and message.get("usage") and message.get("id"):
                    handle(e, message)
    return offset


def to_ms(timestamp: str | None) -> int | None:
    if not timestamp:
        return None
    try:
        return int(datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None
