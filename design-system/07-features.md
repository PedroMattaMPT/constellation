# Claude Code features

Constellation draws its own version of each Claude Code feature from what the Agent SDK returns. Every feature reuses one of five patterns, so there are no one-off screens:

| Pattern | Used for |
|---|---|
| **Docked card** (round border, above the prompt box) | Questions, permission prompts, the `/` menu |
| **Picker** (round border, a list with an optional preview on the right) | Model and effort, resume, rewind, MCP servers |
| **Inline record** (one line in the conversation) | `/compact`, `/clear`, rename, fork, mode changes, answered questions |
| **Status line segment** | Model, branch, context, mode, MCP health, cost |
| **Dialog** (centered, round border, danger or broadcast color) | Start, stop, send to several |

| Feature | What you see | TUI | Web |
|---|---|---|---|
| `/` menu | `CommandMenu`, docked above the prompt. Lists built-ins that work without a terminal, bundled skills, your skills, custom commands and MCP prompts (from `get_server_info()`), each with its source. Terminal-only commands (`/theme`, `/terminal-setup`, `/login`) stay in the list, disabled, marked `terminal-only` | Round box, `▌` highlight, footer keys | Same, with matches underlined |
| Model picker | `ModelPicker`. The current model is `(●)`. Applies to the next turn (`set_model()`). The status line updates when the turn starts | `prefix :model` or `/model` | Click the model in the status line |
| Effort | A row in the model picker (`←`/`→`). Sent as `/effort <level>`. Shown in the status line after the model when it isn't the default: `opus-5.5 high` | Same | Same |
| `/compact`, `/clear` | Inline record `/compact 182k → 41k tokens` (`msg-slash`). `/clear` asks first if the session has unanswered questions, then draws a full-width `line` rule labeled `cleared` | Same | Same |
| Context usage | `ContextBar` in every status line and on every node: △ at 80 %, ▲ at 95 %, a tick at the auto-compact threshold. `/context` opens the breakdown by category from `get_context_usage()` | 8 eighth-blocks | Bar plus legend |
| Resume picker | `ResumePicker`: past sessions on the left (`■`, name, tag, age), the last turns of the highlighted one on the right (`get_session_messages()`). `enter` resumes into a new pane; `f` forks instead | `prefix r` | Same |
| Fork / rename / tag | Fork: `prefix :fork` → a new pane named `<name>-fork`, with an inline record in both sessions. Rename: `prefix ,` edits the name in the pane title in place. Tag: `t` in the resume picker; tags show as `cn-tag` | Same | Same |
| Rewind | `Esc Esc` opens a picker of your prompts in this session, newest first. The preview lists the files that will be restored (`rewind_files()`, needs file checkpointing). Confirm with `enter`, which asks again if files outside the project change | Same | Same |
| MCP status | Status line segment `mcp 3`. When a server is down it turns `res-warning`: `mcp 3 · △ 1 down`. Clicking it, or `/mcp`, opens a picker: server, state (`●` connected, `×` failed, `○` disabled), tool count, and `r` reconnect / `space` toggle | Same | Same |
| Interrupt | `esc` while a turn runs (`interrupt()`). The activity line shows `· esc interrupts`. The record reads `× interrupted by you` in `fg-muted`, not as an error. `prefix :stop-task` stops a background task | Same | Same, plus a stop button in the activity line |
| Usage and cost | Cost per session in the status line; today's total in the global status bar. `/usage` opens a picker with tokens per turn (`Sparkline`), input/output/cache split, and cost per session | Same | Same |
| Pasted images | `C-v` attaches an image. It shows as a chip above the prompt line: `▣ schema.png 1280×720`. `backspace` on an empty prompt removes the last chip. Sent images appear in the conversation as `▣ name`, which opens in the web app | Chip text | Chip, thumbnail on hover |
| Modes | `ModeBadge` in the status line, on the node and in the tree. `S-Tab` cycles default → edits → plan, then bypass → auto when enabled; `set_permission_mode()` applies from the next tool call. `dontAsk` is never in the cycle; set it at launch | Same | Click the badge for a menu |
| Questions | `QuestionCard` docked in the pane. The session moves to the top of the attention list (`prefix a`) and the status bar | Same | Same |
| Permission prompts | `PermissionPrompt`: allow once, allow and remember (shows the rule), allow with changes (edit the command), deny with a reason | Same | Same |
| External sessions | Watched through the transcript. The prompt box sends a peer message, never a slash command; the banner says so. Their questions show read-only with `A adopt`. Adopting asks you to close the terminal copy first, then resumes the session by id as managed | Dashed | Dashed |
| Notifications | Desktop notification when a session asks a question, shows a permission prompt or fires a resource alert. Clicking it opens the session. Nothing is sent for the focused pane, and repeats are grouped per session | `notify-send` | Notification API |
