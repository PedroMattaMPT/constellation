# Server API

The server listens on `127.0.0.1:7337`. Every request needs the per-run token, either as `Authorization: Bearer <token>` or as `?token=`. A request from a page on another site is refused even when it carries the token. The models are in [`server/src/constellation/protocol.py`](../server/src/constellation/protocol.py), and the web app's types are generated from them (`npm --prefix web run gen:protocol`). Fields are camelCase on the wire.

## Watching

| Request | Returns |
|---|---|
| `GET /api/snapshot` | `Snapshot`: every running session, the message edges, endpoints and subagents |
| `GET /api/sessions/{id}/turns` | `Turn[]`: one per prompt, for the tree |
| `GET /api/sessions/{id}/entries?before=&after=&around=&turn=&limit=` | `EntryPage`: a page of the conversation |
| `GET /api/sessions/{id}/entries/{entryId}` | `EntryContent`: one entry in full |
| `WS /api/live?token=` | a `snapshot` event, then `session`, `session_removed`, `entries` and `graph` events as things change |

`{id}` is the session's process id plus its start time (`<pid>-<procStart>`), so it stays the same across `/clear`.

## Managed sessions

Only for sessions Constellation started. Anything else returns 409 with the reason in `detail`.

| Request | Body | Does |
|---|---|---|
| `POST /api/sessions` | `StartRequest` `{cwd, model, mode, name}` | Starts a session in `cwd` with your setup. With no `mode`, your default mode applies. Bypass is refused for now: it needs the confirming key from 3.6. Returns `Started` `{id}`. |
| `POST /api/sessions/{id}/prompt` | `PromptRequest` `{text, images}` | Sends the prompt, or queues it behind the running turn. `images` are `{mediaType, data}` (base64 PNG, JPEG, GIF or WebP, 5 MB each). Slash commands and skills work as prompts. Returns `Queued` `{queued}`. |
| `DELETE /api/sessions/{id}/queue` | | Drops the queued prompts. |
| `POST /api/sessions/{id}/rename` | `RenameRequest` `{name}` | Claude Code's own `/rename`, queued like a prompt. |
| `POST /api/sessions/{id}/interrupt` | | Stops the running turn. Queued prompts then go out in order. |
| `POST /api/sessions/{id}/stop` | | Ends the process. Its transcript stays. |
| `POST /api/sessions/{id}/pending/{requestId}` | `AnswerRequest` `{allow, message, updatedInput, remember}` | Answers a question, permission prompt or plan approval from the session's `pending` list. For a question, send the tool input plus `answers: {questionText: label}` as `updatedInput`. `remember` adds only Claude Code's suggested allow rule. |

A managed session's `Session` also carries `queued`, `pending` (each with its `kind`: question, permission or plan, the tool's `input`, and the `rules` "remember" would save), `activity` (`compacting`) and `error`. When you allow a tool call with a changed input, the session is told what ran. Its `costUsd` is live. Managed sessions end when the server stops.
