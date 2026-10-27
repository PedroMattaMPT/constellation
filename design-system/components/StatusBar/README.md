# StatusBar

Every session on one line, the way tmux lists windows: windows on the left, sessions in the middle, attention, cost and clock on the right.

**Anatomy:**

- **Left:** the `C-Space` chip while the prefix is armed, then window tabs (active = `fill-brand`).
- **Middle:** sessions as `index glyph name`, in stable index order so muscle memory works. The current session's index is reversed, with `Z` when zoomed.
- **Right:** `? n` waiting (fill chip), `◌ n` stale, `△ n` warnings, `$ today`, clock.

**Overflow:** waiting sessions keep their whole name in an amber chip and are never cut. The other names shrink, down to a 3-letter floor, then the rest collapse into `+n`.

| State | Web | TUI |
|---|---|---|
| default | `panel`, `fg-muted` | same |
| focused (current session) | reversed index, bold name | `[reverse]3[/]` |
| selected (prefix armed) | `C-Space` chip on the left; the next key's hints follow | same |
| disabled | — (the bar is never disabled) | — |
| needs attention | amber chip per waiting session + the `? n` counter | same |

**Consumer provides:** `windows`, `sessions [{n, name, status, current, zoomed}]`, `prefix`, `cost`, `clock`, `warnings`, `maxName`, `limit`. Clicking a session on the web focuses it, like `prefix '` then its number.

**Don't:** reorder sessions by status (the counters handle priority). Don't show a counter at zero; omit it.
