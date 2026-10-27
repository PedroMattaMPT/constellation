#!/usr/bin/env python3
"""Read-only snapshot of every running Claude Code session on this machine.

Prints one JSON object with three lists: sessions, message edges between them,
and subagents. It reads Claude Code's own files under ~/.claude and the process
table, and changes nothing. Formats were checked against Claude Code 2.1.310
and 2.1.311; see docs/data-sources.md.

    python3 -I research/probe.py                  # everything
    python3 -I research/probe.py --only ~/github  # sessions under a folder
    python3 -I research/probe.py --no-agents      # skip `claude agents --json`
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from collections import defaultdict
from pathlib import Path

CLAUDE = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude"))
PAGE_SIZE = os.sysconf("SC_PAGE_SIZE")

# Context window per model, in tokens. Checked against Claude Code's own status line.
CONTEXT_WINDOW = {"claude-opus-5-5": 1_000_000, "claude-haiku-5-5": 1_000_000}

SKIP_PREFIX = b'{"type":"api-request'  # raw API logs: most of a transcript's bytes, never needed
TASK_ID = re.compile(r"<task-id>([^<]+)</task-id>")
TASK_STATUS = re.compile(r"<status>([^<]+)</status>")


def transcript_path(cwd: str, session_id: str) -> Path:
    """Claude Code names a project folder after its cwd, with every non-alphanumeric as '-'."""
    return CLAUDE / "projects" / re.sub(r"[^A-Za-z0-9]", "-", cwd) / f"{session_id}.jsonl"


def proc_start(pid: int) -> str | None:
    """Field 22 of /proc/<pid>/stat: start time in clock ticks. Guards against pid reuse."""
    try:
        return Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[19]
    except (OSError, IndexError):
        return None


def process_tree(pid: int) -> list[int]:
    pids = [pid]
    try:
        children = Path(f"/proc/{pid}/task/{pid}/children").read_text().split()
    except OSError:
        return pids
    for child in children:
        pids += process_tree(int(child))
    return pids


def rss_bytes(pid: int) -> int:
    try:
        return int(Path(f"/proc/{pid}/statm").read_text().split()[1]) * PAGE_SIZE
    except (OSError, IndexError):
        return 0


def gpu_memory_by_pid() -> dict[int, int]:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        ).stdout
    except (OSError, subprocess.TimeoutExpired):
        return {}
    usage = {}
    for line in out.splitlines():
        pid, _, mib = line.partition(",")
        if pid.strip().isdigit() and mib.strip().isdigit():
            usage[int(pid)] = int(mib) * 1024 * 1024
    return usage


def live_registry() -> list[dict]:
    """~/.claude/sessions/<pid>.json, keeping only entries whose process is still the same one."""
    sessions = []
    for path in (CLAUDE / "sessions").glob("*.json"):
        try:
            entry = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if proc_start(entry.get("pid", 0)) == entry.get("procStart"):
            sessions.append(entry)
    return sessions


def agents_by_session() -> dict[str, dict]:
    try:
        out = subprocess.run(["claude", "agents", "--json", "--all"], capture_output=True, text=True, timeout=10).stdout
        return {a["sessionId"]: a for a in json.loads(out) if a.get("sessionId")}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return {}


def summarize_tool(name: str, args: dict) -> str:
    if name == "Bash":
        return args.get("description") or args.get("command", "")[:80]
    for key in ("file_path", "path", "pattern", "url", "query", "description", "skill", "to"):
        if args.get(key):
            return f"{name} {args[key]}"[:100]
    return name


class TranscriptScan:
    """One pass over a transcript, keeping the latest value of everything the map shows."""

    def __init__(self, path: Path):
        self.path = path
        self.exists = path.exists()
        self.bytes = path.stat().st_size if self.exists else 0
        self.title = None
        self.ai_title = None
        self.last_prompt = None
        self.permission_mode = None
        self.away_summary = None
        self.latest_step = None
        self.turn_open = False
        self.cost_usd = None
        self.usage = None
        self.model = None
        self.compactions = 0
        self.pr_links: list[str] = []
        self.received: list[dict] = []
        self.sent: list[dict] = []
        self.agents: dict[str, dict] = {}
        self._send_calls: dict[str, dict] = {}
        self._agent_calls: dict[str, dict] = {}
        if self.exists:
            self._scan()

    def _scan(self) -> None:
        with self.path.open("rb") as fh:
            for raw in fh:
                if raw.startswith(SKIP_PREFIX):
                    continue
                try:
                    entry = json.loads(raw)
                except ValueError:
                    continue  # a half-written last line
                handler = getattr(self, "_on_" + str(entry.get("type", "")).replace("-", "_"), None)
                if handler:
                    handler(entry)

    def _on_custom_title(self, e): self.title = e.get("customTitle")
    def _on_ai_title(self, e): self.ai_title = e.get("aiTitle")
    def _on_last_prompt(self, e): self.last_prompt = e.get("lastPrompt")
    def _on_permission_mode(self, e): self.permission_mode = e.get("permissionMode")
    def _on_cost_state(self, e): self.cost_usd = e.get("totalCostUSD")
    def _on_pr_link(self, e): self.pr_links.append(e.get("prUrl"))

    def _on_system(self, e):
        subtype = e.get("subtype")
        if subtype == "turn_duration":
            self.turn_open = False
        elif subtype == "compact_boundary":
            self.compactions += 1
        elif subtype == "away_summary":
            self.away_summary = e.get("content")

    def _on_assistant(self, e):
        message = e.get("message") or {}
        if message.get("usage") and str(message.get("model", "")).startswith("claude"):
            self.usage, self.model = message["usage"], message["model"]
        for block in message.get("content") or []:
            if block.get("type") == "tool_use":
                name, args = block.get("name"), block.get("input") or {}
                self.latest_step = {"kind": "tool", "tool": name, "summary": summarize_tool(name, args), "at": e.get("timestamp")}
                if name == "SendMessage":
                    self._send_calls[block["id"]] = args
                elif name == "Agent":
                    self._agent_calls[block["id"]] = args
            elif block.get("type") == "text" and block.get("text", "").strip():
                self.latest_step = {"kind": "reply", "summary": block["text"].strip().splitlines()[0][:100], "at": e.get("timestamp")}

    def _on_user(self, e):
        origin = e.get("origin") or {}
        message = e.get("message") or {}
        content = message.get("content")
        if origin.get("kind") in ("human", "peer", "task-notification"):
            self.turn_open = True
        if origin.get("kind") == "peer" and origin.get("handback"):
            if origin.get("senderTaskId") in self.agents:
                self.agents[origin["senderTaskId"]]["status"] = "reported"
        elif origin.get("kind") == "peer" and origin.get("msg_id"):
            self.received.append({
                "msgId": origin["msg_id"], "from": origin.get("from"), "fromName": origin.get("name"),
                "verifiedPid": origin.get("verifiedPeerPid"), "verifiedProcStart": origin.get("verifiedPeerProcStart"),
                "at": e.get("timestamp"),
            })
        if origin.get("kind") == "task-notification":
            text = content if isinstance(content, str) else " ".join(
                b.get("text", "") for b in content or [] if isinstance(b, dict))
            task, status = TASK_ID.search(text), TASK_STATUS.search(text)
            if task and task.group(1) in self.agents:
                self.agents[task.group(1)]["status"] = status.group(1) if status else "notified"
        if isinstance(content, str) and content.startswith("[Request interrupted"):
            self.turn_open = False
        if not isinstance(content, list):
            return
        result = e.get("toolUseResult") if isinstance(e.get("toolUseResult"), dict) else {}
        for block in content:
            if block.get("type") != "tool_result":
                continue
            call = block.get("tool_use_id")
            if call in self._send_calls and result.get("msg_id"):
                args = self._send_calls.pop(call)
                self.sent.append({
                    "msgId": result["msg_id"], "to": args.get("recipient") or args.get("to"),
                    "recipientKind": args.get("recipient_kind"), "summary": args.get("summary"),
                    "at": e.get("timestamp"),
                })
            elif call in self._agent_calls and result.get("agentId"):
                args = self._agent_calls.pop(call)
                self.agents[result["agentId"]] = {
                    "agentId": result["agentId"], "type": args.get("subagent_type") or "general-purpose",
                    "description": result.get("description") or args.get("description"),
                    "status": result.get("status"), "at": e.get("timestamp"),
                }

    def context(self) -> dict | None:
        if not self.usage:
            return None
        used = sum(self.usage.get(k, 0) for k in
                   ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens"))
        window = CONTEXT_WINDOW.get(self.model or "")
        return {"model": self.model, "usedTokens": used, "windowTokens": window,
                "percent": round(100 * used / window, 1) if window else None}


def subagent_meta(transcript: Path) -> dict[str, dict]:
    meta = {}
    for path in transcript.with_suffix("").joinpath("subagents").glob("agent-*.meta.json"):
        try:
            meta[path.name[len("agent-"):-len(".meta.json")]] = json.loads(path.read_text())
        except (OSError, ValueError):
            pass
    return meta


def snapshot(only: str | None, use_agents: bool) -> dict:
    started = time.time()
    everyone = live_registry()
    registry = [r for r in everyone if not only or r["cwd"].startswith(only)]
    agents = agents_by_session() if use_agents else {}
    gpu = gpu_memory_by_pid()
    by_pid = {r["pid"]: r for r in everyone}
    by_name: dict[str, list[dict]] = defaultdict(list)
    for r in everyone:
        by_name[r.get("name", "")].append(r)

    def resolve(address: str, proc_start_hint: str | None = None) -> str | None:
        """A peer address (uds:/…/<pid>.sock) or a session name -> a live session id."""
        match = re.search(r"/(\d+)\.sock$", address)
        if match:
            entry = by_pid.get(int(match.group(1)))
            if entry and (proc_start_hint is None or str(proc_start_hint) == entry.get("procStart")):
                return entry["sessionId"]
            return None
        named = by_name.get(address, [])
        return named[0]["sessionId"] if len(named) == 1 else None

    sessions, subagents, scans = [], [], []
    for r in registry:
        scan = TranscriptScan(transcript_path(r["cwd"], r["sessionId"]))
        tree = process_tree(r["pid"])
        agent = agents.get(r["sessionId"], {})
        sessions.append({
            "id": r["sessionId"], "pid": r["pid"], "name": r.get("name"), "nameSource": r.get("nameSource"),
            "kind": r.get("kind"), "cwd": r["cwd"], "project": Path(r["cwd"]).name, "tmux": r.get("tmux"),
            "version": r.get("version"), "startedAt": r.get("startedAt"),
            "status": r.get("status"), "statusAt": r.get("statusUpdatedAt"), "waitingFor": agent.get("waitingFor"),
            "title": scan.title or scan.ai_title, "lastPrompt": scan.last_prompt,
            "permissionMode": scan.permission_mode, "latestStep": scan.latest_step, "turnOpen": scan.turn_open,
            "awaySummary": scan.away_summary, "costUSD": scan.cost_usd, "context": scan.context(),
            "compactions": scan.compactions, "prLinks": scan.pr_links,
            "transcript": {"path": str(scan.path), "exists": scan.exists, "bytes": scan.bytes},
            "processes": {"count": len(tree), "rssBytes": sum(map(rss_bytes, tree)),
                          "gpuBytes": sum(gpu.get(p, 0) for p in tree)},
        })
        meta = subagent_meta(scan.path)
        for agent_id, info in scan.agents.items():
            m = meta.get(agent_id, {})
            subagents.append({"parent": r["sessionId"], **info, "type": m.get("agentType", info["type"]),
                              "depth": m.get("spawnDepth"), "background": m.get("requestShape") == "background"})
        scans.append((r["sessionId"], scan))

    # Peers that are no longer running become endpoints, named from any message that carried their name.
    names = {m["from"]: m["fromName"] for _, scan in scans for m in scan.received if m["from"] and m["fromName"]}
    endpoints: dict[str, dict] = {}

    def node(address: str, proc_start_hint: str | None = None) -> str:
        session = resolve(address, proc_start_hint)
        if session:
            return session
        label = names.get(address, address)
        endpoint = endpoints.setdefault("endpoint:" + label, {"id": "endpoint:" + label, "name": label, "addresses": []})
        if address.startswith("uds:") and address not in endpoint["addresses"]:
            endpoint["addresses"].append(address)
        return endpoint["id"]

    messages: dict[str, dict] = {}
    for session_id, scan in scans:
        for msg in scan.received:
            if msg["from"]:
                messages.setdefault(msg["msgId"], {}).update(
                    {"to": session_id, "from": node(msg["from"], msg["verifiedProcStart"]), "at": msg["at"]})
        for msg in scan.sent:
            if msg["recipientKind"] == "agent" or not msg["to"]:
                continue  # a message to one of this session's own subagents
            known = messages.setdefault(msg["msgId"], {})
            known.setdefault("to", node(msg["to"]))
            known.update({"from": session_id, "summary": msg["summary"]})
            known.setdefault("at", msg["at"])

    edges: dict[tuple, dict] = {}
    for msg_id, msg in messages.items():
        key = (msg.get("from"), msg.get("to"))
        edge = edges.setdefault(key, {"from": key[0], "to": key[1], "count": 0, "lastAt": None, "msgIds": []})
        edge["count"] += 1
        edge["msgIds"].append(msg_id)
        if msg.get("at") and (edge["lastAt"] is None or msg["at"] > edge["lastAt"]):
            edge["lastAt"], edge["lastSummary"] = msg["at"], msg.get("summary")

    return {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "tookSeconds": round(time.time() - started, 2),
        "sessions": sessions,
        "edges": list(edges.values()),
        "endpoints": list(endpoints.values()),
        "subagents": subagents,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--only", help="only sessions whose working directory starts with this path")
    parser.add_argument("--no-agents", action="store_true", help="don't call `claude agents --json`")
    args = parser.parse_args()
    only = os.path.abspath(os.path.expanduser(args.only)) if args.only else None
    print(json.dumps(snapshot(only, not args.no_agents), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
