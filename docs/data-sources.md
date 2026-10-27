# Data sources

Where Constellation gets everything it shows about Claude Code sessions it didn't start. Everything here was checked on Linux against Claude Code 2.1.310 and 2.1.311, on 2026-10-26, and the parts marked 2026-10-27 on 2.1.311 a day later. Only `claude agents --json` and hooks are documented interfaces. Everything else is Claude Code's internal state and can change between releases, so the parser skips anything it doesn't recognise.

- [`research/probe.py`](../research/probe.py) puts all of this together. It's read-only and prints one JSON snapshot of the running sessions, their message edges and their subagents. On 12 live sessions it takes 2.9 s.
- [`research/fixtures/`](../research/fixtures/) holds transcripts, registry entries and socket messages from throwaway lab sessions. They cover every case below.

| Need | Source | Live? |
|---|---|---|
| Which sessions are running | `~/.claude/sessions/<pid>.json` | yes |
| Status, including "waiting for you" | registry `status`, plus `waitingFor` from `claude agents --json` | yes |
| What it's doing, its history | the transcript `~/.claude/projects/<folder>/<sessionId>.jsonl` | yes, appended as it works |
| The question or permission it's waiting on | often the open call in the transcript; always the hooks | see [Pending questions](#pending-questions-and-permission-prompts) |
| Messages between sessions | `SendMessage` results (sender) and `origin.kind: "peer"` entries (receiver), matched by `msg_id` | yes |
| Subagents | `<sessionId>/subagents/agent-<id>.meta.json` and `.jsonl`, plus the parent's `Agent` results and notifications | yes |
| Background sessions and forks | `~/.claude/jobs/<id>/state.json` | yes |
| Context window | the last reply's `usage` ÷ the model's window | yes |
| Cost | `cost-state` entries | **no**: only written at certain moments |
| CPU, memory, GPU | `/proc` (or `psutil`), `nvidia-smi` | yes |
| Sending a message to a session | one JSON line on the session's inbox socket | yes |

---

## 1. Finding sessions

### The registry: `~/.claude/sessions/<pid>.json`

Each running Claude Code process writes one file, named after its process ID.

| Field | Meaning |
|---|---|
| `pid`, `procStart` | Process ID, and its start time in clock ticks (field 22 of `/proc/<pid>/stat`). A file counts as live only when both match a running process, which guards against a reused process ID. |
| `sessionId` | The current session. It **changes on `/clear`**: same file, new ID. |
| `cwd`, `version`, `startedAt` | Working directory, Claude Code version, start time (ms). |
| `kind` | `interactive`, or `bg` for a background session (for example one made by `/fork`). |
| `entrypoint` | `cli` so far. |
| `name`, `nameSource`, `nameSince` | The name other sessions use. `nameSource` is `auto`, `derived` (from the folder, e.g. `constellation-23`) or `user` (after `/rename`). |
| `status`, `statusUpdatedAt`, `updatedAt` | `busy`, `idle`, `shell` (running a `!` command; `claude agents` reports it as `busy`) or `waiting` (a question or permission prompt is open). |
| `tmux` | `session:@window.%pane` when the session runs inside tmux. |
| `messagingSocketPath` | Its inbox socket, `/run/user/<uid>/cc-socks/<pid>.sock`. |
| `peerProtocol`, `peerFeatures`, `pidDomain` | Messaging protocol version (`1`), features (`notify_idle`, `reply_across_default_dirs`, `artifact_yield`) and PID namespace. |

**Lifecycle:**
- The file appears when the process starts, before any prompt.
- It's rewritten as the status changes.
- It's **removed on exit**, together with the socket.

Next to each file is a `<pid>.<hash>.key` file (140 bytes, mode 600). Constellation doesn't read it.

### `claude agents --json --all`

Takes about 0.19 s per call. It returns one row per session.

- **Interactive rows:** `pid`, `cwd`, `kind`, `startedAt`, `sessionId`, `name` and `status` (`busy`, `idle` or `waiting`).
- **Background rows:** `id` (the job ID) and `state` (`working`, `blocked`, `done`, `failed` or `stopped`) take the place of `pid` and `status`.
- **`waitingFor`** appears while a session waits:
  - `permission prompt`: a tool needs approval
  - `input needed`: an `AskUserQuestion` is open

  Background sessions can also report `sandbox request`, `worker request` or `dialog open`.

Use it for `waitingFor`. The registry already has everything else, and reading it is cheaper.

### Background sessions: `~/.claude/jobs/<id>/`

- **`state.json`:**
  - `state` and `detail` (a one-line status written by Claude Code)
  - `intent` (the original task) and `name`
  - `children`, links the session produced, such as `{"kind": "pr", "href": …}` or `{"kind": "frame", "href": "https://claude.ai/artifact/…"}`
  - `sessionId`, `resumeSessionId`, `backend: "daemon"`
  - `interactiveLineage`, set when the job came from an interactive session
  - for forks: `forkSessionId`, `forkParentSessionId`, `forkBoundaryAt` and `forkSourceAlive`
- **`timeline.jsonl`:** a history of `{at, state, detail, text}` entries.
- **`parent-transcript.jsonl`** and **`adopt.json`** appear on some jobs.
- **`~/.claude/daemon/roster.json`:** the supervisor's view of running background workers.

---

## 2. Reading a session

### Where the transcript lives

`~/.claude/projects/<folder>/<sessionId>.jsonl`, where `<folder>` is the working directory with every non-alphanumeric character turned into `-`. For example, `/home/pedro/.steam/x` becomes `-home-pedro--steam-x`.

- **A session that hasn't had a prompt yet has no transcript file.**
- Next to the transcript, the folder `<sessionId>/` holds `subagents/` and `tool-results/`.
- Background task output goes to `/tmp/claude-<uid>/<folder>/<sessionId>/tasks/<id>.output`.

### How transcripts are written

- **One JSON object per line, and append-only.** The first 3.1 MB of a live transcript stayed byte-for-byte identical while the file grew, through `/compact` and interrupts. No file ended in a half-written line, but the reader should still tolerate one.
- **Entries can be out of time order.** A tool call is held back until its permission or answer is settled, and then written with its original timestamp (20 of 124 entries in the lab session). Build structure from file order, and use timestamps only for display.
- **Size:**
  - the largest transcript here is 1.96 GB and the median is 1.4 MB
  - lines starting with `{"type":"api-request` are raw API logs, 60% of the bytes, and never needed
  - skipping them by prefix cuts a full parse of the largest file from 6.5 s to 2.45 s
- **Jumping to a message:**
  - keep an index from entry `uuid` to byte offset, built while scanning
  - seeking to an offset and parsing that one line takes 0.04 ms

### Entry types

Counts are from all 136 local transcripts (340,170 lines).

| `type` / `subtype` | Holds | Used for |
|---|---|---|
| `user`, string content, `origin.kind: "human"` | A typed prompt. `promptSource: "typed"`, `"queued"` or `"suggestion_accepted"`. | tree: prompt (starts a turn) |
| `user`, string content, `origin.kind: "peer"` | A message from another session or a subagent hand-back. | tree: received |
| `user`, string content, `origin.kind: "task-notification"` | A background task or subagent finished: `<task-id>`, `<status>`, `<summary>`, `<result>`. | tree: subagent reported |
| `user`, `tool_result` blocks | Tool results, paired by `tool_use_id`; structured detail in `toolUseResult`. | tree: answer / denied; links |
| `user`, `[Request interrupted by user]` | An interrupt. The turn ends with no `turn_duration`. | turn state |
| `user` / `system`, `<command-name>/…</command-name>` | A slash command. Local ones (`/rename`) are `system/local_command`. Prompt-type ones (`/compact`) are `user` entries with a `<local-command-caveat>`. | tree: slash command |
| `assistant` | **One content block per entry**: `thinking`, `text` or `tool_use`, chained by `parentUuid`. `message.model` and `message.usage` are on each. | tree: tool call, reply; latest step; context |
| `system/turn_duration` | End of a turn: `durationMs`, `messageCount`. | turn state |
| `system/compact_boundary` | Compaction: `compactMetadata.trigger` (`auto`/`manual`), `preTokens`, `postTokens`, `durationMs`. A `/compact` you ran is written after its boundary. | tree (`/compact 182k → 41k tokens`); context |
| `system/away_summary` | A one-line recap Claude Code writes when the user is away. | "what it's doing now", for free |
| `system/local_command`, `informational`, `scheduled_task_fire`, `model_refusal_no_fallback` | Command output, notices, `/loop` firings, refusals. | tree / skip |
| `custom-title` | `/rename`: `customTitle`. | name |
| `ai-title` | Auto title: `aiTitle`. | title |
| `last-prompt` | `lastPrompt` plus `leafUuid`. | title fallback |
| `permission-mode`, `mode` | `permissionMode`, written at each turn; `mode` (`normal`). A new file after `/clear` has none until the first turn. | mode |
| `cost-state` | `totalCostUSD`, `modelUsage` per model, lines added/removed, durations. Written only at certain moments, such as `/clear` or moving to the background. | last known cost |
| `pr-link` | `prNumber`, `prUrl`, `prRepository`. | node badge |
| `frame-link` | An artifact the session published: `frameUrl`, `title`. | node badge |
| `continued-in` | `continuedInSessionId`: the session moved into a background job. | identity |
| `queue-operation` | Prompts and notifications queued while busy (`enqueue`, …). | pending queue |
| `agent-name`, `atis-latch`, `file-history-snapshot`/`-delta`, `artifact-*` | Internal bookkeeping and file checkpoints. | skip (checkpoints matter for rewind later) |
| `attachment` | System reminders, environment, skill and tool listings, edited files, hooks. | skip, except `queued_command`, `task_status`, `edited_text_file` |
| `api-request`, `api-request-blob`, `api-request-shape` | Raw API traffic. | skip by prefix |

### Turns

- **A turn starts** at a `user` entry with string content and `origin.kind` of `human`, `peer` or `task-notification`.
- **Every `user` entry in the turn** shares its `promptId`, tool results included.
- **The reply's blocks** are separate `assistant` entries chained by `parentUuid`.
- **The turn ends** at `system/turn_duration`, or at `[Request interrupted by user]` when interrupted. Partial reply text is kept.
- **A transcript is a tree, not a line.** Rewinding or editing a prompt starts a new branch: a new prompt with the same `parentUuid` as the prompt it replaces. So does interrupting a prompt before any reply, then sending again. The abandoned branch stays in the file, in file order.
  - **How Constellation finds it** (roadmap 2.10): when a typed prompt has the same parent as an earlier one, everything from the earlier prompt on is left behind. Checked on all 140 local transcripts (2026-10-27): 138 such pairs, and in 137 the older prompt is off the chain followed back from the file's last entry.
  - **Not `last-prompt.leafUuid`.** In 104 of the 140 files the latest `leafUuid` isn't on that chain, so it doesn't name the live branch.
  - All 138 pairs in this data dropped one prompt that never got a reply. A rewind through `resume_session_at` (Constellation's own, roadmap 3.9) has the same shape, and was checked live.

### Session identity over time

| Action | Session ID | Transcript | Registry |
|---|---|---|---|
| `/rename x` | same | `custom-title` + `local_command` entries | `name: x`, `nameSource: user` |
| `/compact` | same | same file: `compact_boundary`, then a summary entry | unchanged |
| `/clear` | **new** | **new file**; neither file points to the other | same `pid`, `sessionId` switches |
| `/fork` | new, in a new **background** session | new file | new entry: `kind: bg`, `name: "<name> ⑂"`; job has `forkParentSessionId` |
| moving to the background | new (the job's) | old file ends with `continued-in`; the new file carries the old history | background job, `interactiveLineage: true` |
| exit | — | file stays | registry file and socket **removed** |
| `--continue` / `--resume` | **same** | same file, appended | new `pid`, name restored |

`/clear` can only be linked while it happens: watch a registry file whose `pid` stays the same while its `sessionId` changes. A one-off scan can't see it.

### State from the transcript

| State | How | Reliability |
|---|---|---|
| Title | `custom-title`, else `ai-title`, else `last-prompt` | good |
| Mode | latest `permission-mode` | per turn; unknown right after `/clear` |
| Latest step | the last `tool_use` (tool + a short summary of its input) or the first line of the last `text` | good, but a tool waiting for approval isn't written yet |
| Turn open | started and not yet closed by `turn_duration` or an interrupt | good |
| Context used | the last `assistant` `usage`: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens` | matched Claude Code's status line to within 1% on 8 sessions |
| Context window | 1,000,000 for `claude-opus-5-5` and `claude-haiku-5-5` (checked); others unknown | needs a table |
| Cost | the latest `cost-state` | **not live**. Live cost needs a price table, or comes from the SDK for managed sessions. |
| Recap | the latest `system/away_summary` | only after the user has been away |

### Pending questions and permission prompts

While a session asks, the registry shows `status: "waiting"`, and `claude agents --json` shows `waitingFor: "permission prompt"` or `"input needed"`. What it asks is in three places, none complete on its own:

- **The transcript, sometimes.** Claude Code 2.1.311 wrote the call (`AskUserQuestion`, or the `Bash` call waiting for permission) as soon as the model made it, and its result once answered. So an open question is a call with no result yet. But one real session waiting for `input needed` had no open call in its transcript at all, and a call with no result can also just be running. Constellation uses this only as a fallback: an open `AskUserQuestion` in the current turn, or the only open call when it waits for permission.
- **The screen:** `tmux capture-pane`, using the registry's `tmux` field. Fragile.
- **Two hooks**, which see every question and permission prompt while it's open. Roadmap 3.12, checked in a lab session on 2026-10-27:

| Question | Answer |
|---|---|
| Does the hook get the full question? | **Yes.** `PreToolUse` on `AskUserQuestion` gets `tool_input.questions` (question, header, options with descriptions, `multiSelect`) and `tool_use_id`. `PermissionRequest` gets `tool_name`, `tool_input` and `permission_suggestions` (`addRules`, `addDirectories`, `setMode`), and **no** `tool_use_id`. Both carry `session_id`, `transcript_path`, `cwd` and `permission_mode`. |
| Does a question fire both? | **Yes.** `AskUserQuestion` also fires `PermissionRequest`, 60 ms after `PreToolUse`. Constellation keeps one. |
| Do running sessions pick it up? | **Yes.** Hooks added to a settings file while a session runs fire on its next question, without a restart. |
| How long does it add? | The report script: 1 ms with no server (no address file), 6 ms with a stale address file, 9 ms when it posts (median of 10 each). It passes the token to `curl` from a file (`-H @file`), never on its command line. |
| Could the hook answer? | **Yes, but not safely.** A `PermissionRequest` hook that returns `{"decision": {"behavior": "deny"}}` does decide. While it runs, though, the terminal shows no dialog at all, only the command. A hook that waited for an answer from Constellation would leave the terminal with nothing to answer, until the hook's timeout. So the hook only reports, and you answer in the terminal. |

The hook's report is dropped once the call's result is in the transcript, or once the session has stopped waiting. For managed sessions, including adopted ones, none of this matters: the SDK's `can_use_tool` callback receives every question and permission prompt.

---

## 3. Links between sessions

### Messages

**Sender side:** an `assistant` `tool_use` named `SendMessage`.

- Its `input`:
  - `to`, `recipient`, `type: "message"`, `summary`, `message` / `content`, and optionally `notify_when_idle`
  - `recipient_kind`, one of:
    - `name`: a session name such as `lab-b`
    - `session`: a socket address such as `uds:/run/user/1000/cc-socks/3112238.sock`
    - `agent`: this session's own subagent
- Its result's `toolUseResult` is `{success, message, display, msg_id}`.

**Receiver side:** a `user` entry with `promptSource: "system"` and `turnOrigin: "peer"`.

- Its content is wrapped in `<cross-session-message from="…" from-name="…" from-mode="…">`.
- Its `origin`:

  ```json
  {"kind": "peer", "from": "uds:/run/user/1000/cc-socks/3112238.sock",
   "verifiedPeerPid": 3112238, "verifiedPeerProcStart": "10252924",
   "msg_id": "9184e85b-…", "name": "lab-a", "fromMode": "prompting",
   "hopChain": ["68e18c86e2fac8eaa934fb04"], "body": "…"}
  ```

**Matching the two sides:**

1. Match the sender's result and the receiver's entry by `msg_id`.
2. Resolve a socket address `…/cc-socks/<pid>.sock` to a session through the registry's `pid`. Check `verifiedPeerProcStart` against `procStart` when it's present.
3. Resolve a name through the registry, but only when exactly one live session has that name.
4. A peer that has exited becomes an **endpoint**, named from any message that carried its name.

**Only match structured fields, never search the text.** IDs leak into other transcripts, for example through tool output.

### Subagents

- **Their transcripts:** `<sessionId>/subagents/agent-<agentId>.jsonl`. Entries have `isSidechain: true` and `agentId`, and their `sessionId` is the parent's.
- **Metadata:** `agent-<agentId>.meta.json`:
  - `agentType` and `description`
  - `toolUseId`, the parent's `Agent` call
  - `spawnDepth`, for nesting
  - `requestShape: "background"` and `requestNonInteractive`
- **Launch:** the parent's `Agent` result has `toolUseResult.agentId`, `status` (`async_launched` or `completed`), `description`, `isAsync` and `outputFile`.
- **Completion** arrives as a `task-notification` entry (`<task-id>` = agent ID, `<status>`), or as a peer hand-back (`origin.handback: true`, `senderTaskId`).
- **Messages to a subagent** are `SendMessage` calls with `recipient_kind: "agent"`.

### Other links

| Link | Where | Proposal |
|---|---|---|
| Fork | job `forkParentSessionId` | an edge of kind `fork` |
| Moved to the background | `continued-in` | the same node continuing, not an edge |
| `/clear` | registry `pid` stays, `sessionId` changes | the same node continuing, not an edge |
| Idle-notice subscription | `SendMessage` with `notify_when_idle` | a marker on the message edge |
| Same repo or worktree | `cwd`, `gitBranch` | grouping, not an edge |
| Agent-team teammates | not seen yet | unknown |

---

## 4. Sending a message from Constellation

The inbox socket takes **one JSON line per message**. The format was captured by having a session send a message to a `socat` listener:

```json
{"msgV": 1, "msg_id": "<uuid>", "type": "user",
 "message": {"role": "user", "content": "<cross-session-message from=\"uds:/run/user/1000/cc-socks/cst-sniff.sock\" from-name=\"constellation\" from-mode=\"prompting\">\nHello\n</cross-session-message>"},
 "priority": "next", "from": "uds:/run/user/1000/cc-socks/cst-sniff.sock"}
```

- **Nothing is sent back** on the connection.
- On Linux an auth line is optional. Constellation has no token for another session anyway.
- **It was tested end to end.** A script sent this to lab-b. Lab-b recorded it as `name: "constellation"`, with the script's operating-system-verified `pid`, and replied with `SendMessage` to the `from` address. The reply arrived as the same kind of JSON line, with a `hop-chain` attribute.
- **Constellation needs its own inbox:** a socket of its own in `/run/user/<uid>/cc-socks/` (mode 600) to receive replies. It's `constellation-<pid>.sock`, so it never looks like a session's `<pid>.sock`.
- **Checked from the server on 2026-10-27** (roadmap 3.11): a terminal session got the message as `name: "constellation"`, `fromMode: "prompting"`, with the server's verified pid, and replied to its socket with `SendMessage`. The map shows both directions as edges to the `constellation` endpoint.
- The receiver's inbound controls still apply. A session that bypasses permissions holds messages from a sender that says `prompting`.
- **This format is undocumented.** Check `msgV` and the receiver's `peerProtocol` before sending.

---

## 5. Processes and resources

- **Process tree:**
  - follow `/proc/<pid>/task/<pid>/children` recursively from the registry's `pid`
  - reading the trees of all 12 sessions took 6.6 ms
  - typical children are shells, and MCP servers started through `npm exec` (Playwright, …)
- **Memory:** RSS from `/proc/<pid>/statm`, summed over the tree. Normally 600–950 MB per session; one session that ran a game build held 7.2 GB.
- **CPU:** the change in `utime + stime` (fields 14 and 15 of `/proc/<pid>/stat`) between two samples. The server will use `psutil` (7.0.0 is installed system-wide) for portability.
- **GPU:** `nvidia-smi --query-compute-apps=pid,used_memory --format=csv,noheader,nounits` takes 20 ms. Match each process ID against the session trees; the one GPU process found belonged to `valheim-35` (1.2 GB). `pynvml` isn't installed.

---

## 6. Still open

- **When Claude Code writes an open call to the transcript.** In the lab it was always at once; in one real session waiting for input it wasn't there. The hooks don't depend on it. See [Pending questions](#pending-questions-and-permission-prompts).
- **Live cost** for those sessions needs a price table, because `cost-state` isn't written continuously.
- **Context windows** for models other than the two checked.
- **Agent-team** links haven't been seen in any transcript yet.
- **Not checked:** two live sessions with the same name, sessions in containers, a non-default `CLAUDE_CONFIG_DIR`, macOS and Windows.
- **The socket format and the registry are undocumented**, so a Claude Code update can change them. Pin a known version range and test against the fixtures.
