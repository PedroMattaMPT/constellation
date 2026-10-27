# Kbd

How bindings are shown: a key or chord in tmux notation (`C-Space`, `S-Tab`, `M-Enter`, `Esc Esc`); `KeyHints` for footers; `WhichKey`, the overlay that appears 600 ms after the prefix.

**Anatomy:**

- `Kbd`: a 12 px bold chip, `panel` ground, `line-control` border with a 2 px bottom edge.
- `KeyHints`: `key label` pairs, two cells apart. The key is bold `focus`, the label `fg-muted`.
- `WhichKey`: the `C-Space` chip, "then", and three columns (attention, sessions, panes & windows) of `key label`.

| State | Web | TUI |
|---|---|---|
| default | as above | key bold `focus`, label dim |
| focused | — | — |
| selected (prefix armed) | the `C-Space` chip in `fill-brand` in the status bar | same |
| disabled | the hint is removed, never greyed | same |
| needs attention | `a`, the attention key, is first in the overlay | same |

**Rules:** lowercase named keys in hints (`enter`, `esc`, `tab`). Never the ⌘ ⌥ ⇧ symbols. In menus, the key sits right-aligned in the row; in cards, the footer goes in the bottom border.
