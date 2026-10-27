/* Generated from the server protocol (constellation schema). Do not edit: run npm run gen:protocol. */

/**
 * Root for schema export: every type a client needs.
 */
export interface Protocol {
  event: SnapshotEvent | SessionEvent | SessionRemovedEvent | EntriesEvent | GraphEvent;
  entryPage: EntryPage;
  entryContent: EntryContent;
  turns: Turn[];
  startRequest: StartRequest;
  started: Started;
  promptRequest: PromptRequest;
  queued: Queued;
  renameRequest: RenameRequest;
  answerRequest: AnswerRequest;
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
   * Prompts waiting for the current turn to end.
   */
  queued: string[];
  /**
   * Waiting for your answer.
   */
  pending: PendingRequest[];
  /**
   * What Claude Code is busy with besides a turn: 'compacting'.
   */
  activity: string | null;
  /**
   * How the last turn failed, if it did.
   */
  error: string | null;
}
export interface Context {
  model: string;
  usedTokens: number;
  windowTokens: number | null;
  percent: number | null;
}
/**
 * A question, permission prompt or plan approval a managed session is waiting on.
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
    | "notice";
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
}
export interface GraphEvent {
  type: "graph";
  edges: Edge[];
  endpoints: Endpoint[];
  subagents: Subagent[];
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
}
/**
 * Start a managed session. No mode: your own default mode applies.
 */
export interface StartRequest {
  cwd: string;
  model: string | null;
  mode: ("default" | "plan" | "acceptEdits" | "auto" | "bypassPermissions" | "dontAsk") | null;
  name: string | null;
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
}
