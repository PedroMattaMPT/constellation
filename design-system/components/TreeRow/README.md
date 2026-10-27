# TreeRow

One row of the NERDTree-style message tree: project › session › prompt (one per turn) › slash command, tool call, question asked/answered, message sent/received, subagent started/reported, reply.

**Anatomy** (one line): cursor bar `▌` · guides `│ ├ └` in `fg-faint` · disclosure `▸`/`▾` · glyph (`⌂`, `◆`/`◇`, or the message glyph in its color) · turn number for prompts · label (end-ellipsis) · status glyph for sessions · meta right-aligned in `fg-muted` (time, `+48 −12`, `182k→41k`).

`TreeFilter` sits above the tree: one chip per type with its count. `1`–`7` toggle them. A switched-off chip goes dashed and muted but stays in place, so counts don't jump.

| State | Web | TUI |
|---|---|---|
| default | plain | plain |
| focused (cursor) | `selection` + `▌` `focus` + `fg-strong` label | `tree--cursor`: `selection`, bold |
| selected (search match) | underlined label | underlined |
| filtered out (kept for context; the tree's disabled state) | everything `fg-muted`, no bold: you still read it, so never `fg-faint` | dim |
| needs attention (open question or permission) | label bold `msg-question`; its session row shows the `?` chip; collapsed parents bubble the chip up | same |

**Consumer provides:** `kind`, `label`, `depth`, `guides` (one boolean per ancestor), `last`, `hasChildren`, `expanded`, optional `turn`, `status`, `sessionKind`, `meta`, `cursor`, `match`, `dimmed`, `attention`, `onActivate`. Children load lazily; a session with 2,000 messages expands one turn at a time.

**Keys (tree focused):** `j k` move · `enter`/`o` open and jump to that point in the conversation · `O`/`X` expand or collapse all below · `p`/`P` parent or root · `f` filter · `/` search.

**Don't:** show tool output in the tree. Don't indent more than 2 cells per level. Don't reorder siblings; time order is the point.
