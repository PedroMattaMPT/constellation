"""Incremental reading of session transcripts.

A `Transcript` reads one `<sessionId>.jsonl` file from where it left off. It turns each line into
entries for the message tree and the conversation, and keeps the session's latest state. A
`Timeline` holds the entries of one process across every transcript it has had (`/clear` starts a
new one). The format is documented in docs/data-sources.md.
"""

from __future__ import annotations

import base64
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from ..protocol import Entry, EntryContent
from ..usage import Ledger, to_ms

SKIP_PREFIX = b'{"type":"api-request'  # raw API logs: most of a transcript's bytes, never needed
CHUNK = 8 << 20
TEXT_MAX = 200
CONTENT_MAX = 100_000

COMMAND = re.compile(r"<command-name>/?([^<]*)</command-name>")
COMMAND_ARGS = re.compile(r"<command-args>([^<]*)</command-args>")
STDOUT = re.compile(r"<local-command-stdout>(.*?)</local-command-stdout>", re.S)
PEER_BODY = re.compile(r"<cross-session-message[^>]*>\n?(.*?)\n?</cross-session-message>", re.S)
TASK_ID = re.compile(r"<task-id>([^<]+)</task-id>")
TASK_STATUS = re.compile(r"<status>([^<]+)</status>")
TASK_SUMMARY = re.compile(r"<summary>([^<]+)</summary>")
ANSI = re.compile(r"\x1b\[[0-9;]*m")
DENIED = ("The user doesn't want to proceed", "Permission for this action was denied")
INTERRUPTED = "[Request interrupted"
SKIPPED_TEXT = ("<", "/", "This session is being continued")  # reminders, caveats, slash echoes, compact summaries


def first_line(text: str | None, limit: int = TEXT_MAX) -> str:
    for line in (text or "").splitlines():
        line = line.strip()
        if line:
            return line if len(line) <= limit else line[: limit - 1] + "…"
    return ""


def block_text(content) -> str:
    """Text of a tool_result's content, which is a string or a list of blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def summarize_tool(name: str, args: dict) -> str:
    if name == "Bash":
        return first_line(args.get("description") or args.get("command"), 120)
    for key in ("file_path", "path", "pattern", "url", "query", "description", "skill", "prompt"):
        if isinstance(args.get(key), str) and args[key]:
            return first_line(args[key], 120)
    return ""


@dataclass(slots=True)
class Item:
    """An entry as kept in memory. `Entry` is its wire form."""

    id: str
    seq: int
    turn: int
    starter: bool
    kind: str
    at: str | None
    text: str
    session_id: str
    offset: int
    block: int = 0
    detail: str | None = None
    tool: str | None = None
    tool_use_id: str | None = None
    result_error: bool | None = None
    result_preview: str | None = None
    result_offset: int | None = None
    peer: str | None = None
    msg_id: str | None = None
    agent_id: str | None = None
    parent: str | None = None  # prompts: the line they continue from, where a rewind to them resumes
    abandoned: bool = False
    images: int = 0  # prompts: the images sent with it, which GET .../images/<n> returns

    def wire(self) -> Entry:
        return Entry(
            id=self.id,
            seq=self.seq,
            turn=self.turn,
            starter=self.starter,
            kind=self.kind,
            at=self.at,
            text=self.text,
            detail=self.detail,
            tool=self.tool,
            tool_use_id=self.tool_use_id,
            result_error=self.result_error,
            result_preview=self.result_preview,
            peer=self.peer,
            msg_id=self.msg_id,
            agent_id=self.agent_id,
            session_id=self.session_id,
            abandoned=self.abandoned,
            images=self.images,
        )


@dataclass
class Timeline:
    """Every entry of one process, in file order, across its transcripts."""

    items: list[Item] = field(default_factory=list)
    by_id: dict[str, Item] = field(default_factory=dict)
    turn: int = 0
    counts: Counter = field(default_factory=Counter)
    turn_sizes: Counter = field(default_factory=Counter)
    abandoned: set[int] = field(default_factory=set)  # turns on a branch a rewind left
    ledger: Ledger = field(default_factory=Ledger)  # what its replies used and cost (roadmap 4.3)

    def abandon(self, first_turn: int, changed: dict[str, Item]) -> None:
        """Marks every turn from `first_turn` to the latest as left behind by a rewind."""
        for item in reversed(self.items):
            if item.turn < first_turn:
                break
            if not item.abandoned:
                item.abandoned = True
                changed[item.id] = item
        self.abandoned.update(range(first_turn, self.turn + 1))

    def add(
        self,
        transcript: Transcript,
        kind: str,
        text: str,
        at: str | None,
        offset: int,
        line_id: str,
        starter: bool = False,
        block: int = 0,
        **extra,
    ) -> Item:
        item_id = line_id if block == 0 else f"{line_id}:{block}"
        if item_id in self.by_id:  # the same line read twice (a fork's copied history): keep the first
            return self.by_id[item_id]
        if starter:
            self.turn += 1
        item = Item(
            id=item_id,
            seq=len(self.items),
            turn=self.turn,
            starter=starter,
            kind=kind,
            at=at,
            text=text,
            session_id=transcript.session_id,
            offset=offset,
            block=block,
            **extra,
        )
        self.items.append(item)
        self.by_id[item_id] = item
        self.counts[kind] += 1
        self.turn_sizes[self.turn] += 1
        return item


class Transcript:
    def __init__(self, path: Path, session_id: str):
        self.path = path
        self.session_id = session_id
        self.offset = 0
        self.reads = 0
        # Latest state
        self.title: str | None = None
        self.ai_title: str | None = None
        self.first_prompt: str | None = None
        self.last_prompt: str | None = None
        self.permission_mode: str | None = None
        self.branch: str | None = None
        self.step: str | None = None
        self.away_summary: str | None = None
        self.away_summary_at: int | None = None  # unix ms
        self.cost_usd: float | None = None
        self.usage: dict | None = None
        self.model: str | None = None
        self.last_at: str | None = None
        self.turn_open = False
        self.compactions = 0
        self.pr_links: list[str] = []
        self.artifacts: list[str] = []
        # Links
        self.sent: list[dict] = []
        self.received: list[dict] = []
        self.agents: dict[str, dict] = {}
        self._calls: dict[str, Item] = {}
        self.settled: set[str] = set()  # tool calls whose result is written: answered, allowed or denied
        # The prompt that last continued from each parent line: a second one means a rewind.
        self._prompt_after: dict[str, Item] = {}
        self._first_prompt: Item | None = None
        self._compacted: Item | None = None  # the latest record of a /compact you ran
        self._headers: dict[str, dict] = {}  # open questions: question text -> header

    @property
    def exists(self) -> bool:
        return self.path.exists()

    def read(self, timeline: Timeline) -> list[Item]:
        """Read whatever was appended since the last call. Returns new and updated items."""
        try:
            size = self.path.stat().st_size
        except OSError:
            return []
        if size <= self.offset:
            return []
        changed: dict[str, Item] = {}
        pos = self.offset
        rest = b""
        with self.path.open("rb") as fh:
            fh.seek(pos)
            while chunk := fh.read(CHUNK):
                lines = (rest + chunk).split(b"\n")
                rest = lines.pop()  # an unfinished last line waits for the next read
                for line in lines:
                    if line and not line.startswith(SKIP_PREFIX):
                        try:
                            entry = json.loads(line)
                        except ValueError:
                            entry = None
                        if isinstance(entry, dict):
                            self._process(entry, pos, timeline, changed)
                    pos += len(line) + 1
        self.offset = pos
        self.reads += 1
        return list(changed.values())

    # ── One line ──────────────────────────────────────────────────────────

    def _process(self, e: dict, offset: int, tl: Timeline, changed: dict[str, Item]) -> None:
        kind = e.get("type")
        at = e.get("timestamp")
        if at and (self.last_at is None or at > self.last_at):
            self.last_at = at
        if e.get("gitBranch"):
            self.branch = e["gitBranch"]
        line_id = e.get("uuid") or f"{self.session_id}:{offset}"

        def add(entry_kind: str, text: str, **extra) -> Item:
            item = tl.add(self, entry_kind, text, at, offset, line_id, **extra)
            changed[item.id] = item
            return item

        if kind == "user":
            self._user(e, offset, add, tl, changed)
        elif kind == "assistant":
            self._assistant(e, add, tl)
        elif kind == "system":
            self._system(e, add, tl, changed)
        elif kind == "custom-title":
            self.title = e.get("customTitle")
        elif kind == "ai-title":
            self.ai_title = e.get("aiTitle")
        elif kind == "last-prompt":
            self.last_prompt = e.get("lastPrompt")
        elif kind == "permission-mode":
            self._mode(e.get("permissionMode"), add)
        elif kind == "cost-state":
            self.cost_usd = e.get("totalCostUSD")
            start = e.get("startTime")
            written = start + (e.get("totalDuration") or 0) if isinstance(start, int) else None
            tl.ledger.cost_state(start if isinstance(start, int) else None, written, self.cost_usd)
        elif kind == "pr-link" and e.get("prUrl") and e["prUrl"] not in self.pr_links:
            self.pr_links.append(e["prUrl"])
        elif kind == "frame-link" and e.get("frameUrl") and e["frameUrl"] not in self.artifacts:
            self.artifacts.append(e["frameUrl"])

    def _mode(self, mode: str | None, add, block: int = 0) -> None:
        """A change of mode is the design system's inline record; the first mode is just the start."""
        if mode and self.permission_mode and mode != self.permission_mode:
            add("mode", mode, block=block)
        self.permission_mode = mode or self.permission_mode

    def _user(self, e: dict, offset: int, add, tl: Timeline, changed: dict[str, Item]) -> None:
        # Terminal sessions write a permission-mode line each turn; SDK sessions only mark the prompt itself, whose
        # line then holds two rows: the record takes block -1, as no content block has that index.
        self._mode(e.get("permissionMode"), add, block=-1)
        origin = e.get("origin") or {}
        source = origin.get("kind")
        content = (e.get("message") or {}).get("content")

        if isinstance(content, str):
            if source == "peer":
                self.turn_open = True
                if origin.get("handback"):
                    agent = origin.get("senderTaskId")
                    if agent in self.agents:
                        self.agents[agent]["status"] = "reported"
                    add(
                        "subagent_reported",
                        f"{origin.get('name') or 'subagent'} reported back",
                        starter=True,
                        detail=first_line(origin.get("body")),
                        agent_id=agent,
                    )
                    return
                body = origin.get("body")
                if body is None:
                    match = PEER_BODY.search(content)
                    body = match.group(1) if match else content
                add(
                    "received",
                    first_line(body) or "(empty message)",
                    starter=True,
                    peer=origin.get("name") or origin.get("from"),
                    msg_id=origin.get("msg_id"),
                )
                if origin.get("msg_id") and origin.get("from"):
                    self.received.append(
                        {
                            "msg_id": origin["msg_id"],
                            "from": origin["from"],
                            "name": origin.get("name"),
                            "proc_start": origin.get("verifiedPeerProcStart"),
                            "at": e.get("timestamp"),
                        }
                    )
                return
            if source == "task-notification":
                self.turn_open = True
                task, status = TASK_ID.search(content), TASK_STATUS.search(content)
                summary = TASK_SUMMARY.search(content)
                text = summary.group(1) if summary else "background task finished"
                if task and task.group(1) in self.agents:
                    self.agents[task.group(1)]["status"] = "reported"
                    add(
                        "subagent_reported",
                        text,
                        starter=True,
                        agent_id=task.group(1),
                        detail=status.group(1) if status else None,
                    )
                else:
                    add("notice", text, starter=True)
                return
            command = COMMAND.search(content)
            compacted = self._compacted
            if command and command.group(1) == "compact" and compacted is not None and compacted.turn == tl.turn:
                return  # the /compact you ran is written after its record: one row says both
            if command:
                args = COMMAND_ARGS.search(content)
                add(
                    "slash",
                    "/" + command.group(1) + (" " + args.group(1).strip() if args and args.group(1).strip() else ""),
                    starter=True,
                )
            elif content.startswith("<local-command-stdout>"):
                out = STDOUT.search(content)
                text = first_line(ANSI.sub("", out.group(1) if out else ""))
                if text:
                    add("notice", text)
            elif content.startswith(INTERRUPTED):
                self.turn_open = False
                add("interrupt", "interrupted by you")
            elif not e.get("isMeta") and not content.startswith(SKIPPED_TEXT) and source in (None, "human"):
                self._prompt(first_line(content), add, e, tl, changed)
            return

        if not isinstance(content, list):
            return
        raw_result = e.get("toolUseResult")
        result = raw_result if isinstance(raw_result, dict) else {}
        texts, images = [], 0
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_result":
                self._tool_result(block, result, offset, add, changed)
            elif block.get("type") == "text":
                text = block.get("text", "")
                if text.startswith(INTERRUPTED):
                    self.turn_open = False
                    add("interrupt", "interrupted by you")
                elif not e.get("isMeta"):
                    texts.append(text)
            elif block.get("type") == "image":
                images += 1
        if (texts or images) and source in (None, "human"):
            text = first_line("\n".join(texts)) or "(image)"
            self._prompt(text, add, e, tl, changed, images=images)

    def _prompt(self, text: str, add, e: dict, tl: Timeline, changed: dict[str, Item], images: int = 0) -> None:
        if not text:
            return
        parent = e.get("parentUuid")
        replaced = self._prompt_after.get(parent) if parent else None
        if replaced is not None and not replaced.abandoned:
            tl.abandon(replaced.turn, changed)  # a rewind: the old prompt and all that followed it are left behind
            if self._first_prompt is not None and self._first_prompt.abandoned:
                self.first_prompt = self._first_prompt = None
        self.turn_open = True
        item = add("prompt", text, starter=True, parent=parent, images=images)
        if parent:
            self._prompt_after[parent] = item
        if self._first_prompt is None:
            self._first_prompt, self.first_prompt = item, text

    def _tool_result(self, block: dict, result: dict, offset: int, add, changed: dict[str, Item]) -> None:
        if block.get("tool_use_id"):
            self.settled.add(block["tool_use_id"])
        call = self._calls.pop(block.get("tool_use_id", ""), None)
        if call is None:
            return
        text = block_text(block.get("content"))
        error = bool(block.get("is_error"))
        call.result_error = error
        call.result_preview = first_line(text, 160)
        call.result_offset = offset
        changed[call.id] = call
        if call.kind == "question" and not error:
            raw_answers = result.get("answers")
            answers = raw_answers if isinstance(raw_answers, dict) else {}
            # The design system's answered record: `Session store: Redis · Rollout: dev, staging`.
            headers = self._headers.pop(call.tool_use_id or "", {})
            shown = " · ".join(
                f"{headers.get(q, q)}: {', '.join(v) if isinstance(v, list) else v}" for q, v in answers.items()
            )
            add("answer", shown or first_line(text), tool_use_id=call.tool_use_id)
        elif error and text.startswith(DENIED):
            add("denied", f"{call.tool or 'tool'} denied", detail=first_line(text, 120), tool_use_id=call.tool_use_id)
        if call.kind == "sent" and result.get("msg_id"):
            call.msg_id = result["msg_id"]
            if call.detail != "agent":
                self.sent.append({"msg_id": result["msg_id"], "to": call.peer, "summary": call.text, "at": call.at})
        elif call.kind == "subagent_started" and result.get("agentId"):
            agent = result["agentId"]
            call.agent_id = agent
            self.agents.setdefault(
                agent,
                {
                    "id": agent,
                    "type": call.detail or "general-purpose",
                    "description": result.get("description") or call.text,
                    "status": "reported" if result.get("status") == "completed" else "working",
                    "at": call.at,
                },
            )

    def _assistant(self, e: dict, add, tl: Timeline) -> None:
        message = e.get("message") or {}
        if message.get("usage") and str(message.get("model", "")).startswith("claude"):
            self.usage, self.model = message["usage"], message["model"]
            if message.get("id"):
                tl.ledger.reply(message["id"], to_ms(e.get("timestamp")), tl.turn, message["model"], message["usage"])
        for i, block in enumerate(message.get("content") or []):
            if not isinstance(block, dict):
                continue
            kind = block.get("type")
            if kind == "text" and block.get("text", "").strip():
                self.step = first_line(block["text"], 120)
                add("reply", first_line(block["text"]), block=i)
            elif kind == "thinking":
                add("thinking", first_line(block.get("thinking")) or "thinking", block=i)
            elif kind == "tool_use":
                self._tool_use(block, i, add)

    def _tool_use(self, block: dict, index: int, add) -> None:
        name, args = block.get("name") or "tool", block.get("input") or {}
        common = {"block": index, "tool": name, "tool_use_id": block.get("id")}
        if name == "AskUserQuestion":
            if block.get("id"):  # the answer's record names each question by its header
                self._headers[block["id"]] = {
                    q.get("question"): q.get("header") for q in args.get("questions") or [] if isinstance(q, dict)
                }
            questions = args.get("questions") or [{}]
            options = " / ".join(o.get("label", "") for o in questions[0].get("options") or [] if isinstance(o, dict))
            item = add(
                "question", first_line(questions[0].get("question")) or "question", detail=options or None, **common
            )
            self.step = f"asked: {item.text}"
        elif name == "SendMessage":
            to = args.get("recipient") or args.get("to")
            kind = "agent" if args.get("recipient_kind") == "agent" else None
            item = add(
                "sent",
                first_line(args.get("summary") or args.get("message") or args.get("content")) or "message",
                peer=to,
                detail=kind,
                **common,
            )
            self.step = f"message to {to}"
        elif name == "Agent":
            item = add(
                "subagent_started",
                first_line(args.get("description")) or "subagent",
                detail=args.get("subagent_type"),
                **common,
            )
            self.step = f"subagent: {item.text}"
        else:
            summary = summarize_tool(name, args)
            item = add("tool", name, detail=summary or None, **common)
            self.step = f"{name} {summary}".strip()
        if block.get("id"):
            self._calls[block["id"]] = item

    def _system(self, e: dict, add, tl: Timeline, changed: dict[str, Item]) -> None:
        subtype, content = e.get("subtype"), e.get("content") or ""
        if subtype == "turn_duration":
            self.turn_open = False
        elif subtype == "compact_boundary":
            # The design system's inline record: `/compact 182k → 41k tokens`, marked auto when you didn't run it.
            self.compactions += 1
            meta = e.get("compactMetadata") or {}
            pre, post = meta.get("preTokens"), meta.get("postTokens")
            tokens = f"{pre // 1000}k → {post // 1000}k tokens" if pre and post else None
            if pre and not post:
                tokens = f"{pre // 1000}k tokens"
            trigger = "auto" if meta.get("trigger") == "auto" else None
            detail = " · ".join(x for x in (trigger, tokens) if x) or None
            item = add("compact", "/compact", starter=True, detail=detail)
            self._compacted = None if trigger else item
        elif subtype == "away_summary":
            self.away_summary = first_line(content, 300)
            self.away_summary_at = to_ms(e.get("timestamp"))
            add("notice", first_line(content))
        elif subtype == "local_command":
            command = COMMAND.search(content)
            if command:
                args = COMMAND_ARGS.search(content)
                add(
                    "slash",
                    "/" + command.group(1) + (" " + args.group(1).strip() if args and args.group(1).strip() else ""),
                    starter=True,
                )
            else:
                out = STDOUT.search(content)
                text = first_line(ANSI.sub("", out.group(1) if out else content))
                if text:
                    add("notice", text)
        elif subtype == "scheduled_task_fire":
            add("notice", first_line(content) or "scheduled task fired", starter=True)

    # ── Full content of one entry ─────────────────────────────────────────

    def line_at(self, offset: int) -> dict:
        with self.path.open("rb") as fh:
            fh.seek(offset)
            return json.loads(fh.readline())

    def image(self, item: Item, n: int) -> tuple[str, bytes] | None:
        """The n-th image sent with a prompt: its media type and bytes."""
        try:
            blocks = (self.line_at(item.offset).get("message") or {}).get("content") or []
        except (OSError, ValueError):
            return None
        images = [b for b in blocks if isinstance(b, dict) and b.get("type") == "image"]
        source = images[n].get("source") or {} if n < len(images) else {}
        if source.get("type") != "base64" or not isinstance(source.get("data"), str):
            return None
        try:
            return source.get("media_type") or "image/png", base64.b64decode(source["data"])
        except ValueError:
            return None

    def call_input(self, item: Item) -> dict:
        """A tool call's input as written, whole (content() cuts it for display). {} when it can't be read."""
        try:
            blocks = (self.line_at(item.offset).get("message") or {}).get("content") or []
            block = blocks[item.block] if item.block < len(blocks) else {}
        except (OSError, ValueError, AttributeError, TypeError):
            return {}
        tool_input = block.get("input") if isinstance(block, dict) else None
        return tool_input if isinstance(tool_input, dict) else {}

    def content(self, item: Item) -> EntryContent:
        line = self.line_at(item.offset)
        text, tool_input, result = "", None, None
        message = line.get("message") or {}
        body = message.get("content")
        blocks = body if isinstance(body, list) else []
        block = blocks[item.block] if item.block < len(blocks) and isinstance(blocks[item.block], dict) else {}
        if item.kind in ("tool", "question", "sent", "subagent_started"):
            text = item.text
            tool_input = json.dumps(block.get("input"), indent=2, ensure_ascii=False)
            if item.result_offset is not None:
                for b in (self.line_at(item.result_offset).get("message") or {}).get("content") or []:
                    if isinstance(b, dict) and b.get("tool_use_id") == item.tool_use_id:
                        result = block_text(b.get("content"))
        elif item.kind == "reply":
            text = block.get("text", "")
        elif item.kind == "thinking":
            text = block.get("thinking", "")
        elif item.kind == "received":
            origin = line.get("origin") or {}
            text = origin.get("body") or block_text(body)
        elif line.get("type") == "system":
            text = line.get("content") or ""
        elif isinstance(body, str):
            text = body
        else:
            text = "\n".join(
                block_text([b]) for b in blocks if isinstance(b, dict) and b.get("type") in ("text", "tool_result")
            )
        truncated = any(len(x or "") > CONTENT_MAX for x in (text, tool_input, result))
        cut = lambda x: x[:CONTENT_MAX] if x else x  # noqa: E731
        return EntryContent(
            entry=item.wire(), text=cut(text) or "", input=cut(tool_input), result=cut(result), truncated=truncated
        )

    # ── Derived ───────────────────────────────────────────────────────────

    def open_calls(self) -> list[Item]:
        """Tool calls written with no result yet: running, or waiting on a question or permission prompt."""
        return list(self._calls.values())

    def context(self) -> tuple[str, int] | None:
        if not self.usage or not self.model:
            return None
        used = sum(
            self.usage.get(k, 0) or 0
            for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")
        )
        return self.model, used
