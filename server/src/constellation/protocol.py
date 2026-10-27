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
Effort = Literal["low", "medium", "high", "xhigh", "max"]
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
    "mode",
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


class Resources(Wire):
    """What a session's process tree costs the machine (roadmap 4.1, 4.2), sampled every few seconds."""

    cpu: float = Field(description="Percent of one core, now: 200 is two cores busy.")
    memory: int = Field(description="Resident memory of the process tree, bytes.")
    gpu: int | None = Field(None, description="GPU memory of the process tree, bytes. None without nvidia-smi.")
    processes: int = Field(description="Processes in the tree: claude, its shells, MCP servers, dev servers.")
    cpu_history: list[float] = Field(description="One value per minute, oldest first, up to 30: its average.")
    memory_history: list[int] = Field(description="One value per minute, oldest first, up to 30: its peak.")
    gpu_history: list[int] = Field(description="As memory_history, for GPU memory. Empty without a GPU.")


class Alert(Wire):
    """A threshold crossed (design system): context, runaway CPU, or memory or GPU against your limits."""

    kind: Literal["ctx", "cpu", "mem", "gpu"]
    level: Literal["warning", "critical"]
    text: str = Field(description="What crossed, in the design system's words: 'GPU 21.4/20 GB', 'context 97%'.")


class PendingRequest(Wire):
    """A question, permission prompt or plan approval a session is waiting on."""

    id: str
    kind: Literal["question", "permission", "plan"]
    tool: str
    input: dict[str, Any] = Field(description="The tool's input: for a question, its `questions` list.")
    rules: list[str] = Field(default_factory=list, description="What 'allow and remember' saves: `Bash(touch x)`.")
    at: int = Field(description="Unix ms.")
    source: Literal["sdk", "hook", "transcript"] = Field(
        "sdk",
        description="sdk: a managed session's, answered here. hook, transcript: a terminal session's, answered there.",
    )


class TaskInfo(Wire):
    """A background task of a managed session (a background command, a background subagent)."""

    id: str
    description: str
    type: str | None = None


class ForkLink(Wire):
    """One end of a fork: the session it came from, or one made from it."""

    session: str | None = Field(None, description="Node id, while that session runs.")
    name: str
    at: int = Field(description="Unix ms: where the record goes in the conversation.")


class McpSummary(Wire):
    connected: int
    failed: int
    total: int


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
    model: str | None = Field(None, description="The model in use: from the SDK when managed, else the last reply.")
    summary: str | None = Field(None, description="Model-written one-liner, only after you ask for one.")
    summary_at: int | None = None
    summary_source: Literal["model", "claude"] | None = Field(
        None, description="model: a small model wrote it. claude: Claude Code's own recap, current, so no call."
    )
    inbox: bool = Field(False, description="It has an inbox socket Constellation can send a peer message to.")
    adopting: bool = Field(False, description="Constellation resumes it here as soon as its terminal copy exits.")
    replaces: str | None = Field(None, description="The node this one took over from: adopted, or restarted to rewind.")
    pending: list[PendingRequest] = Field(
        default_factory=list, description="Waiting for your answer: from the SDK (managed) or the hooks (terminal)."
    )
    # Managed sessions only: what the SDK stream says that Claude Code's files don't.
    queued: list[str] = Field(default_factory=list, description="Prompts waiting for the current turn to end.")
    activity: str | None = Field(None, description="What Claude Code is busy with besides a turn: 'compacting'.")
    error: str | None = Field(None, description="How the last turn failed, if it did.")
    effort: str | None = Field(None, description="Set through Constellation; until then your settings' effort applies.")
    mcp: McpSummary | None = None
    tasks: list[TaskInfo] = Field(default_factory=list, description="Background tasks still running (managed).")
    fork_of: ForkLink | None = Field(None, description="Forked here from that session.")
    forks: list[ForkLink] = Field(default_factory=list, description="Sessions forked here from this one.")
    cost_estimated: bool = Field(
        False, description="Part of cost_usd is priced here from the transcript: Claude Code hasn't recorded it yet."
    )
    resources: Resources | None = Field(None, description="None until the first sample, or when the process is gone.")
    alerts: list[Alert] = Field(default_factory=list, description="The thresholds it has crossed, most severe first.")


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
    abandoned: bool = Field(False, description="On a branch a rewind left: not part of the conversation any more.")
    images: int = Field(0, description="Prompts: the images sent with it (GET .../entries/{id}/images/{n}).")


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
    totals: Totals


class Totals(Wire):
    """Across the machine, for the status bar."""

    today_usd: float | None = Field(
        None,
        description="Today's cost, from every transcript written to today. An estimate: Claude Code's side calls "
        "(titles, compaction) never reach a transcript.",
    )


class Limits(Wire):
    """What a session may use before it's an alert (roadmap 4.5): 80% of a limit is a warning, past it critical."""

    memory_gb: float | None = Field(description="Per session. Default: a quarter of this machine's memory.")
    gpu_gb: float | None = Field(description="Per session. Default: the GPU's memory. None without a GPU.")
    cpu_percent: float = Field(200, description="Busy above this for 5 minutes is runaway CPU (a warning).")


class LimitsRequest(Wire):
    """Change some limits; a field left out stays. `reset` puts every limit back to its default."""

    memory_gb: float | None = Field(None, gt=0)
    gpu_gb: float | None = Field(None, gt=0)
    cpu_percent: float | None = Field(None, gt=0)
    reset: bool = False


class SearchHit(Wire):
    """GET /api/search: one message that matches, in the session it's in."""

    session: str
    entry: Entry


class UsageTurn(Wire):
    turn: int
    input: int
    cache_write: int
    cache_read: int
    output: int
    cost_usd: float


class UsageReport(Wire):
    """GET /api/sessions/{id}/usage: tokens per turn and this process's split and cost (design system: /usage)."""

    turns: list[UsageTurn] = Field(description="The last 30 turns, oldest first, subagents included.")
    since: int = Field(description="Unix ms: the process's start, which the totals below count from.")
    input: int
    cache_write: int
    cache_read: int
    output: int
    cost_usd: float | None = Field(description="As on the session: Claude Code's own figure where it has one.")
    estimated: bool
    by_model: dict[str, float] = Field(description="Cost since the start per model, priced here.")


class EntryPage(Wire):
    entries: list[Entry]
    has_before: bool
    has_after: bool


class Turn(Wire):
    turn: int
    entry: Entry
    entries: int
    attention: bool = False
    abandoned: bool = False


class LinkMessage(Wire):
    """A message between two sessions, as one of them recorded it."""

    session: str = Field(description="Node id of the session whose transcript has it.")
    entry: Entry


class CommandInfo(Wire):
    name: str
    description: str
    argument_hint: str = ""
    source: Literal["built-in", "skill", "command", "mcp", "plugin"]
    aliases: list[str] = []
    unavailable: str | None = Field(None, description="Why it can't run here: 'terminal-only'.")


class ModelInfo(Wire):
    value: str = Field(description="What set_model takes: an alias ('opus') or a model id.")
    name: str
    description: str = ""
    model: str | None = Field(None, description="The model id the alias resolves to.")
    efforts: list[str] = []


class SessionOptions(Wire):
    """What a managed session's / menu and model picker offer (from get_server_info)."""

    commands: list[CommandInfo]
    models: list[ModelInfo]
    model: str | None
    effort: str | None = Field(description="Set through Constellation, else the effortLevel in your settings.")


class ContextCategory(Wire):
    id: str
    name: str
    tokens: int
    kind: str = Field(description="used, deferred (not in the window yet), buffer or free.")


class MemoryFile(Wire):
    path: str
    tokens: int


class ContextUsage(Wire):
    """The /context breakdown (get_context_usage)."""

    model: str
    total_tokens: int
    max_tokens: int
    percent: float
    auto_compact: bool
    compact_at: float | None = Field(None, description="Where auto-compact fires, as a share of the window.")
    categories: list[ContextCategory]
    memory_files: list[MemoryFile] = []


class McpServer(Wire):
    name: str
    status: Literal["connected", "failed", "needs-auth", "pending", "disabled"]
    tools: int = 0
    error: str | None = None
    scope: str | None = None


class PastSession(Wire):
    """A session in the resume picker (list_sessions)."""

    session_id: str
    name: str
    project: str
    cwd: str | None = None
    modified: int = Field(description="Unix ms.")
    tag: str | None = None
    first_prompt: str | None = None
    branch: str | None = None
    running: str | None = Field(None, description="Node id, when a live process has this session open.")


class PreviewLine(Wire):
    kind: Literal["prompt", "reply"]
    text: str


class SessionPreview(Wire):
    session_id: str
    turns: int
    lines: list[PreviewLine] = Field(description="The last few prompts and replies.")
    partial: bool = Field(False, description="A huge transcript: only its end was read, so turns is a floor.")


class RewindPreview(Wire):
    """What rewinding to a prompt restores: the files edited since, and which are outside the project."""

    files: list[str]
    outside: list[str]
    turns: int = Field(description="Turns that rewinding the conversation drops.")


class FolderMatches(Wire):
    """Folder completion for the launcher."""

    folder: bool = Field(description="What was typed is a folder.")
    matches: list[str] = Field(description="Folders that complete it, ending in /.")
    total: int


class FileMatch(Wire):
    path: str = Field(description="Relative to the session's folder; folders end in /.")
    folder: bool


class FileMatches(Wire):
    """`@` mentions: the project's files and folders that match, best first."""

    matches: list[FileMatch]
    total: int


class PastPrompt(Wire):
    """A prompt from your history in that folder (~/.claude/history.jsonl), for C-r."""

    text: str
    at: int = Field(description="Unix ms.")


class HookStatus(Wire):
    installed: bool
    settings: str = Field(description="The settings file the hooks go in.")
    script: str = Field(description="The hook script.")


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


class NoticeEvent(Wire):
    """Something the server did on its own went wrong (adopting a session): shown until dismissed."""

    type: Literal["notice"] = "notice"
    text: str
    at: int


class TotalsEvent(Wire):
    type: Literal["totals"] = "totals"
    totals: Totals


class GraphEvent(Wire):
    type: Literal["graph"] = "graph"
    edges: list[Edge]
    endpoints: list[Endpoint]
    subagents: list[Subagent]


Event = SnapshotEvent | SessionEvent | SessionRemovedEvent | EntriesEvent | GraphEvent | NoticeEvent | TotalsEvent


# ── Requests (client → server) ──────────────────────────────────────────────


class StartRequest(Wire):
    """Start a managed session. No mode: your own default mode applies."""

    cwd: str = Field(min_length=1)
    model: str | None = None
    mode: Mode | None = None
    name: str | None = Field(None, max_length=80)
    confirm: str | None = Field(None, description="Bypass only: the folder's name, typed back.")


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


class ModelRequest(Wire):
    model: str = Field(min_length=1, max_length=120)


class EffortRequest(Wire):
    effort: Effort


class ModeRequest(Wire):
    mode: Mode
    confirm: str | None = Field(None, description="Bypass only: the session's name, the second key that names it.")


class ToggleRequest(Wire):
    enabled: bool


class ResumeRequest(Wire):
    fork: bool = False
    name: str | None = Field(None, max_length=80)


class ForkRequest(Wire):
    name: str | None = Field(None, max_length=80)


class TagRequest(Wire):
    tag: str | None = Field(None, max_length=60)


class RewindRequest(Wire):
    """Rewind to just before a prompt: its files, its conversation, or both."""

    entry: str = Field(description="The prompt's entry id.")
    files: bool = True
    conversation: bool = True


class MessageRequest(Wire):
    """A peer message to a session Constellation didn't start."""

    text: str = Field(min_length=1, max_length=100_000)


class AnswerRequest(Wire):
    """Answer a pending request. For a question, `updated_input` carries the tool input plus `answers`."""

    allow: bool
    message: str | None = Field(None, description="Why it was denied: the session reads this.")
    updated_input: dict[str, Any] | None = None
    remember: bool = Field(False, description="Allow and remember: add Claude Code's suggested allow rule.")
    mode: Mode | None = Field(None, description="Plan approval: the mode to work in afterwards, such as acceptEdits.")


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
    link_messages: list[LinkMessage]
    session_options: SessionOptions
    model_request: ModelRequest
    effort_request: EffortRequest
    mode_request: ModeRequest
    context_usage: ContextUsage
    mcp_servers: list[McpServer]
    toggle_request: ToggleRequest
    past_sessions: list[PastSession]
    session_preview: SessionPreview
    resume_request: ResumeRequest
    fork_request: ForkRequest
    tag_request: TagRequest
    rewind_preview: RewindPreview
    rewind_request: RewindRequest
    message_request: MessageRequest
    hook_status: HookStatus
    folder_matches: FolderMatches
    file_matches: FileMatches
    past_prompts: list[PastPrompt]
    limits: Limits
    limits_request: LimitsRequest
    usage_report: UsageReport
    search_hits: list[SearchHit]
