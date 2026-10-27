# Server API

The server listens on `127.0.0.1:7337`. Every request needs the per-run token, either as `Authorization: Bearer <token>` or as `?token=`. A request from a page on another site is refused even when it carries the token. The models are in [`server/src/constellation/protocol.py`](../server/src/constellation/protocol.py), and the web app's types are generated from them (`npm --prefix web run gen:protocol`). Fields are camelCase on the wire.

## Watching

| Request | Returns |
|---|---|
| `GET /api/snapshot` | `Snapshot`: every running session, the message edges, endpoints and subagents |
| `GET /api/sessions/{id}/turns` | `Turn[]`: one per prompt, for the tree. `abandoned` marks a turn a rewind left behind |
| `GET /api/sessions/{id}/entries?before=&after=&around=&turn=&limit=` | `EntryPage`: a page of the conversation. Entries on a branch a rewind left behind carry `abandoned` |
| `GET /api/sessions/{id}/entries/{entryId}` | `EntryContent`: one entry in full |
| `GET /api/sessions/{id}/usage` | `UsageReport`: tokens per turn (the last 30, subagents included), and this process's input / cache write / cache read / output, cost and cost per model since it started |
| `GET /api/search?query=&limit=` | `SearchHit[]`: messages in every running session whose line (or detail), as the tree shows it, has the query; newest first, `{session, entry}` |
| `GET /api/limits` | `Limits`: memory and GPU per session (GB) and the runaway CPU line (percent) |
| `POST /api/limits` | `LimitsRequest` `{memoryGb, gpuGb, cpuPercent, reset}`: changes the ones given, or puts all back to their defaults; returns `Limits`. Saved in `~/.config/constellation/settings.json` |
| `GET /api/sessions/{id}/entries/{entryId}/images/{n}` | The `n`-th image sent with that prompt (from 0), as it was sent, with its media type. A prompt's `images` counts them |
| `GET /api/links?source=&target=` | `LinkMessage[]`: the messages between two sessions (or a session and a peer that isn't running), oldest first, each from the transcript that has it |
| `GET /api/history?query=&limit=` | `PastSession[]`: every session on this machine, newest first (`list_sessions()`); `running` names the node when one is open now |
| `GET /api/history/{sessionId}?cwd=` | `SessionPreview`: its turn count and last prompts and replies. Transcripts over 32 MB are read from their end only (`partial`) |
| `POST /api/sessions/{id}/summary` | A one-line summary of what the session is doing, as the session's `summary`. Free when nothing happened since the last one, or when Claude Code's own recap is newer than its latest step (`summarySource: "claude"`); otherwise a small model writes it (`"model"`) |
| `GET /api/folders?path=` | `FolderMatches`: the folders that complete `path` (`~/…` stays `~/…`), and whether it is a folder itself. For the launcher |
| `GET /api/sessions/{id}/files?query=` | `FileMatches`: files and folders of the session's project for `@query`, best first. A git repository's own list, so ignored files stay out |
| `GET /api/prompts?cwd=&query=` | `PastPrompt[]`: your prompts in that folder, newest first, once each, for `C-r`. Claude Code's `~/.claude/history.jsonl`, plus the prompts of the sessions running there (prompts sent through Constellation never reach that file) |
| `WS /api/live?token=` | a `snapshot` event, then `session`, `session_removed`, `entries`, `graph` and `totals` events as things change, and a `notice` when something the server did on its own failed (adopting a session) |

Every session carries `resources` (CPU, memory and GPU memory of its process tree now, and 30 one-minute values of each, sampled every 5 s) and `alerts` (`{kind: ctx | cpu | mem | gpu, level, text}`, most severe first). Its `costUsd` is Claude Code's own figure where it has one, plus what its replies cost since, priced here; `costEstimated` says when part of it is. The snapshot's `totals.todayUsd` is today's cost across every transcript, an estimate (Claude Code's side calls never reach a transcript).

An entry of kind `mode` records a change of mode, with the new mode as its `text`. A question's `answer` entry reads `Header: answer` for each question answered.

`{id}` is the session's process id plus its start time (`<pid>-<procStart>`), so it stays the same across `/clear`. A session started again from an old one (adopted, or restarted to rewind) is a new process: its `replaces` names the node it took over from. A fork made here carries `forkOf`, and the session it came from lists it in `forks`, each with the time, for the record in both conversations.

The summary runs one print-mode `claude -p --model haiku` call with nothing saved, no tools, no MCP servers and none of your settings, from `$XDG_RUNTIME_DIR/constellation/summary`, which the map leaves out.

## Managed sessions

Only for sessions Constellation started. Anything else returns 409 with the reason in `detail`.

| Request | Body | Does |
|---|---|---|
| `GET /api/models` | | `ModelInfo[]` for the launcher: the list the latest session reported, or Claude Code's aliases before any has. |
| `POST /api/sessions` | `StartRequest` `{cwd, model, mode, name, confirm}` | Starts a session in `cwd` with your setup. With no `mode`, your default mode applies. Bypass needs `confirm` set to the folder's name. Returns `Started` `{id}`. |
| `POST /api/sessions/{id}/prompt` | `PromptRequest` `{text, images}` | Sends the prompt, or queues it behind the running turn. `images` are `{mediaType, data}` (base64 PNG, JPEG, GIF or WebP, 5 MB each). Slash commands and skills work as prompts. Returns `Queued` `{queued}`. |
| `DELETE /api/sessions/{id}/queue` | | Drops the queued prompts. |
| `POST /api/sessions/{id}/rename` | `RenameRequest` `{name}` | Claude Code's own `/rename`, queued like a prompt. |
| `POST /api/sessions/{id}/interrupt` | | Stops the running turn. Queued prompts then go out in order. |
| `POST /api/sessions/{id}/stop` | | Ends the process. Its transcript stays. |
| `POST /api/sessions/{id}/pending/{requestId}` | `AnswerRequest` `{allow, message, updatedInput, remember, mode}` | Answers a question, permission prompt or plan approval from the session's `pending` list. For a question, send the tool input plus `answers: {questionText: label}` as `updatedInput`. `remember` adds only Claude Code's suggested allow rule. `mode` is for plan approval only: approve, then work in that mode (`acceptEdits`); never bypass. |
| `GET /api/sessions/{id}/options` | | `SessionOptions`: the `/` menu's commands (with their source, and terminal-only ones marked), the models with their effort levels, and the current model and effort. |
| `POST /api/sessions/{id}/model` | `ModelRequest` `{model}` | `set_model()`: applies from the next turn. |
| `POST /api/sessions/{id}/effort` | `EffortRequest` `{effort}` | Sends `/effort <level>`, queued like a prompt. Returns `Queued`. |
| `POST /api/sessions/{id}/mode` | `ModeRequest` `{mode, confirm}` | `set_permission_mode()`: applies from the next tool call. Bypass needs `confirm` set to the session's name. |
| `GET /api/sessions/{id}/context` | | `ContextUsage`: the `/context` breakdown (`get_context_usage()`), with where auto-compact fires. |
| `GET /api/sessions/{id}/mcp` | | `McpServer[]` (`get_mcp_status()`). |
| `POST /api/sessions/{id}/mcp/{server}/reconnect` | | Reconnects one server. Returns the new list. |
| `POST /api/sessions/{id}/mcp/{server}/toggle` | `ToggleRequest` `{enabled}` | Enables or disables one server. Claude Code remembers it for the project, as `/mcp` does. |
| `POST /api/sessions/{id}/tasks/{taskId}/stop` | | `stop_task()`: stops one of the session's background tasks (`Session.tasks`), such as a command run in the background. |
| `POST /api/sessions/{id}/fork` | `ForkRequest` `{name}` | A new session that starts with this one's conversation, with the same model and effort. Returns `Started`. |
| `GET /api/sessions/{id}/rewind/{entryId}` | | `RewindPreview`: the files edited since that prompt, which of them are outside the project, and the turns a rewind drops. |
| `POST /api/sessions/{id}/rewind` | `RewindRequest` `{entry, files, conversation}` | Rewinds to just before a prompt. `files` restores the checkpoints (`rewind_files()`); `conversation` restarts the session cut back to the line before the prompt, with the same model, mode and effort; if that restart fails, the session comes back as it was and the error says so. A restart is a new node: returns `Started`. A prompt from before a `/clear` can only rewind its files. |
| `POST /api/history/{sessionId}/resume` | `ResumeRequest` `{fork, name}` | Resumes a past session as a managed one, or forks it. A session that's running can only be forked. Returns `Started`. |
| `POST /api/history/{sessionId}/tag` | `TagRequest` `{tag}` | Tags a past session (`tag_session()`); an empty tag clears it. Not while it runs. |

A managed session's `Session` also carries `queued`, `pending` (each with its `kind`: question, permission or plan, the tool's `input`, the `rules` "remember" would save, and `source: "sdk"`), `activity` (`compacting`), `error`, `effort` (once set here), `mcp` (`{connected, failed, total}`) and `tasks`, its background tasks still running (`{id, description, type}`). When you allow a tool call with a changed input, the session is told what ran. Its `costUsd` is live. Managed sessions end when the server stops.

Every managed session starts with `--allow-dangerously-skip-permissions`, because Claude Code refuses to switch a session to bypass otherwise. Constellation asks for the second key that names the session before it does, and the API checks `confirm`.

## Sessions you didn't start

| Request | Body | Does |
|---|---|---|
| `POST /api/sessions/{id}/message` | `MessageRequest` `{text}` | Sends a peer message to its inbox socket. It arrives as from a session named `constellation`, so it can't run slash commands or answer prompts. Only for sessions whose registry says `peerProtocol: 1` (`Session.inbox`). |
| `POST /api/sessions/{id}/adopt` | | Waits for its terminal copy to exit, then resumes it here by its id as a managed session. `Session.adopting` is true meanwhile. |
| `DELETE /api/sessions/{id}/adopt` | | Stops waiting. |
| `POST /api/sessions/{id}/terminal` | | Switches your most recently used tmux client to the session's pane (the registry's `tmux` field). |
| `GET /api/hooks` | | `HookStatus`: whether the hooks are installed, and where. |
| `POST /api/hooks` | | Installs them: a report script in `~/.claude/hooks/`, and two entries in `~/.claude/settings.json` (`PermissionRequest`, and `PreToolUse` on `AskUserQuestion`). Everything else in the file is kept, a symlinked file is written through to its target with its mode, and a file that isn't valid JSON is left alone. |
| `DELETE /api/hooks` | | Removes exactly those entries and the script. |
| `POST /api/hooks/report` | the hook's input | What the hook script posts. Needs the token like any request. |

What a terminal session is waiting on shows in its `pending` list, read-only: `source: "hook"` when the hooks reported it, `source: "transcript"` when the open call was found in its transcript. Either way it's answered in the terminal.

While the server runs, `$XDG_RUNTIME_DIR/constellation/server` holds its address and `…/header` the `Authorization` header, both mode 600, for the hook script. The script hands the header to `curl` as a file, so the token never shows in the process list. A server removes them when it stops, unless another one has written its own since. Constellation's own inbox is `$XDG_RUNTIME_DIR/cc-socks/constellation-<pid>.sock` (mode 600). Reports from managed sessions are ignored: those questions come through the SDK.
