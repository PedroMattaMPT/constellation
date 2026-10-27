# ContextBar

How full a session's context window is: a fixed-width bar, the percentage, and `△`/`▲` from 80 %/95 %, with a tick at the auto-compact threshold.

**Anatomy:**

- **Compact:** `ctx` label · track (8 cells; 6 on nodes; 16 in wide status lines) · fill · threshold tick · `64%` · flag.
- **Breakdown (`/context`):** a stacked bar by category (system, tools, MCP, memory files, messages, free) from `get_context_usage()`, a legend with token counts, and the compact threshold.

| Level | Range | Fill / text |
|---|---|---|
| normal | < 80 % | `res-normal`, number `fg-muted` |
| warning | 80–94 % | `res-warning`, `83% △` |
| critical | ≥ 95 % | `res-critical`, bold, `97% ▲`; raises an alert |

| State | Web | TUI |
|---|---|---|
| default | as above | eighth-blocks `▏▎▍▌▋▊▉█`, track `·` |
| focused | — (not focusable; the status line is) | — |
| selected | — | — |
| disabled (external session with no data) | track only, `—%` | `ctx ········ —` |
| needs attention | warning and critical levels | same |

**ASCII:** `ctx [#####---] 64%`, with `^` and `!` for the levels.
