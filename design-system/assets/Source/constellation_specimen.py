#!/usr/bin/env python3
"""Constellation TUI specimen: the main screen and the prompt screen, built only from the generated
theme (constellation_theme.py) and constellation.tcss, with static sample data.

    python3 constellation_specimen.py                       # run it (q quits)
    python3 constellation_specimen.py --screen prompts      # permission prompt + command menu
    python3 constellation_specimen.py --shots DIR           # headless SVG + text screenshots of every theme

A reference for layout and markup conventions, not the app. Needs textual >= 2.
"""
from __future__ import annotations

import argparse
import asyncio
import io
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUILD = Path(os.environ.get("CONSTELLATION_BUILD", HERE if (HERE / "constellation_theme.py").exists() else HERE / "build"))
sys.path.insert(0, str(BUILD))

from rich.cells import cell_len  # noqa: E402
from rich.console import Console  # noqa: E402
from rich.terminal_theme import TerminalTheme  # noqa: E402
from textual.app import ComposeResult  # noqa: E402
from textual.containers import Horizontal, Vertical  # noqa: E402
from textual.widgets import Static, Tree  # noqa: E402

import constellation_theme as ct  # noqa: E402

# ----------------------------------------------------------------------------- sample data


@dataclass
class Session:
    n: int
    name: str
    project: str
    status: str
    mode: str
    branch: str
    ago: str
    task: str
    step: str
    kind: str = "managed"
    ctx: int = 30
    model: str = "opus-5.5"
    cost: str = "$0.00"
    alert: str = ""
    subagents: list[tuple[str, str]] = field(default_factory=list)


SESSIONS = [
    Session(1, "auth-refactor", "api-server", "waiting", "acceptEdits", "feat/auth-split", "12s",
            "Split the auth middleware into session + token layers", "asked: Which session store?", ctx=64, cost="$1.84"),
    Session(2, "migrations", "api-server", "waiting", "default", "feat/auth-split", "1m",
            "Write the token-table migration", "permission: Bash psql -f 0042_tokens.sql", ctx=22, cost="$0.31"),
    Session(3, "rate-limits", "api-server", "working", "auto", "main", "4s",
            "Add per-route rate limits", "Edit src/limits/route.ts", ctx=83, cost="$2.10", alert="ctx",
            subagents=[("explore", "working")]),
    Session(4, "api-docs", "api-server", "idle", "default", "docs/v2", "8m",
            "Regenerate the OpenAPI docs", "wrote docs/openapi.yaml", kind="external", model="sonnet-5.5"),
    Session(5, "flaky-tests", "api-server", "error", "default", "main", "3m",
            "Find the flaky auth test", "pytest exited 2", ctx=48, cost="$0.66"),
    Session(6, "checkout-ui", "web-app", "working", "acceptEdits", "feat/checkout", "2s",
            "Rebuild the cart summary", "Read src/checkout/Cart.tsx", ctx=37, cost="$0.92",
            subagents=[("review", "reported"), ("a11y-audit", "working")]),
    Session(7, "design-tokens", "web-app", "idle", "plan", "feat/checkout", "5m",
            "Plan the spacing scale change", "plan ready for review", ctx=18, model="sonnet-5.5"),
    Session(8, "old-spike", "web-app", "stale", "default", "spike/ssr", "3h",
            "Try streaming SSR", "replied: SSR works behind a flag", ctx=71),
    Session(9, "storybook", "web-app", "working", "default", "main", "9s",
            "Add stories for Cart", "Bash npm run storybook:build", kind="external", model="sonnet-5.5"),
    Session(10, "train-eval", "ml-pipeline", "working", "bypassPermissions", "exp/lr-sweep", "1s",
            "Sweep learning rates", "Bash python train.py --lr 3e-4", ctx=29, cost="$0.58", alert="gpu"),
    Session(11, "data-clean", "ml-pipeline", "idle", "dontAsk", "main", "6m",
            "Deduplicate the eval set", "2 calls denied", ctx=12, model="haiku-5.5"),
    Session(12, "notebook-port", "ml-pipeline", "stale", "plan", "main", "52m",
            "Port notebooks to scripts", "replied: plan in PLAN.md", kind="external"),
    Session(13, "nvim-config", "dotfiles", "idle", "default", "main", "14m",
            "Move lsp config to lazy.nvim", "replied: done, 3 files", model="haiku-5.5"),
    Session(14, "weekly-notes", "bigpicture", "working", "plan", "main", "6s",
            "Draft the weekly update", "Read notes/2026-10-26.md", ctx=33, cost="$0.27"),
    Session(15, "inbox-triage", "bigpicture", "waiting", "default", "main", "40s",
            "Triage the review queue", "asked: Which PRs need you today?", ctx=26),
]
BY_NAME = {s.name: s for s in SESSIONS}
EDGES = [("auth-refactor", "migrations", 4), ("migrations", "auth-refactor", 2), ("rate-limits", "api-docs", 1),
         ("checkout-ui", "design-tokens", 12), ("design-tokens", "storybook", 3), ("train-eval", "data-clean", 2),
         ("inbox-triage", "weekly-notes", 5)]
MODE_TOKEN = {"default": "mode-default", "plan": "mode-plan", "acceptEdits": "mode-edits", "auto": "mode-auto",
              "bypassPermissions": "mode-bypass", "dontAsk": "mode-dontask"}


# ----------------------------------------------------------------------------- markup with exact widths

def esc(text: str) -> str:
    return text.replace("[", r"\[")


def cut(text: str, width: int) -> str:
    return text if cell_len(text) <= width else text[: max(0, width - 1)] + "…"


class Line:
    """Content markup that knows its visible width."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.width = 0

    def add(self, text: str, style: str = "") -> "Line":
        if text:
            self.parts.append(f"[{style}]{esc(text)}[/]" if style else esc(text))
            self.width += cell_len(text)
        return self

    def pad(self, to: int) -> "Line":
        return self.add(" " * max(0, to - self.width))

    def extend(self, other: "Line") -> "Line":
        self.parts += other.parts
        self.width += other.width
        return self

    def __str__(self) -> str:
        return "".join(self.parts)


class Ink:
    """Styles for the current theme (truecolor, 256 or 16 colors) and glyph tier."""

    def __init__(self, app, tier: str):
        self.app, self.tier = app, tier

    def g(self, cat: str, name: str) -> str:
        return ct.glyph(cat, name, self.tier)

    def st(self, token: str, extra: str = "") -> str:
        return ct.style(self.app, token, extra)

    def status(self, ln: Line, s: Session, word: bool = True) -> Line:
        glyph = self.g("status", s.status)
        if s.status == "waiting":
            return ln.add(f" {glyph} needs you " if word else f" {glyph} ", self.st("status-waiting-fill"))
        text = glyph
        if word:
            text += " " + (f"stale {s.ago}" if s.status == "stale" else ct.label("status", s.status))
        return ln.add(text, self.st(f"status-{s.status}"))

    def mode(self, ln: Line, mode: str) -> Line:
        text = f"{self.g('mode', mode)} {ct.label('mode', mode)}"
        if mode in ("auto", "bypassPermissions"):
            return ln.add(f" {text} ", self.st(MODE_TOKEN[mode]))
        return ln.add(text, self.st(MODE_TOKEN[mode]))

    def kind(self, ln: Line, s: Session) -> Line:
        return ln.add(self.g("kind", s.kind), self.st(f"kind-{s.kind}"))

    def key(self, ln: Line, key: str, label: str) -> Line:
        return ln.add(key, self.st("focus", "bold")).add(f" {label}  ", self.st("fg-muted"))


# ----------------------------------------------------------------------------- renderers

def status_bar(ink: Ink, width: int, focused: str) -> str:
    left = Line().add(" 0 map ", ink.st("fill-brand")).add(" ").add("1 work", ink.st("fg-strong", "bold")).add(" 2 ml ", ink.st("fg-muted"))
    waiting = sum(s.status == "waiting" for s in SESSIONS)
    stale = sum(s.status == "stale" for s in SESSIONS)
    right = Line().add(" ").add(f" {ink.g('status', 'waiting')} {waiting} ", ink.st("status-waiting-fill")).add(" ")
    right.add(f"{ink.g('status', 'stale')} {stale}", ink.st("status-stale")).add("  ")
    right.add(f"{ink.g('alert', 'warning')} 2", ink.st("res-warning")).add("  $9.86 today  20:14 ", ink.st("fg-muted"))
    room = width - left.width - right.width - 2
    # Waiting sessions keep their whole name. The others share what is left, never below 3 letters.
    fixed = sum(cell_len(f" {s.n}{ink.g('status', s.status)} {s.name} ") + 1 for s in SESSIONS if s.status == "waiting")
    others = [s for s in SESSIONS if s.status != "waiting"]
    per = max(3, (room - fixed) // max(1, len(others)) - 3)
    mid = Line()
    for i, s in enumerate(SESSIONS):
        item = Line()
        glyph = ink.g("status", s.status)
        if s.status == "waiting":
            item.add(f" {s.n}{glyph} {s.name} ", ink.st("status-waiting-fill"))
        elif s.name == focused:
            item.add(f"{s.n}", "reverse").add(glyph, ink.st(f"status-{s.status}")).add(s.name[:per], ink.st("fg-strong", "bold"))
        else:
            item.add(f"{s.n}", ink.st("fg-muted")).add(glyph, ink.st(f"status-{s.status}")).add(s.name[:per], ink.st("fg"))
        if mid.width + item.width + 1 > room:
            mid.add(f"+{len(SESSIONS) - i}", ink.st("fg-muted"))
            break
        mid.extend(item).add(" ")
    line = Line().extend(left).add(" ").extend(mid)
    line.pad(width - right.width).extend(right)
    return str(line)


def map_view(ink: Ink, width: int, focused: str) -> str:
    waiting = sum(s.status == "waiting" for s in SESSIONS)
    stale = sum(s.status == "stale" for s in SESSIONS)
    head = Line().add("MAP", ink.st("fg-muted", "bold")).add(f"  {len(SESSIONS)} sessions  ", ink.st("fg-muted"))
    head.add(f" {ink.g('status', 'waiting')} {waiting} need you ", ink.st("status-waiting-fill")).add("  ")
    head.add(f"{ink.g('status', 'stale')} {stale} stale", ink.st("status-stale")).add("  ")
    head.add(f"{ink.g('status', 'error')} 1 error", ink.st("status-error"))
    key = Line().add("links ", ink.st("fg-muted"))
    for glyph, n in (("edge_light", "1"), ("edge_heavy", "3+"), ("edge_double", "10+")):
        key.add(ink.g("graph", glyph) * 2, ink.st("edge")).add(f" {n}  ", ink.st("fg-muted"))
    lines = [str(head.pad(width - key.width).extend(key))]

    # Lanes first, so the text knows how much room it has. Short links take the inner lanes.
    row_of = {s.name: i for i, s in enumerate(SESSIONS)}
    # One lane per pair of sessions: arrowheads show which way messages went, weight shows the total.
    pairs: dict[frozenset, list] = {}
    for src, dst, count in EDGES:
        pairs.setdefault(frozenset((src, dst)), []).append((src, dst, count))
    merged = []
    for group in pairs.values():
        src, dst, _ = group[0]
        total = sum(c for _, _, c in group)
        targets = {d for _, d, _ in group}
        merged.append((src, dst, total, targets))
    lanes: list[list[tuple[int, int]]] = []
    placed = []
    for src, dst, count, targets in sorted(merged, key=lambda e: abs(row_of[e[0]] - row_of[e[1]])):
        a, b = row_of[src], row_of[dst]
        lo, hi = min(a, b), max(a, b)
        lane = next((i for i, used in enumerate(lanes) if all(hi < u0 or lo > u1 for u0, u1 in used)), len(lanes))
        if lane == len(lanes):
            lanes.append([])
        lanes[lane].append((lo, hi))
        placed.append((src, dst, count, lane, targets))
    lane_w = 2 + 2 * len(lanes)
    grid = [[(" ", "") for _ in range(lane_w)] for _ in SESSIONS]
    weight = lambda c: "double" if c >= 10 else "heavy" if c >= 3 else "light"
    H = {w: ink.g("graph", f"edge_{w}") for w in ("light", "heavy", "double")}
    V = {w: ink.g("graph", f"lane_{w}") for w in ("light", "heavy", "double")}
    uni = ink.tier != "ascii"
    CORNER = {("light", "down"): "┐", ("light", "up"): "┘", ("heavy", "down"): "┓", ("heavy", "up"): "┛",
              ("double", "down"): "╗", ("double", "up"): "╝"}
    for src, dst, count, lane, targets in placed:
        a, b = row_of[src], row_of[dst]
        lo, hi = min(a, b), max(a, b)
        col = 2 + 2 * lane
        w = weight(count)
        tok = ink.st("focus") if focused in (src, dst) else ink.st("edge")
        for r in (a, b):
            for c in range(1, col):
                if grid[r][c][0] == " ":
                    grid[r][c] = (H[w], tok)
            grid[r][col] = (CORNER[(w, "down" if r == lo else "up")] if uni else "+", tok)
        for t in targets:
            grid[row_of[t]][0] = (ink.g("graph", "arrow_in"), tok)
        for r in range(lo + 1, hi):
            if grid[r][col][0] == " ":
                grid[r][col] = (V[w], tok)

    text_w = width - lane_w
    last_proj = None
    for i, s in enumerate(SESSIONS):
        sel = s.name == focused
        ln = Line()
        ln.add(ink.g("tree", "cursor") if sel else " ", ink.st("focus"))
        ln.add(cut(s.project, 12) if s.project != last_proj else "", ink.st("fg-muted", "bold")).pad(14)
        last_proj = s.project
        ink.kind(ln, s).add(" ")
        ln.add(cut(s.name, 14), ink.st("fg-strong", "bold") if s.kind == "managed" else ink.st("kind-external", "italic")).pad(31)
        ink.status(ln, s).pad(45)
        ink.mode(ln, s.mode).pad(56)
        ln.add("@" + cut(s.branch, 15), ink.st("fg-muted")).pad(73)
        ln.add(s.ago.rjust(3), ink.st("fg-muted")).add(" ")
        if s.alert:
            ln.add(f"{ink.g('alert', 'warning')}{s.alert}", ink.st("res-warning"))
        ln.pad(82)
        ln.add(f"+{len(s.subagents)}{ink.g('message', 'subagent_started')}" if s.subagents else "", ink.st("msg-subagent")).pad(86)
        room = text_w - ln.width - 1
        step_style = ink.st("fg-muted", "italic") if s.status in ("idle", "stale") else ink.st("fg")
        if s.status == "error":
            ln.add(f"{ink.g('status', 'error')} ", ink.st("status-error"))
            room -= 2
        ln.add(cut(s.step, room), step_style).pad(text_w)
        lane = "".join(f"[{tok}]{esc(ch)}[/]" if tok else ch for ch, tok in grid[i])
        lines.append(str(ln) + lane)
    return "\n".join(lines)


def pane_status(ink: Ink, s: Session, width: int) -> str:
    sep = ink.g("misc", "separator")
    filled = round(s.ctx / 100 * 8)
    level = "res-critical" if s.ctx >= 95 else "res-warning" if s.ctx >= 80 else "res-normal"
    full, track = ("█", "·") if ink.tier != "ascii" else ("#", "-")
    ln = Line()
    for parts in (("model", "branch", "ctx", "mode", "cost"), ("model", "ctx", "mode", "cost"), ("ctx", "mode")):
        ln = Line().add(" ")
        for k in parts:
            if ln.width > 1:
                ln.add(f" {sep} ", ink.st("fg-faint"))
            if k == "model":
                ln.add(s.model, ink.st("fg-muted"))
            elif k == "branch":
                ln.add("@" + cut(s.branch, 16), ink.st("fg-muted"))
            elif k == "ctx":
                ln.add("ctx ", ink.st("fg-muted")).add(full * filled, ink.st(level)).add(track * (8 - filled), ink.st("res-track"))
                ln.add(f" {s.ctx}%", ink.st(level))
                if level != "res-normal":
                    ln.add(" " + ink.g("alert", "warning" if level == "res-warning" else "critical"), ink.st(level))
            elif k == "mode":
                ink.mode(ln, s.mode)
            elif k == "cost":
                ln.add(s.cost, ink.st("fg-muted"))
        ln.add(" ")
        if ln.width <= width:
            break
    return str(ln)


def pane_title(ink: Ink, s: Session, focused: bool) -> str:
    ln = Line().add(" ")
    ln.add(f"{s.n} {s.name}", ink.st("fg-strong", "bold") if focused else ink.st("fg"))
    ln.add(" ")
    ink.kind(ln, s).add(f" {s.project} ", ink.st("fg-muted"))
    ink.status(ln, s)
    return str(ln.add(" "))


# ----------------------------------------------------------------------------- widgets

class StatusBar(Static):
    pass


class MapView(Static):
    pass


class SessionPane(Vertical):
    pass


class PromptBox(Static, can_focus=True):
    pass


class QuestionCard(Static):
    pass


class PermissionCard(Static):
    pass


class CommandMenu(Static):
    pass


class MessageTree(Tree):
    """Tree labels are Rich markup, so $tokens are resolved against the theme first."""

    def process_label(self, label):
        if isinstance(label, str):
            label = ct.resolve(self.app, label)
        return super().process_label(label)


# ----------------------------------------------------------------------------- app

class Specimen(ct.ConstellationApp):
    CSS_PATH = str(BUILD / "constellation.tcss")
    CSS = """
    #map { height: auto; padding: 0 1; }
    #panes { height: 1fr; }
    CommandMenu { height: auto; margin: 0 2 0 2; }
    """
    TITLE = "constellation"
    BINDINGS = [("q", "quit", "quit")]

    def __init__(self, theme: str | None = None, tier: str | None = None, screen_name: str = "main"):
        super().__init__()
        self._theme_name, self.tier, self.screen_name = theme, tier or ct.glyph_tier(), screen_name

    def compose(self) -> ComposeResult:
        yield StatusBar(id="status-bar")
        if self.screen_name == "main":
            with Horizontal(id="body"):
                yield MessageTree("sessions", id="tree")
                with Vertical():
                    yield from self.main_right()
        else:
            yield from self.prompt_panes()

    def main_right(self) -> ComposeResult:
        if True:
                yield MapView(id="map")
                with Horizontal(id="panes"):
                    with SessionPane(id="pane-a"):
                        yield Static(id="conv-a", classes="conversation")
                        yield QuestionCard(id="question")
                        yield PromptBox(id="prompt-a")
                    with SessionPane(id="pane-b"):
                        yield Static(id="conv-b", classes="conversation")
                        yield PromptBox(id="prompt-b")

    def prompt_panes(self) -> ComposeResult:
        if True:
            with Horizontal(id="panes"):
                with SessionPane(id="pane-a"):
                    yield Static(id="conv-a", classes="conversation")
                    yield PermissionCard(id="permission")
                    yield PromptBox(id="prompt-a")
                with SessionPane(id="pane-b"):
                    yield Static(id="conv-b", classes="conversation")
                    yield CommandMenu(id="menu")
                    yield PromptBox(id="prompt-b")

    def on_mount(self) -> None:
        if self._theme_name:
            self.theme = self._theme_name
        self.call_after_refresh(self.paint)

    def on_resize(self) -> None:
        self.call_after_refresh(self.paint)

    def paint(self) -> None:
        ink = Ink(self, self.tier)
        width = self.size.width
        focused = "auth-refactor" if self.screen_name == "main" else "migrations"
        self.query_one(StatusBar).update(status_bar(ink, width, focused))
        if self.screen_name == "main":
            self.query_one(MapView).update(map_view(ink, width - 34 - 2, focused))
            self.paint_tree(ink)
            self.paint_main_panes(ink)
        else:
            self.paint_prompt_panes(ink)

    # -- tree
    def paint_tree(self, ink: Ink) -> None:
        tree = self.query_one(MessageTree)
        if ink.tier == "ascii":
            tree.ICON_NODE, tree.ICON_NODE_EXPANDED = "+ ", "- "
            tree.LINES = {k: ("    ", "|   ", "`-- ", "|-- ") for k in tree.LINES}
        else:
            tree.ICON_NODE, tree.ICON_NODE_EXPANDED = "▸ ", "▾ "
        tree.clear()
        tree.show_root = False
        tree.guide_depth = 2
        tree.root.expand()
        g, st = ink.g, ink.st
        projects: dict[str, list[Session]] = {}
        for s in SESSIONS:
            projects.setdefault(s.project, []).append(s)
        q = None
        for proj, sessions in projects.items():
            pl = Line().add(g("message", "project") + " ", st("fg-muted")).add(proj, st("fg", "bold")).add(f" {len(sessions)}", st("fg-muted"))
            pnode = tree.root.add(str(pl), expand=proj == "api-server")
            for s in sessions:
                sl = Line()
                ink.kind(sl, s).add(" ")
                sl.add(s.name, st("fg-strong", "bold") if s.kind == "managed" else st("kind-external", "italic")).add(" ")
                ink.status(sl, s, word=False)
                snode = pnode.add(str(sl), expand=s.name == "auth-refactor")
                if s.name != "auth-refactor":
                    snode.add_leaf(str(Line().add("…", st("fg-muted"))))
                    continue
                t1 = snode.add(str(Line().add(f"{g('message', 'prompt')} 1 ", st("msg-prompt", "bold")).add("Split the auth midd…", st("fg"))))
                t1.add_leaf(str(Line().add(f"{g('message', 'tool')} Read", st("msg-tool")).add(" src/auth/index.ts", st("fg-muted"))))
                t2 = snode.add(str(Line().add(f"{g('message', 'prompt')} 2 ", st("msg-prompt", "bold")).add("Go ahead, keep the…", st("fg"))), expand=True)
                rows = [
                    (f"{g('message', 'slash')}compact", "msg-slash", " 182k→41k"),
                    (f"{g('message', 'tool')} Edit", "msg-tool", " session.ts"),
                    (f"{g('message', 'sent')} migrations", "msg-sent", " tokens tbl?"),
                    (f"{g('message', 'received')} migrations", "msg-received", " 0042 ok"),
                    (f"{g('message', 'subagent_started')} explore", "msg-subagent", " callers"),
                    (f"{g('message', 'subagent_reported')} explore", "msg-subagent", " 14 found"),
                ]
                for text, tok, meta in rows:
                    t2.add_leaf(str(Line().add(text, st(tok, "bold" if tok == "msg-slash" else "")).add(meta, st("fg-muted"))))
                q = t2.add_leaf(str(Line().add(f"{g('message', 'question')} Which session store?", st("msg-question", "bold"))))
        if q is not None:
            self.call_after_refresh(lambda: tree.move_cursor(q))

    # -- main screen panes
    def paint_main_panes(self, ink: Ink) -> None:
        g, st = ink.g, ink.st
        a, b = BY_NAME["auth-refactor"], BY_NAME["rate-limits"]
        pa, pb = self.query_one("#pane-a", SessionPane), self.query_one("#pane-b", SessionPane)
        pa.border_title = pane_title(ink, a, True)
        pb.border_title = pane_title(ink, b, False)
        pa.border_subtitle = pane_status(ink, a, pa.size.width - 4)
        pb.border_subtitle = pane_status(ink, b, pb.size.width - 4)
        conv = [
            Line().add(f"{g('message', 'prompt')} Go ahead, keep the public API the same.", st("msg-prompt", "bold")),
            Line().add(f"{g('message', 'slash')}compact", st("msg-slash", "bold")).add("  182k → 41k tokens", st("fg-muted")),
            Line().add(f"{g('message', 'tool')} Edit", st("msg-tool")).add(" src/auth/session.ts  ", st("fg-muted")).add("+48", st("msg-answer")).add(" ").add("−12", st("msg-denied")),
            Line().add(f"{g('message', 'sent')} migrations", st("msg-sent")).add("  We need a tokens table, see schema", st("fg-muted")),
            Line().add(f"{g('message', 'received')} migrations", st("msg-received")).add("  0042_tokens.sql drafted", st("fg-muted")),
            Line().add(f"{g('message', 'reply')} ", st("msg-reply")).add("The token layer is in place. Before I move the", st("fg")),
            Line().add("  sessions over, one decision:", st("fg")),
        ]
        self.query_one("#conv-a", Static).update("\n".join(map(str, conv)))
        q = self.query_one(QuestionCard)
        q.border_title = str(Line().add(f" {g('status', 'waiting')} Session store ").add(" 1/2 ", "not bold"))
        hint = Line()
        for k, l in (("1-3", "pick"), ("o", "other"), ("tab", "next"), ("esc", "later")):
            ink.key(hint, k, l)
        q.border_subtitle = str(hint)
        opts = [
            Line().add(g("tree", "cursor"), st("focus")).add(f" {g('misc', 'radio_on')} 1 Redis      ", st("fg-strong", "bold")).add("already in docker-compose", st("fg-muted")),
            Line().add(f"  {g('misc', 'radio_off')} 2 Postgres   ", st("fg")).add("one less service to run", st("fg-muted")),
            Line().add(f"  {g('misc', 'radio_off')} 3 In-memory  ", st("fg")).add("tests only", st("fg-muted")),
            Line().add(f"  {g('misc', 'radio_off')} o Other…", st("fg-muted")),
        ]
        q.update("\n".join([str(Line().add("Which session store should the token layer use?", st("fg-strong", "bold")))] + list(map(str, opts))))
        self.query_one("#prompt-a", PromptBox).update(str(Line().add(g("message", "prompt") + " ", st("msg-prompt", "bold")).add("answer above, or type to reply…", st("fg-faint", "italic"))))
        spin = ct.GLYPHS["spinner"]["ascii" if ink.tier == "ascii" else "unicode"][1]
        conv_b = [
            Line().add(f"{g('message', 'prompt')} Limit /login to 5/min per IP.", st("msg-prompt", "bold")),
            Line().add(f"{g('message', 'tool')} Agent", st("msg-tool")).add(" explore: where are limits set?", st("fg-muted")),
            Line().add(f"  {g('message', 'subagent_started')} explore", st("msg-subagent")).add("  working · 6 tools", st("fg-muted")),
            Line().add(f"{g('message', 'tool')} Read", st("msg-tool")).add(" src/limits/index.ts", st("fg-muted")),
            Line().add(f"{g('message', 'tool')} Edit", st("msg-tool")).add(" src/limits/route.ts  ", st("fg-muted")).add("+31", st("msg-answer")),
            Line(),
            Line().add(spin + " Editing src/limits/route.ts", st("status-working")).add("  4s · esc interrupts", st("fg-muted")),
        ]
        self.query_one("#conv-b", Static).update("\n".join(map(str, conv_b)))
        self.query_one("#prompt-b", PromptBox).update(str(Line().add(g("message", "prompt") + " ", st("msg-prompt", "bold")).add("queue a message…", st("fg-faint", "italic"))))
        self.query_one("#prompt-a", PromptBox).focus()

    # -- prompt screen: permission + command menu
    def paint_prompt_panes(self, ink: Ink) -> None:
        g, st = ink.g, ink.st
        a, b = BY_NAME["migrations"], BY_NAME["weekly-notes"]
        pa, pb = self.query_one("#pane-a", SessionPane), self.query_one("#pane-b", SessionPane)
        pa.border_title = pane_title(ink, a, True)
        pb.border_title = pane_title(ink, b, False)
        pa.border_subtitle = pane_status(ink, a, pa.size.width - 4)
        pb.border_subtitle = pane_status(ink, b, pb.size.width - 4)
        self.query_one("#conv-a", Static).update("\n".join(map(str, [
            Line().add(f"{g('message', 'prompt')} Write the token-table migration, then apply it.", st("msg-prompt", "bold")),
            Line().add(f"{g('message', 'tool')} Write", st("msg-tool")).add(" migrations/0042_tokens.sql  ", st("fg-muted")).add("+22", st("msg-answer")),
            Line().add(f"{g('message', 'reply')} ", st("msg-reply")).add("Written. Applying it to the local database:", st("fg")),
        ])))
        p = self.query_one(PermissionCard)
        p.border_title = str(Line().add(f" {g('status', 'waiting')} Bash ").add(" wants to run a command ", "not bold"))
        hint = Line()
        for k, l in (("y", "allow"), ("a", "always"), ("e", "edit"), ("n", "deny"), ("esc", "later")):
            ink.key(hint, k, l)
        p.border_subtitle = str(hint)
        p.update("\n".join(map(str, [
            Line().add("$ ", st("fg-muted")).add("psql -d app_dev -f migrations/0042_tokens.sql", st("fg-strong", "bold")),
            Line().add("in ~/code/api-server · writes to the database app_dev", st("fg-muted")),
            Line(),
            Line().add(g("tree", "cursor"), st("focus")).add(" 1 Allow once", st("fg-strong", "bold")),
            Line().add("  2 Allow and remember  ", st("fg")).add("Bash(psql -d app_dev:*)", st("fg-muted")),
            Line().add("  3 Allow with changes…", st("fg")),
            Line().add("  4 Deny, and say why…", st("msg-denied")),
        ])))
        self.query_one("#prompt-a", PromptBox).update(str(Line().add(g("message", "prompt") + " ", st("msg-prompt", "bold")).add("answer above, or type to reply…", st("fg-faint", "italic"))))
        self.query_one("#conv-b", Static).update("\n".join(map(str, [
            Line().add(f"{g('message', 'prompt')} Draft the weekly update from this week's notes.", st("msg-prompt", "bold")),
            Line().add(f"{g('message', 'tool')} Read", st("msg-tool")).add(" notes/2026-10-26.md", st("fg-muted")),
            Line().add(f"{g('message', 'received')} inbox-triage", st("msg-received")).add("  3 PRs need review by Friday", st("fg-muted")),
        ])))
        m = self.query_one(CommandMenu)
        m.border_title = str(Line().add(" / ", st("fg-strong", "bold")).add("5 of 41 ", st("fg-muted")))
        m.border_subtitle = str(ink.key(ink.key(ink.key(Line(), "↑↓", "move"), "tab", "complete"), "enter", "run"))
        items = [
            ("compact", "built-in", "Summarise to free context", True),
            ("context", "built-in", "What fills the context window", False),
            ("config", "built-in", "Set a key: /config key=value", False),
            ("code-review", "skill", "Review the current diff", False),
            ("commit", "command", "~/.claude/commands/commit.md", False),
        ]
        rows = []
        for name, src, desc, hi in items:
            ln = Line().add(g("tree", "cursor") if hi else " ", st("focus"))
            ln.add(f" /{name}", st("fg-strong", "bold") if hi else st("fg")).pad(15)
            ln.add(src.ljust(10), st("fg-muted"))
            ln.add(cut(desc, 30), st("fg") if hi else st("fg-muted"))
            rows.append(str(ln))
        m.update("\n".join(rows))
        self.query_one("#prompt-b", PromptBox).update(str(Line().add(g("message", "prompt") + " ", st("msg-prompt", "bold")).add("/co", st("fg-strong"))))
        self.query_one("#prompt-a", PromptBox).focus()


# ----------------------------------------------------------------------------- screenshots

SOLARIZED_NORMAL = [(0x07, 0x36, 0x42), (0xdc, 0x32, 0x2f), (0x85, 0x99, 0x00), (0xb5, 0x89, 0x00),
                    (0x26, 0x8b, 0xd2), (0xd3, 0x36, 0x82), (0x2a, 0xa1, 0x98), (0xee, 0xe8, 0xd5)]
SOLARIZED_BRIGHT = [(0x00, 0x2b, 0x36), (0xcb, 0x4b, 0x16), (0x58, 0x6e, 0x75), (0x65, 0x7b, 0x83),
                    (0x83, 0x94, 0x96), (0x6c, 0x71, 0xc4), (0x93, 0xa1, 0xa1), (0xfd, 0xf6, 0xe3)]
# Solarized maps most bright colors to its grays: the reason the 16-color theme uses only the normal six.
SOLARIZED_DARK = TerminalTheme((0x00, 0x2b, 0x36), (0x83, 0x94, 0x96), SOLARIZED_NORMAL, SOLARIZED_BRIGHT)
SOLARIZED_LIGHT = TerminalTheme((0xfd, 0xf6, 0xe3), (0x65, 0x7b, 0x83), SOLARIZED_NORMAL, SOLARIZED_BRIGHT)


def capture(app, color_system: str, terminal_theme: TerminalTheme | None, title: str) -> tuple[str, str]:
    width, height = app.size
    console = Console(width=width, height=height, file=io.StringIO(), force_terminal=True, color_system=color_system,
                      record=True, legacy_windows=False, safe_box=False)
    console.print(app.screen._compositor.render_update(full=True, screen_stack=app._background_screens))
    text = console.export_text(clear=False)
    svg = console.export_svg(title=title, theme=terminal_theme) if terminal_theme else console.export_svg(title=title)
    return svg, text


async def shots(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("main-dark", "main", "constellation-dark", "truecolor", None, "unicode"),
        ("main-light", "main", "constellation-light", "truecolor", None, "unicode"),
        ("main-dark-256", "main", "constellation-dark-256", "256", None, "unicode"),
        ("main-16-solarized-dark", "main", "constellation-ansi", "standard", SOLARIZED_DARK, "unicode"),
        ("main-16-solarized-light", "main", "constellation-ansi", "standard", SOLARIZED_LIGHT, "unicode"),
        ("main-ascii", "main", "constellation-dark", "truecolor", None, "ascii"),
        ("prompts-dark", "prompts", "constellation-dark", "truecolor", None, "unicode"),
        ("prompts-light", "prompts", "constellation-light", "truecolor", None, "unicode"),
    ]
    for name, screen, theme, system, tt, tier in jobs:
        app = Specimen(theme=theme, tier=tier, screen_name=screen)
        async with app.run_test(size=(160, 46) if screen == "main" else (132, 26)) as pilot:
            for _ in range(2):
                await pilot.pause()
                app.paint()
            await pilot.pause()
            svg, text = capture(app, system, tt, f"constellation · {name}")
            (out / f"{name}.svg").write_text(svg, encoding="utf-8")
            (out / f"{name}.txt").write_text(text, encoding="utf-8")
            print("wrote", name)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", help="write screenshots to this folder instead of running")
    ap.add_argument("--screen", default="main", choices=["main", "prompts"])
    args = ap.parse_args()
    if args.shots:
        asyncio.run(shots(Path(args.shots)))
    else:
        Specimen(screen_name=args.screen).run()
