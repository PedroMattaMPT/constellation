# Sparkline

The last 30 minutes of one resource, one cell per minute: CPU, memory, GPU memory, or tokens per turn. Bars, not a line, so the web matches the terminal's `▁▂▃▄▅▆▇█`.

**Anatomy:** label (`cpu`, `mem`, `gpu`, `tok`) · 30 bars (8 px each on the web, one cell in the TUI) · a dashed threshold line at the warning level · the current value · the level glyph.

| Level | When | Bars |
|---|---|---|
| normal | below `warn` | `res-normal` |
| warning | at or above `warn` (CPU 200 % sustained, memory or GPU at 80 % of your limit) | the bars over the line turn `res-warning` |
| critical | at or above `crit` (a limit passed) | `res-critical`, plus a `▲` chip on the node and in the status bar |

"Runaway CPU" means 5 minutes above `warn`. It is decided by the server, and the sparkline only shows it.

| State | Web | TUI |
|---|---|---|
| default | bars | block characters |
| focused | — | — |
| selected | hovering a bar shows its minute and value (web only) | — |
| disabled (no samples yet) | baseline only | `▁` run, dim |
| needs attention | warning and critical levels | same |

**Consumer provides:** `values` (oldest first), `label`, `current`, `warn`, `crit`, `max`, `unit`. Nodes show only the last 12 values.
