# SessionLauncher

Start a managed session (`prefix c`): folder, name, model, mode and an optional first prompt. Start opens it in a new pane or window. This card also covers stopping (`ConfirmStop`, `prefix &`) and renaming (inline in the pane header, `prefix ,`).

**Launcher anatomy:**

- folder: input with completion, recent folders as chips, and an error line if the path isn't a folder
- name: defaults to the folder name, made unique
- model: radio chips
- mode: the six `ModeBadge`s, with one line saying what the chosen mode does
- prompt: optional, multi-line
- open in: new pane or new window
- foot: keys, `Cancel esc`, `Start enter`

**Bypass rule:** choosing `! BYPASS` turns the dialog border `status-error`, adds a `▲ bypass` line, and keeps Start disabled until you type the folder's name.

**ConfirmStop anatomy:**

- title `■ stop name?`
- what ends and what stays: "Its transcript stays: /resume brings it back"
- what will be lost: unanswered questions, running subagents
- `Cancel esc` and a vermillion `Stop &`. Pressing `&` again confirms, like tmux's `kill-window`.

| State | Web | TUI |
|---|---|---|
| default | `raised`, round, `shadow-float` | `ModalScreen`, `round $line-strong` |
| focused (field) | label in bold `focus`, input with a `focus` border and ring | same, `Input:focus` `tall $focus` |
| selected (option) | `selection` + `focus` border on the chosen chip | `(●)` |
| disabled (Start until valid) | 45 % opacity | dim |
| needs attention (bypass, stop) | `status-error` border | `round $status-error` |

**Data:** the server starts the session through the Agent SDK with `setting_sources=["user", "project", "local"]`, so your settings, CLAUDE.md, skills, plugins and MCP servers load. Never use bare mode.
