# SDK check (roadmap 3.1)

What the Claude Agent SDK for Python does with your own Claude Code setup. Checked on Linux on 2026-10-27 with `claude-agent-sdk` 0.2.174, driving your installed Claude Code 2.1.311 (the SDK also bundles 2.1.310).

- [`research/sdk_check.py`](../research/sdk_check.py) runs every check against one session in a throwaway lab folder, on Claude Haiku 5.5 at low effort. A full run takes about 75 s. It cost $0.14 at API prices; your sessions report `apiKeySource: "none"`, so it ran on your subscription login.
- The lab folder has its own `CLAUDE.md` (with a marker word) and a project skill (`lab-echo`), so loading them can be observed.
- The raw output isn't committed. It lists your plugins and MCP servers, and the transcripts carry your global `CLAUDE.md`. The lab's transcripts, its plan file and its `session-env` folders were deleted afterwards.

**Verdict: everything in 3.1 works.** Three things need care. After `/clear`, take the new session ID from the next message, not from the reset message. Never pass the parent's tmux variables to a managed session. And for "allow and remember", apply only the rule.

## Answers

| Check | Answer | Notes |
|---|---|---|
| Your setup loads | **yes** | With `setting_sources=["user", "project", "local"]` and no bare mode: both `CLAUDE.md` files (yours and the project's), 101 skills including the project's, your 7 plugins and all your MCP servers, plus the claude.ai connectors. Same login as the terminal. |
| `get_context_usage()` | **yes** | Total, window, percent and model, a breakdown by category (system prompt, tools, deferred MCP tools, memory files, skills, messages, autocompact buffer, free), and the paths of the memory files loaded. Enough for the `ContextBar` breakdown (3.8). |
| `get_server_info()` | **yes, with models** | `models` lists each model with its id, display name, description, effort levels, and whether it supports adaptive thinking, fast mode and auto mode. That's the `ModelPicker`'s data (3.5). It also has `commands` (137 slash commands), `account`, `pid`, `current_permission_mode`, the output styles and `fast_mode_state`. |
| `set_model()` | **yes** | Takes effect on the next turn. It shows up as a `<local-command-stdout>Set model to …` user message, followed by a new `init`. |
| `set_permission_mode()` | **yes** | It arrives as a `system/status` message with the new `permissionMode`. In plan mode the session wrote its plan, then called `ExitPlanMode`. **That call goes through `can_use_tool`**, so plan approval is a permission prompt too. The plan file lands in `~/.claude/plans/`. |
| `interrupt()` | **yes** | The turn ends with `ResultMessage` `subtype: "error_during_execution"`, `terminal_reason: "aborted_streaming"`, keeping the text written so far. The next prompt works normally. |
| `/compact` | **yes** | `system/status` with `status: "compacting"`, then `compact_result: "success"`, then `system/compact_boundary` with `pre_tokens`, `post_tokens` and `duration_ms`. Two quirks: it took 16 s, and the stream re-sent the two previous local-command replies afterwards (de-duplicate by `uuid`). |
| `/clear` | **yes, with a trap** | It emits a `ConversationResetMessage`, but its `new_conversation_id` matches no file. The real new session ID arrives in the `session_id` of the next result and `init` messages. The registry entry keeps the same pid and switches to that ID, as it does in the terminal. |
| `/effort` | **yes** | `/effort medium` replies with "Set effort level to medium (this session only)". It's a local command: no model call. |
| `/config key=value` | **supported, not set** | `/config` lists the settable keys in `key=value` form. Nothing was set, because these keys are global and would have changed your own settings. |
| A skill as a prompt | **yes** | `/lab-echo` ran the project skill. |
| Images | **yes** | A user message with an `image` block (base64 PNG) and a text block, sent through `query()` as a streamed message. |
| Permission prompts in `can_use_tool` | **yes** | It receives the tool, its input and Claude Code's suggestions. Deny with a message: the session is told why, and the result lists it under `permission_denials`. Allow with changed input works, **but the model isn't told**: it reported writing what it asked for, not what was written. |
| Allow and remember | **yes, with care** | Return the `addRules` suggestion as `updated_permissions`. Claude Code writes it to the project's `.claude/settings.local.json`, and the next identical call doesn't ask. The suggestions also include `setMode: acceptEdits` and `addDirectories`, so never pass them all back: that would also change the mode. |
| Questions in `can_use_tool` | **yes** | `AskUserQuestion` arrives as a permission request with the `questions` array. Answer by allowing with `updated_input = {**input, "answers": {question_text: chosen_label}}`. The session got the answer and used it. |
| Placeholder `PreToolUse` hook | **not needed** | SDK 0.2.174 routes `can_use_tool` over its own control channel. |
| Read-only commands | **never asked** | `wc` ran without reaching `can_use_tool`: Claude Code approves read-only commands itself in `default` mode. Only commands that change something, like `touch`, ask. |
| Writes a normal transcript | **yes** | Same folder and format as terminal sessions, so the Phase 2 parser reads it as is. |
| In `~/.claude/sessions/` | **yes** | `kind: "interactive"`, `entrypoint: "sdk-py"`, a derived name (`sdk-lab-a7`), live `status`. |
| Binds an inbox socket | **yes** | `messagingSocketPath` is set, so other sessions can message it like any other. |
| In `claude agents` | **yes** | Listed like any interactive session. |
| `list_sessions()`, `get_session_messages()` | **yes** | No running session needed: they read the transcript files. `rename_session()` sets `custom_title`, `tag_session()` sets a tag, and `fork_session()` writes a new transcript and returns its ID. |
| `get_mcp_status()` | **yes** | Each server's status (`connected`, `pending`, `needs-auth`) and tool count. `init` reports servers as `pending` while they still connect. |

## What this means for the rest of Phase 3

- **Run your own `claude`.** Pass `cli_path` set to the installed binary, so managed sessions run the same version as your terminal ones. The bundled copy is one release behind.
- **Clean the environment.** The child inherits the server's environment. The lab ran inside tmux, so its registry entry claimed the lab's own tmux pane (`tmux: "proj:@24.%47"`). The session manager must drop `TMUX` and `TMUX_PANE`, or "go to terminal" would jump to the wrong pane.
- **Don't force a mode.** Your settings default to `auto`. A managed session should start in that mode unless you pick another in the launcher. Leave `permission_mode` unset and read the mode from `init`.
- **One model for both kinds (3.3) is easy.** A managed session shows up in the registry and the transcripts exactly like an external one. The collector already sees it. The session manager only marks the pids it started as `managed`, and adds what only the SDK knows: pending permission requests, questions, the live stream.
- **Questions and permissions come to the server.** `can_use_tool` hands Constellation every question, permission prompt and plan approval while the session waits. That's the piece the transcript never has (see `data-sources.md`, "Pending questions"). For managed sessions, the hooks in 3.12 aren't needed.
- **Allow with changes** should tell the session what changed, for example with a note in the next prompt or as a `PostToolUse` context. Otherwise its own account of the change is wrong.
- **Cost:** `ResultMessage.total_cost_usd` is a running total for the session ID, not a per-turn cost. It restarts after `/clear`, with the new ID.
