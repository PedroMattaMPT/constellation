/* Generated from the server protocol (constellation schema). Do not edit: run npm run gen:protocol. */

/**
 * Root for schema export: every type a client needs.
 */
export interface Protocol {
  event: SnapshotEvent | SessionEvent | SessionRemovedEvent | EntriesEvent | GraphEvent | NoticeEvent | TotalsEvent;
  entryPage: EntryPage;
  entryContent: EntryContent;
  turns: Turn[];
  startRequest: StartRequest;
  started: Started;
  promptRequest: PromptRequest;
  queued: Queued;
  renameRequest: RenameRequest;
  answerRequest: AnswerRequest;
  linkMessages: LinkMessage[];
  sessionOptions: SessionOptions;
  modelRequest: ModelRequest;
  effortRequest: EffortRequest;
  modeRequest: ModeRequest;
  contextUsage: ContextUsage;
  mcpServers: McpServer[];
  toggleRequest: ToggleRequest;
  pastSessions: PastSession[];
  sessionPreview: SessionPreview;
  resumeRequest: ResumeRequest;
  forkRequest: ForkRequest;
  tagRequest: TagRequest;
  rewindPreview: RewindPreview;
  rewindRequest: RewindRequest;
  messageRequest: MessageRequest;
  hookStatus: HookStatus;
  folderMatches: FolderMatches;
  fileMatches: FileMatches;
  pastPrompts: PastPrompt[];
  limits: Limits;
  limitsRequest: LimitsRequest;
  usageReport: UsageReport;
  searchHits: SearchHit[];
}
export interface SnapshotEvent {
  type: "snapshot";
  snapshot: Snapshot;
}
export interface Snapshot {
  protocol: number;
  generatedAt: number;
  sessions: Session[];
  edges: Edge[];
  endpoints: Endpoint[];
  subagents: Subagent[];
  totals: Totals;
}
/**
 * One running Claude Code process. Its id stays the same across /clear; `session_id` changes.
 */
export interface Session {
  /**
   * Node id: '<pid>-<procStart>'. Stable for the life of the process.
   */
  id: string;
  sessionId: string;
  /**
   * Every session this process has had while watched, oldest first.
   */
  sessionIds: string[];
  pid: number;
  name: string;
  nameSource: string | null;
  kind: "managed" | "external";
  /**
   * Registry kind: 'interactive' or 'bg'.
   */
  processKind: string;
  cwd: string;
  project: string;
  branch: string | null;
  tmux: string | null;
  version: string | null;
  /**
   * Unix ms.
   */
  startedAt: number;
  status: "working" | "waiting" | "idle" | "stale" | "error" | "stopped";
  /**
   * As the registry has it: busy, idle, shell, waiting.
   */
  rawStatus: string;
  waitingFor: ("permission prompt" | "input needed" | "sandbox request" | "worker request" | "dialog open") | null;
  /**
   * Unix ms of the latest entry or status change.
   */
  lastActivityAt: number | null;
  mode: ("default" | "plan" | "acceptEdits" | "auto" | "bypassPermissions" | "dontAsk") | null;
  title: string | null;
  firstPrompt: string | null;
  lastPrompt: string | null;
  /**
   * Latest step: 'Edit src/app.ts', or the reply's first line.
   */
  step: string | null;
  awaySummary: string | null;
  context: Context | null;
  /**
   * Managed: live, from the SDK. External: the last cost Claude Code recorded, not live.
   */
  costUsd: number | null;
  prLinks: string[];
  artifacts: string[];
  turns: number;
  entries: number;
  /**
   * Entries per kind.
   */
  counts: {
    [k: string]: number;
  };
  compactions: number;
  transcriptExists: boolean;
  /**
   * The model in use: from the SDK when managed, else the last reply.
   */
  model: string | null;
  /**
   * Model-written one-liner, only after you ask for one.
   */
  summary: string | null;
  summaryAt: number | null;
  /**
   * model: a small model wrote it. claude: Claude Code's own recap, current, so no call.
   */
  summarySource: ("model" | "claude") | null;
  /**
   * It has an inbox socket Constellation can send a peer message to.
   */
  inbox: boolean;
  /**
   * Constellation resumes it here as soon as its terminal copy exits.
   */
  adopting: boolean;
  /**
   * The node this one took over from: adopted, or restarted to rewind.
   */
  replaces: string | null;
  /**
   * Waiting for your answer: from the SDK (managed) or the hooks (terminal).
   */
  pending: PendingRequest[];
  /**
   * Prompts waiting for the current turn to end.
   */
  queued: string[];
  /**
   * What Claude Code is busy with besides a turn: 'compacting'.
   */
  activity: string | null;
  /**
   * How the last turn failed, if it did.
   */
  error: string | null;
  /**
   * Set through Constellation; until then your settings' effort applies.
   */
  effort: string | null;
  mcp: McpSummary | null;
  /**
   * Background tasks still running (managed).
   */
  tasks: TaskInfo[];
  /**
   * Forked here from that session.
   */
  forkOf: ForkLink | null;
  /**
   * Sessions forked here from this one.
   */
  forks: ForkLink[];
  /**
   * Part of cost_usd is priced here from the transcript: Claude Code hasn't recorded it yet.
   */
  costEstimated: boolean;
  /**
   * None until the first sample, or when the process is gone.
   */
  resources: Resources | null;
  /**
   * The thresholds it has crossed, most severe first.
   */
  alerts: Alert[];
}
export interface Context {
  model: string;
  usedTokens: number;
  windowTokens: number | null;
  percent: number | null;
}
/**
 * A question, permission prompt or plan approval a session is waiting on.
 */
export interface PendingRequest {
  id: string;
  kind: "question" | "permission" | "plan";
  tool: string;
  /**
   * The tool's input: for a question, its `questions` list.
   */
  input: {
    [k: string]: unknown;
  };
  /**
   * What 'allow and remember' saves: `Bash(touch x)`.
   */
  rules: string[];
  /**
   * Unix ms.
   */
  at: number;
  /**
   * sdk: a managed session's, answered here. hook, transcript: a terminal session's, answered there.
   */
  source: "sdk" | "hook" | "transcript";
}
export interface McpSummary {
  connected: number;
  failed: number;
  total: number;
}
/**
 * A background task of a managed session (a background command, a background subagent).
 */
export interface TaskInfo {
  id: string;
  description: string;
  type: string | null;
}
/**
 * One end of a fork: the session it came from, or one made from it.
 */
export interface ForkLink {
  /**
   * Node id, while that session runs.
   */
  session: string | null;
  name: string;
  /**
   * Unix ms: where the record goes in the conversation.
   */
  at: number;
}
/**
 * What a session's process tree costs the machine (roadmap 4.1, 4.2), sampled every few seconds.
 */
export interface Resources {
  /**
   * Percent of one core, now: 200 is two cores busy.
   */
  cpu: number;
  /**
   * Resident memory of the process tree, bytes.
   */
  memory: number;
  /**
   * GPU memory of the process tree, bytes. None without nvidia-smi.
   */
  gpu: number | null;
  /**
   * Processes in the tree: claude, its shells, MCP servers, dev servers.
   */
  processes: number;
  /**
   * One value per minute, oldest first, up to 30: its average.
   */
  cpuHistory: number[];
  /**
   * One value per minute, oldest first, up to 30: its peak.
   */
  memoryHistory: number[];
  /**
   * As memory_history, for GPU memory. Empty without a GPU.
   */
  gpuHistory: number[];
}
/**
 * A threshold crossed (design system): context, runaway CPU, or memory or GPU against your limits.
 */
export interface Alert {
  kind: "ctx" | "cpu" | "mem" | "gpu";
  level: "warning" | "critical";
  /**
   * What crossed, in the design system's words: 'GPU 21.4/20 GB', 'context 97%'.
   */
  text: string;
}
export interface Edge {
  id: string;
  /**
   * Session id or endpoint id.
   */
  source: string;
  target: string;
  count: number;
  lastAt: string | null;
  lastSummary: string | null;
  msgIds: string[];
}
/**
 * A message peer that isn't a running session: one that exited, or a non-Claude sender.
 */
export interface Endpoint {
  id: string;
  name: string;
  addresses: string[];
}
export interface Subagent {
  id: string;
  /**
   * Session id of the parent.
   */
  parent: string;
  type: string;
  description: string | null;
  status: "working" | "reported";
  at: string | null;
  depth: number | null;
  background: boolean;
}
/**
 * Across the machine, for the status bar.
 */
export interface Totals {
  /**
   * Today's cost, from every transcript written to today. An estimate: Claude Code's side calls (titles, compaction) never reach a transcript.
   */
  todayUsd: number | null;
}
export interface SessionEvent {
  type: "session";
  session: Session;
}
export interface SessionRemovedEvent {
  type: "session_removed";
  id: string;
}
/**
 * New or updated entries (upsert by id). `reset`: too many to send; drop the cache and refetch.
 */
export interface EntriesEvent {
  type: "entries";
  session: string;
  entries: Entry[];
  reset: boolean;
}
/**
 * One line of the message tree and the conversation. Full content: GET .../entries/{id}.
 */
export interface Entry {
  id: string;
  /**
   * Position in the session, across /clear.
   */
  seq: number;
  /**
   * Turn number; 0 before the first prompt.
   */
  turn: number;
  /**
   * Starts a turn: a top-level row under the session in the tree.
   */
  starter: boolean;
  kind:
    | "prompt"
    | "slash"
    | "tool"
    | "question"
    | "answer"
    | "denied"
    | "sent"
    | "received"
    | "subagent_started"
    | "subagent_reported"
    | "reply"
    | "thinking"
    | "interrupt"
    | "compact"
    | "notice"
    | "mode";
  at: string | null;
  /**
   * First line: the prompt, tool name, peer name or reply text.
   */
  text: string;
  /**
   * Muted remainder: arguments, file, preview.
   */
  detail: string | null;
  tool: string | null;
  toolUseId: string | null;
  resultError: boolean | null;
  resultPreview: string | null;
  /**
   * For sent/received: the other side's name or address.
   */
  peer: string | null;
  msgId: string | null;
  agentId: string | null;
  /**
   * The transcript this entry is in.
   */
  sessionId: string;
  /**
   * On a branch a rewind left: not part of the conversation any more.
   */
  abandoned: boolean;
  /**
   * Prompts: the images sent with it (GET .../entries/{id}/images/{n}).
   */
  images: number;
}
export interface GraphEvent {
  type: "graph";
  edges: Edge[];
  endpoints: Endpoint[];
  subagents: Subagent[];
}
/**
 * Something the server did on its own went wrong (adopting a session): shown until dismissed.
 */
export interface NoticeEvent {
  type: "notice";
  text: string;
  at: number;
}
export interface TotalsEvent {
  type: "totals";
  totals: Totals;
}
export interface EntryPage {
  entries: Entry[];
  hasBefore: boolean;
  hasAfter: boolean;
}
export interface EntryContent {
  entry: Entry;
  /**
   * Everything the entry says, untruncated up to a size cap.
   */
  text: string;
  /**
   * Tool input as pretty JSON.
   */
  input: string | null;
  /**
   * Tool result text.
   */
  result: string | null;
  truncated: boolean;
}
export interface Turn {
  turn: number;
  entry: Entry;
  entries: number;
  attention: boolean;
  abandoned: boolean;
}
/**
 * Start a managed session. No mode: your own default mode applies.
 */
export interface StartRequest {
  cwd: string;
  model: string | null;
  mode: ("default" | "plan" | "acceptEdits" | "auto" | "bypassPermissions" | "dontAsk") | null;
  name: string | null;
  /**
   * Bypass only: the folder's name, typed back.
   */
  confirm: string | null;
}
export interface Started {
  id: string;
}
export interface PromptRequest {
  text: string;
  /**
   * @maxItems 20
   */
  images:
    | []
    | [ImageInput]
    | [ImageInput, ImageInput]
    | [ImageInput, ImageInput, ImageInput]
    | [ImageInput, ImageInput, ImageInput, ImageInput]
    | [ImageInput, ImageInput, ImageInput, ImageInput, ImageInput]
    | [ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput]
    | [ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput]
    | [ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput]
    | [ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput, ImageInput]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ]
    | [
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput,
        ImageInput
      ];
}
export interface ImageInput {
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  /**
   * Base64, up to 5 MB decoded (the API's limit per image).
   */
  data: string;
}
export interface Queued {
  /**
   * Prompts still waiting after this one: 0 means it was sent now.
   */
  queued: number;
}
export interface RenameRequest {
  name: string;
}
/**
 * Answer a pending request. For a question, `updated_input` carries the tool input plus `answers`.
 */
export interface AnswerRequest {
  allow: boolean;
  /**
   * Why it was denied: the session reads this.
   */
  message: string | null;
  updatedInput: {
    [k: string]: unknown;
  } | null;
  /**
   * Allow and remember: add Claude Code's suggested allow rule.
   */
  remember: boolean;
  /**
   * Plan approval: the mode to work in afterwards, such as acceptEdits.
   */
  mode: ("default" | "plan" | "acceptEdits" | "auto" | "bypassPermissions" | "dontAsk") | null;
}
/**
 * A message between two sessions, as one of them recorded it.
 */
export interface LinkMessage {
  /**
   * Node id of the session whose transcript has it.
   */
  session: string;
  entry: Entry;
}
/**
 * What a managed session's / menu and model picker offer (from get_server_info).
 */
export interface SessionOptions {
  commands: CommandInfo[];
  models: ModelInfo[];
  model: string | null;
  /**
   * Set through Constellation, else the effortLevel in your settings.
   */
  effort: string | null;
}
export interface CommandInfo {
  name: string;
  description: string;
  argumentHint: string;
  source: "built-in" | "skill" | "command" | "mcp" | "plugin";
  aliases: string[];
  /**
   * Why it can't run here: 'terminal-only'.
   */
  unavailable: string | null;
}
export interface ModelInfo {
  /**
   * What set_model takes: an alias ('opus') or a model id.
   */
  value: string;
  name: string;
  description: string;
  /**
   * The model id the alias resolves to.
   */
  model: string | null;
  efforts: string[];
}
export interface ModelRequest {
  model: string;
}
export interface EffortRequest {
  effort: "low" | "medium" | "high" | "xhigh" | "max";
}
export interface ModeRequest {
  mode: "default" | "plan" | "acceptEdits" | "auto" | "bypassPermissions" | "dontAsk";
  /**
   * Bypass only: the session's name, the second key that names it.
   */
  confirm: string | null;
}
/**
 * The /context breakdown (get_context_usage).
 */
export interface ContextUsage {
  model: string;
  totalTokens: number;
  maxTokens: number;
  percent: number;
  autoCompact: boolean;
  /**
   * Where auto-compact fires, as a share of the window.
   */
  compactAt: number | null;
  categories: ContextCategory[];
  memoryFiles: MemoryFile[];
}
export interface ContextCategory {
  id: string;
  name: string;
  tokens: number;
  /**
   * used, deferred (not in the window yet), buffer or free.
   */
  kind: string;
}
export interface MemoryFile {
  path: string;
  tokens: number;
}
export interface McpServer {
  name: string;
  status: "connected" | "failed" | "needs-auth" | "pending" | "disabled";
  tools: number;
  error: string | null;
  scope: string | null;
}
export interface ToggleRequest {
  enabled: boolean;
}
/**
 * A session in the resume picker (list_sessions).
 */
export interface PastSession {
  sessionId: string;
  name: string;
  project: string;
  cwd: string | null;
  /**
   * Unix ms.
   */
  modified: number;
  tag: string | null;
  firstPrompt: string | null;
  branch: string | null;
  /**
   * Node id, when a live process has this session open.
   */
  running: string | null;
}
export interface SessionPreview {
  sessionId: string;
  turns: number;
  /**
   * The last few prompts and replies.
   */
  lines: PreviewLine[];
  /**
   * A huge transcript: only its end was read, so turns is a floor.
   */
  partial: boolean;
}
export interface PreviewLine {
  kind: "prompt" | "reply";
  text: string;
}
export interface ResumeRequest {
  fork: boolean;
  name: string | null;
}
export interface ForkRequest {
  name: string | null;
}
export interface TagRequest {
  tag: string | null;
}
/**
 * What rewinding to a prompt restores: the files edited since, and which are outside the project.
 */
export interface RewindPreview {
  files: string[];
  outside: string[];
  /**
   * Turns that rewinding the conversation drops.
   */
  turns: number;
}
/**
 * Rewind to just before a prompt: its files, its conversation, or both.
 */
export interface RewindRequest {
  /**
   * The prompt's entry id.
   */
  entry: string;
  files: boolean;
  conversation: boolean;
}
/**
 * A peer message to a session Constellation didn't start.
 */
export interface MessageRequest {
  text: string;
}
export interface HookStatus {
  installed: boolean;
  /**
   * The settings file the hooks go in.
   */
  settings: string;
  /**
   * The hook script.
   */
  script: string;
}
/**
 * Folder completion for the launcher.
 */
export interface FolderMatches {
  /**
   * What was typed is a folder.
   */
  folder: boolean;
  /**
   * Folders that complete it, ending in /.
   */
  matches: string[];
  total: number;
}
/**
 * `@` mentions: the project's files and folders that match, best first.
 */
export interface FileMatches {
  matches: FileMatch[];
  total: number;
}
export interface FileMatch {
  /**
   * Relative to the session's folder; folders end in /.
   */
  path: string;
  folder: boolean;
}
/**
 * A prompt from your history in that folder (~/.claude/history.jsonl), for C-r.
 */
export interface PastPrompt {
  text: string;
  /**
   * Unix ms.
   */
  at: number;
}
/**
 * What a session may use before it's an alert (roadmap 4.5): 80% of a limit is a warning, past it critical.
 */
export interface Limits {
  /**
   * Per session. Default: a quarter of this machine's memory.
   */
  memoryGb: number | null;
  /**
   * Per session. Default: the GPU's memory. None without a GPU.
   */
  gpuGb: number | null;
  /**
   * Busy above this for 5 minutes is runaway CPU (a warning).
   */
  cpuPercent: number;
}
/**
 * Change some limits; a field left out stays. `reset` puts every limit back to its default.
 */
export interface LimitsRequest {
  memoryGb: number | null;
  gpuGb: number | null;
  cpuPercent: number | null;
  reset: boolean;
}
/**
 * GET /api/sessions/{id}/usage: tokens per turn and this process's split and cost (design system: /usage).
 */
export interface UsageReport {
  /**
   * The last 30 turns, oldest first, subagents included.
   */
  turns: UsageTurn[];
  /**
   * Unix ms: the process's start, which the totals below count from.
   */
  since: number;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  /**
   * As on the session: Claude Code's own figure where it has one.
   */
  costUsd: number | null;
  estimated: boolean;
  /**
   * Cost since the start per model, priced here.
   */
  byModel: {
    [k: string]: number;
  };
}
export interface UsageTurn {
  turn: number;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  costUsd: number;
}
/**
 * GET /api/search: one message that matches, in the session it's in.
 */
export interface SearchHit {
  session: string;
  entry: Entry;
}
