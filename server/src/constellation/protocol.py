"""The wire protocol between the server and its clients (web and terminal UI).

These models are the single definition. `constellation schema` exports them as JSON Schema,
and the web app's TypeScript types are generated from that.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

PROTOCOL_VERSION = 1

Status = Literal["working", "waiting", "idle", "stale", "error", "stopped"]
Mode = Literal["default", "plan", "acceptEdits", "auto", "bypassPermissions", "dontAsk"]
WaitingFor = Literal["permission prompt", "input needed", "sandbox request", "worker request", "dialog open"]
EntryKind = Literal[
    # The message types of the tree (design-system MsgType)
    "prompt",
    "slash",
    "tool",
    "question",
    "answer",
    "denied",
    "sent",
    "received",
    "subagent_started",
    "subagent_reported",
    "reply",
    # Shown in the conversation only
    "thinking",
    "interrupt",
    "compact",
    "notice",
]


class Wire(BaseModel):
    """snake_case in Python, camelCase on the wire."""

    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        json_schema_serialization_defaults_required=True,  # always sent, so required for clients
    )


class Context(Wire):
    model: str
    used_tokens: int
    window_tokens: int | None = None
    percent: float | None = None


class PendingRequest(Wire):
    """A question, permission prompt or plan approval a managed session is waiting on."""

    id: str
    kind: Literal["question", "permission", "plan"]
    tool: str
    input: dict[str, Any] = Field(description="The tool's input: for a question, its `questions` list.")
    rules: list[str] = Field(default_factory=list, description="What 'allow and remember' saves: `Bash(touch x)`.")
    at: int = Field(description="Unix ms.")


class Session(Wire):
    """One running Claude Code process. Its id stays the same across /clear; `session_id` changes."""

    id: str = Field(description="Node id: '<pid>-<procStart>'. Stable for the life of the process.")
    session_id: str
    session_ids: list[str] = Field(description="Every session this process has had while watched, oldest first.")
    pid: int
    name: str
    name_source: str | None = None
    kind: Literal["managed", "external"]
    process_kind: str = Field(description="Registry kind: 'interactive' or 'bg'.")
    cwd: str
    project: str
    branch: str | None = None
    tmux: str | None = None
    version: str | None = None
    started_at: int = Field(description="Unix ms.")
    status: Status
    raw_status: str = Field(description="As the registry has it: busy, idle, shell, waiting.")
    waiting_for: WaitingFor | None = None
    last_activity_at: int | None = Field(None, description="Unix ms of the latest entry or status change.")
    mode: Mode | None = None
    title: str | None = None
    first_prompt: str | None = None
    last_prompt: str | None = None
    step: str | None = Field(None, description="Latest step: 'Edit src/app.ts', or the reply's first line.")
    away_summary: str | None = None
    context: Context | None = None
    cost_usd: float | None = Field(
        None, description="Managed: live, from the SDK. External: the last cost Claude Code recorded, not live."
    )
    pr_links: list[str] = []
    artifacts: list[str] = []
    turns: int = 0
    entries: int = 0
    counts: dict[str, int] = Field(default_factory=dict, description="Entries per kind.")
    compactions: int = 0
    transcript_exists: bool = False
    # Managed sessions only: what the SDK stream says that Claude Code's files don't.
    queued: list[str] = Field(default_factory=list, description="Prompts waiting for the current turn to end.")
    pending: list[PendingRequest] = Field(default_factory=list, description="Waiting for your answer.")
    activity: str | None = Field(None, description="What Claude Code is busy with besides a turn: 'compacting'.")
    error: str | None = Field(None, description="How the last turn failed, if it did.")


class Entry(Wire):
    """One line of the message tree and the conversation. Full content: GET .../entries/{id}."""

    id: str
    seq: int = Field(description="Position in the session, across /clear.")
    turn: int = Field(description="Turn number; 0 before the first prompt.")
    starter: bool = Field(description="Starts a turn: a top-level row under the session in the tree.")
    kind: EntryKind
    at: str | None = None
    text: str = Field(description="First line: the prompt, tool name, peer name or reply text.")
    detail: str | None = Field(None, description="Muted remainder: arguments, file, preview.")
    tool: str | None = None
    tool_use_id: str | None = None
    result_error: bool | None = None
    result_preview: str | None = None
    peer: str | None = Field(None, description="For sent/received: the other side's name or address.")
    msg_id: str | None = None
    agent_id: str | None = None
    session_id: str = Field(description="The transcript this entry is in.")


class EntryContent(Wire):
    entry: Entry
    text: str = Field(description="Everything the entry says, untruncated up to a size cap.")
    input: str | None = Field(None, description="Tool input as pretty JSON.")
    result: str | None = Field(None, description="Tool result text.")
    truncated: bool = False


class Edge(Wire):
    id: str
    source: str = Field(description="Session id or endpoint id.")
    target: str
    count: int
    last_at: str | None = None
    last_summary: str | None = None
    msg_ids: list[str]


class Endpoint(Wire):
    """A message peer that isn't a running session: one that exited, or a non-Claude sender."""

    id: str
    name: str
    addresses: list[str]


class Subagent(Wire):
    id: str
    parent: str = Field(description="Session id of the parent.")
    type: str
    description: str | None = None
    status: Literal["working", "reported"]
    at: str | None = None
    depth: int | None = None
    background: bool = False


class Snapshot(Wire):
    protocol: int = PROTOCOL_VERSION
    generated_at: int
    sessions: list[Session]
    edges: list[Edge]
    endpoints: list[Endpoint]
    subagents: list[Subagent]


class EntryPage(Wire):
    entries: list[Entry]
    has_before: bool
    has_after: bool


class Turn(Wire):
    turn: int
    entry: Entry
    entries: int
    attention: bool = False


# ── Live events (server → client, over the WebSocket) ──────────────────────


class SnapshotEvent(Wire):
    type: Literal["snapshot"] = "snapshot"
    snapshot: Snapshot


class SessionEvent(Wire):
    type: Literal["session"] = "session"
    session: Session


class SessionRemovedEvent(Wire):
    type: Literal["session_removed"] = "session_removed"
    id: str


class EntriesEvent(Wire):
    """New or updated entries (upsert by id). `reset`: too many to send; drop the cache and refetch."""

    type: Literal["entries"] = "entries"
    session: str
    entries: list[Entry]
    reset: bool = False


class GraphEvent(Wire):
    type: Literal["graph"] = "graph"
    edges: list[Edge]
    endpoints: list[Endpoint]
    subagents: list[Subagent]


Event = SnapshotEvent | SessionEvent | SessionRemovedEvent | EntriesEvent | GraphEvent


# ── Requests (client → server) ──────────────────────────────────────────────


class StartRequest(Wire):
    """Start a managed session. No mode: your own default mode applies."""

    cwd: str = Field(min_length=1)
    model: str | None = None
    mode: Mode | None = None
    name: str | None = Field(None, max_length=80)


class Started(Wire):
    id: str


class ImageInput(Wire):
    media_type: Literal["image/png", "image/jpeg", "image/gif", "image/webp"]
    data: str = Field(max_length=7_000_000, description="Base64, up to 5 MB decoded (the API's limit per image).")


class PromptRequest(Wire):
    text: str = Field(max_length=200_000)
    images: list[ImageInput] = Field(default_factory=list, max_length=20)


class Queued(Wire):
    queued: int = Field(description="Prompts still waiting after this one: 0 means it was sent now.")


class RenameRequest(Wire):
    name: str = Field(min_length=1, max_length=80)


class AnswerRequest(Wire):
    """Answer a pending request. For a question, `updated_input` carries the tool input plus `answers`."""

    allow: bool
    message: str | None = Field(None, description="Why it was denied: the session reads this.")
    updated_input: dict[str, Any] | None = None
    remember: bool = Field(False, description="Allow and remember: add Claude Code's suggested allow rule.")


class Protocol(Wire):
    """Root for schema export: every type a client needs."""

    event: Event
    entry_page: EntryPage
    entry_content: EntryContent
    turns: list[Turn]
    start_request: StartRequest
    started: Started
    prompt_request: PromptRequest
    queued: Queued
    rename_request: RenameRequest
    answer_request: AnswerRequest
