"""The live state of every running session, kept current by polling Claude Code's files.

`Collector.poll()` reads what changed since the last call and returns the events to push to
clients. It runs in a worker thread; the HTTP handlers read the same state under `lock`.
"""

from __future__ import annotations

import re
import threading
import time
from datetime import datetime
from pathlib import Path

from .claude import files
from .claude.transcript import Item, Timeline, Transcript
from .manager import QUESTION_TOOL, Manager
from .protocol import (
    Context,
    Edge,
    Endpoint,
    EntriesEvent,
    EntryContent,
    EntryPage,
    Event,
    GraphEvent,
    PendingRequest,
    Session,
    SessionEvent,
    SessionRemovedEvent,
    Snapshot,
    Subagent,
    Turn,
)

STALE_AFTER_MS = 30 * 60 * 1000  # idle this long is "stale" (design system: forgotten threshold)
WAITING_RECHECK_S = 3.0
RESET_ABOVE = 1000  # a read this big is sent as a reset: clients refetch instead
MODES = {"default", "plan", "acceptEdits", "auto", "bypassPermissions", "dontAsk"}
# Context window per model, in tokens, checked against Claude Code's own status line.
CONTEXT_WINDOW = {"claude-opus-5-5": 1_000_000, "claude-haiku-5-5": 1_000_000}
SOCKET_PID = re.compile(r"/(\d+)\.sock$")


def to_ms(timestamp: str | None) -> int | None:
    if not timestamp:
        return None
    try:
        return int(datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


class Node:
    """One running Claude Code process and the transcripts it has had."""

    def __init__(self, key: str, registry: dict, claude_dir: Path):
        self.key = key
        self.registry = registry
        self.claude_dir = claude_dir
        self.timeline = Timeline()
        self.transcripts: list[Transcript] = []
        self.meta_checked: set[str] = set()
        self.subagent_meta: dict[str, dict] = {}
        self.open(registry["sessionId"])

    @property
    def current(self) -> Transcript:
        return self.transcripts[-1]

    def open(self, session_id: str) -> None:
        path = files.transcript_path(self.registry["cwd"], session_id, self.claude_dir)
        self.transcripts.append(Transcript(path, session_id))

    def transcript(self, session_id: str) -> Transcript | None:
        return next((t for t in self.transcripts if t.session_id == session_id), None)


class Collector:
    def __init__(
        self, claude_dir: Path = files.CLAUDE_DIR, waiting_for=files.waiting_for, manager: Manager | None = None
    ):
        self.claude_dir = claude_dir
        self.manager = manager
        self.lock = threading.RLock()
        self.nodes: dict[str, Node] = {}
        self.polls = 0
        self._waiting_for = waiting_for
        self._waiting: dict[str, str] = {}
        self._waiting_checked = 0.0
        self._sent_sessions: dict[str, dict] = {}
        self._sent_graph: dict | None = None

    # ── Polling ───────────────────────────────────────────────────────────

    def poll(self) -> list[Event]:
        with self.lock:
            backlog = self.polls == 0  # the first poll reads history nobody is waiting for
            self.polls += 1
            events: list[Event] = []
            seen = set()
            for entry in files.live_registry(self.claude_dir):
                key = f"{entry['pid']}-{entry['procStart']}"
                seen.add(key)
                node = self.nodes.get(key)
                if node is None:
                    self.nodes[key] = Node(key, entry, self.claude_dir)
                else:
                    if entry["sessionId"] != node.registry["sessionId"]:  # /clear: same process, new session
                        node.registry = entry
                        node.open(entry["sessionId"])
                    node.registry = entry
            for key in [k for k in self.nodes if k not in seen]:
                del self.nodes[key]
                self._sent_sessions.pop(key, None)
                events.append(SessionRemovedEvent(id=key))

            for node in self.nodes.values():
                for transcript in node.transcripts:
                    first = transcript.reads == 0
                    changed = transcript.read(node.timeline)
                    if not changed or (backlog and first):
                        continue
                    if len(changed) > RESET_ABOVE:
                        events.append(EntriesEvent(session=node.key, entries=[], reset=True))
                    else:
                        events.append(EntriesEvent(session=node.key, entries=[i.wire() for i in changed]))
                self._load_subagent_meta(node)

            self._refresh_waiting()
            for node in self.nodes.values():
                session = self._session(node)
                dumped = session.model_dump()
                if dumped != self._sent_sessions.get(node.key):
                    self._sent_sessions[node.key] = dumped
                    events.append(SessionEvent(session=session))

            graph = self._graph()
            dumped = graph.model_dump()
            if dumped != self._sent_graph:
                self._sent_graph = dumped
                events.append(graph)
            return [] if backlog else events

    def _load_subagent_meta(self, node: Node) -> None:
        for transcript in node.transcripts:
            for agent_id in transcript.agents:
                if agent_id not in node.meta_checked:
                    meta = files.subagent_meta(transcript.path, agent_id)
                    if meta is not None:
                        node.subagent_meta[agent_id] = meta
                        node.meta_checked.add(agent_id)

    def _refresh_waiting(self) -> None:
        waiting = [n for n in self.nodes.values() if n.registry.get("status") == "waiting"]
        if not waiting:
            self._waiting = {}
            return
        missing = any(n.registry["sessionId"] not in self._waiting for n in waiting)
        if missing and time.time() - self._waiting_checked > WAITING_RECHECK_S:
            self._waiting = self._waiting_for()
            self._waiting_checked = time.time()

    # ── Wire forms ────────────────────────────────────────────────────────

    def _session(self, node: Node) -> Session:
        r, cur, tl = node.registry, node.current, node.timeline
        managed = self.manager.sessions.get(node.key) if self.manager else None
        last = max(filter(None, (to_ms(cur.last_at), r.get("statusUpdatedAt"))), default=None)
        raw = r.get("status") or "idle"
        status = "working" if raw in ("busy", "shell") else "waiting" if raw == "waiting" else "idle"
        waiting_for = self._waiting.get(r["sessionId"]) if status == "waiting" else None
        pending: list[PendingRequest] = []
        mode = cur.permission_mode
        if managed is not None:
            # The SDK stream is ahead of the files: a turn starts the moment it's sent.
            pending = [
                PendingRequest(
                    id=p.id,
                    kind="question"
                    if p.tool == QUESTION_TOOL
                    else "plan"
                    if p.tool == "ExitPlanMode"
                    else "permission",
                    tool=p.tool,
                    input=p.input,
                    rules=p.rules(),
                    at=p.at,
                )
                for p in list(managed.pending.values())
            ]
            if pending:
                status = "waiting"
                waiting_for = "input needed" if pending[0].kind == "question" else "permission prompt"
            elif managed.busy:
                status = "working"
            elif managed.error:
                status = "error"
            mode = managed.mode or mode
        if status == "idle" and last and time.time() * 1000 - last > STALE_AFTER_MS:
            status = "stale"
        context = None
        if (usage := cur.context()) is not None:
            model, used = usage
            window = CONTEXT_WINDOW.get(model)
            context = Context(
                model=model,
                used_tokens=used,
                window_tokens=window,
                percent=round(100 * used / window, 1) if window else None,
            )
        return Session(
            id=node.key,
            session_id=r["sessionId"],
            session_ids=[t.session_id for t in node.transcripts],
            pid=r["pid"],
            name=r.get("name") or Path(r["cwd"]).name,
            name_source=r.get("nameSource"),
            kind="managed" if managed is not None else "external",
            process_kind=r.get("kind") or "interactive",
            cwd=r["cwd"],
            project=Path(r["cwd"]).name,
            branch=cur.branch,
            tmux=r.get("tmux"),
            version=r.get("version"),
            started_at=r.get("startedAt") or 0,
            status=status,
            raw_status=raw,
            waiting_for=waiting_for,
            last_activity_at=last,
            mode=mode if mode in MODES else None,
            title=cur.title or cur.ai_title,
            first_prompt=cur.first_prompt,
            last_prompt=cur.last_prompt,
            step=cur.step,
            away_summary=cur.away_summary,
            context=context,
            cost_usd=managed.cost_usd if managed and managed.cost_usd is not None else cur.cost_usd,
            pr_links=cur.pr_links,
            artifacts=cur.artifacts,
            turns=tl.turn,
            entries=len(tl.items),
            counts=dict(tl.counts),
            compactions=sum(t.compactions for t in node.transcripts),
            transcript_exists=cur.exists,
            queued=[q.label() for q in list(managed.queue)] if managed else [],
            pending=pending,
            activity=managed.activity if managed else None,
            error=managed.error if managed else None,
        )

    def _graph(self) -> GraphEvent:
        by_pid = {n.registry["pid"]: n for n in self.nodes.values()}
        by_name: dict[str, list[Node]] = {}
        for n in self.nodes.values():
            by_name.setdefault(n.registry.get("name", ""), []).append(n)
        names = {
            m["from"]: m["name"] for n in self.nodes.values() for t in n.transcripts for m in t.received if m["name"]
        }
        endpoints: dict[str, Endpoint] = {}

        def resolve(address: str, proc_start: str | None = None) -> str:
            match = SOCKET_PID.search(address)
            if match:
                node = by_pid.get(int(match.group(1)))
                if node and (proc_start is None or str(proc_start) == node.registry.get("procStart")):
                    return node.key
            elif len(by_name.get(address, [])) == 1:
                return by_name[address][0].key
            label = names.get(address, address)
            endpoint = endpoints.setdefault(label, Endpoint(id="endpoint:" + label, name=label, addresses=[]))
            if address.startswith("uds:") and address not in endpoint.addresses:
                endpoint.addresses.append(address)
            return endpoint.id

        # Each side knows itself for certain and only guesses the other:
        # the receiver owns `target`, the sender owns `source`.
        messages: dict[str, dict] = {}
        for node in self.nodes.values():
            for t in node.transcripts:
                for m in t.received:
                    known = messages.setdefault(m["msg_id"], {})
                    known["target"] = node.key
                    known.setdefault("source", resolve(m["from"], m["proc_start"]))
                    known.setdefault("at", m["at"])
                for m in t.sent:
                    if not m["to"]:
                        continue
                    known = messages.setdefault(m["msg_id"], {})
                    known.update({"source": node.key, "summary": m["summary"]})
                    known.setdefault("target", resolve(m["to"]))
                    known.setdefault("at", m["at"])

        edges: dict[tuple[str, str], Edge] = {}
        for msg_id, m in messages.items():
            key = (m["source"], m["target"])
            edge = edges.get(key)
            if edge is None:
                edge = edges[key] = Edge(id=f"{key[0]}>{key[1]}", source=key[0], target=key[1], count=0, msg_ids=[])
            edge.count += 1
            edge.msg_ids.append(msg_id)
            if m.get("at") and (edge.last_at is None or m["at"] > edge.last_at):
                edge.last_at, edge.last_summary = m["at"], m.get("summary")

        subagents = []
        for node in self.nodes.values():
            for t in node.transcripts:
                for agent in t.agents.values():
                    meta = node.subagent_meta.get(agent["id"], {})
                    subagents.append(
                        Subagent(
                            id=agent["id"],
                            parent=node.key,
                            type=meta.get("agentType") or agent["type"],
                            description=meta.get("description") or agent["description"],
                            status=agent["status"],
                            at=agent["at"],
                            depth=meta.get("spawnDepth"),
                            background=meta.get("requestShape") == "background",
                        )
                    )
        used = {end for edge in edges.values() for end in (edge.source, edge.target)}
        return GraphEvent(
            edges=sorted(edges.values(), key=lambda e: e.id),
            endpoints=[e for e in endpoints.values() if e.id in used],
            subagents=subagents,
        )

    # ── Queries (HTTP) ────────────────────────────────────────────────────

    def snapshot(self) -> Snapshot:
        with self.lock:
            graph = self._graph()
            return Snapshot(
                generated_at=int(time.time() * 1000),
                sessions=[self._session(n) for n in self.nodes.values()],
                edges=graph.edges,
                endpoints=graph.endpoints,
                subagents=graph.subagents,
            )

    def page(
        self,
        key: str,
        *,
        before: int | None = None,
        after: int | None = None,
        around: str | None = None,
        turn: int | None = None,
        limit: int = 200,
    ) -> EntryPage | None:
        with self.lock:
            node = self.nodes.get(key)
            if node is None:
                return None
            items = node.timeline.items
            limit = max(1, min(limit, 2000))
            if turn is not None:
                chosen = [i for i in items if i.turn == turn][:limit]
                start = chosen[0].seq if chosen else 0
                end = chosen[-1].seq + 1 if chosen else 0
            else:
                if around is not None and around in node.timeline.by_id:
                    start = max(0, node.timeline.by_id[around].seq - limit // 2)
                elif before is not None:
                    start = max(0, min(before, len(items)) - limit)
                elif after is not None:
                    start = min(after + 1, len(items))
                else:
                    start = max(0, len(items) - limit)
                end = min(len(items), start + limit)
                if before is not None and around is None:
                    end = min(end, before)
                chosen = items[start:end]
            return EntryPage(entries=[i.wire() for i in chosen], has_before=start > 0, has_after=end < len(items))

    def turns(self, key: str) -> list[Turn] | None:
        with self.lock:
            node = self.nodes.get(key)
            if node is None:
                return None
            open_questions = {i.turn for i in node.timeline.items if i.kind == "question" and i.result_preview is None}
            sizes = node.timeline.turn_sizes
            return [
                Turn(turn=i.turn, entry=i.wire(), entries=sizes[i.turn], attention=i.turn in open_questions)
                for i in node.timeline.items
                if i.starter
            ]

    def content(self, key: str, entry_id: str) -> EntryContent | None:
        with self.lock:
            node = self.nodes.get(key)
            item: Item | None = node.timeline.by_id.get(entry_id) if node else None
            transcript = node.transcript(item.session_id) if node and item else None
        if item is None or transcript is None:
            return None
        return transcript.content(item)  # file read outside the lock
