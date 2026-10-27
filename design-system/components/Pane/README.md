# Pane

One session in a tmux-style pane: header, conversation, an optional dock (question, permission or `/` menu), prompt box and status line.

**Anatomy:**

- **Header** (TUI: the top border): index (a `fill-brand` chip when focused), **name**, kind, project, `Z` when zoomed, then the status on the right.
- **Conversation:** a 2-cell glyph gutter. Prompts are bold starlight; tool calls show `λ Tool` with arguments dim and output collapsed; peer messages are teal; replies are `fg`. While working, an activity line reads `▝ Editing … · esc to interrupt`. The list is virtualized.
- **Dock:** sits right above the prompt box, so the answer is where your hands are.
- **`PromptBox`:** the `›` marker, 1 to 6 lines, image chips, a hint on the right (`enter send` / `enter queue · esc interrupt`). Banners appear for external sessions ("arrives as a peer message") and broadcast.
- **`StatusLine`** (TUI: the bottom border): `model │ @branch │ ctx bar │ mode │ mcp │ cost`. When narrow it drops cost, then branch.

| State | Web | TUI |
|---|---|---|
| default | 1 px `line` | `solid` `line` border |
| focused | 2 px `focus`, bold title, `line-control` prompt edge, caret | `heavy` `focus`, bold title |
| selected (in a broadcast) | teal 2 px prompt edge + banner | `PromptBox.-broadcast` heavy `edge` top |
| disabled (external, not adopted) | dashed border; prompt sends peer messages only | `dashed` border |
| needs attention | needs-you chip in the header; the card docked above the prompt | same |
| zoomed | 3 px double border | `double` border |
| bypass | hazard stripe across the top | title on a `mode-bypass` fill |
| renaming | inline field in the header (`enter` save · `esc` cancel) | inline `Input` in the title |

**Consumer provides:** `index`, `name`, `project`, `kind`, `status`, `messages`, `status_line {model, branch, ctx, mode, cost, mcp}`, optional `dock`, `activity`, `prompt`, `focused`, `zoomed`, `renaming`.

**Keys:** `enter` send · `M-enter` newline · `esc` interrupt · `esc esc` rewind · `S-Tab` mode · `/` commands · `@` file · `C-v` image · `prefix z` zoom · `prefix x` close (the session keeps running).
