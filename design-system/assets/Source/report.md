# Constellation — color checks

WCAG 2 contrast for every text (4.5:1), mark (3:1) and fill/on pair (4.5:1), for truecolor and the xterm-256 fallback, in both themes. Text is checked against bg, surface, panel, raised and selection; marks against bg, surface, panel and raised. The worst ground is shown.

| Depth | Theme | Pair | Ratio | Needs | Result |
|---|---|---|---|---|---|
| truecolor | dark | `fg` (worst on `selection`) | 10.46 | 4.5 | pass |
| truecolor | dark | `fg-strong` (worst on `selection`) | 12.21 | 4.5 | pass |
| truecolor | dark | `fg-muted` (worst on `selection`) | 4.94 | 4.5 | pass |
| truecolor | dark | `fg-faint` (worst on `raised`) | 3.37 | 3.0 | pass |
| truecolor | dark | `line-control` (worst on `raised`) | 3.28 | 3.0 | pass |
| truecolor | dark | `focus` (worst on `raised`) | 9.42 | 3.0 | pass |
| truecolor | dark | `brand` (worst on `selection`) | 7.41 | 4.5 | pass |
| truecolor | dark | `on-fill-brand` on `fill-brand` | 11.17 | 4.5 | pass |
| truecolor | dark | `status-working` (worst on `selection`) | 5.71 | 4.5 | pass |
| truecolor | dark | `status-waiting` (worst on `selection`) | 6.36 | 4.5 | pass |
| truecolor | dark | `on-status-waiting-fill` on `status-waiting-fill` | 9.27 | 4.5 | pass |
| truecolor | dark | `status-idle` (worst on `selection`) | 4.94 | 4.5 | pass |
| truecolor | dark | `status-stale` (worst on `selection`) | 5.63 | 4.5 | pass |
| truecolor | dark | `status-error` (worst on `selection`) | 4.60 | 4.5 | pass |
| truecolor | dark | `status-stopped` (worst on `selection`) | 4.94 | 4.5 | pass |
| truecolor | dark | `mode-default` (worst on `selection`) | 4.94 | 4.5 | pass |
| truecolor | dark | `mode-plan` (worst on `selection`) | 6.11 | 4.5 | pass |
| truecolor | dark | `mode-edits` (worst on `selection`) | 5.40 | 4.5 | pass |
| truecolor | dark | `on-mode-auto` on `mode-auto` | 8.15 | 4.5 | pass |
| truecolor | dark | `on-mode-bypass` on `mode-bypass` | 6.93 | 4.5 | pass |
| truecolor | dark | `mode-dontask` (worst on `selection`) | 4.59 | 4.5 | pass |
| truecolor | dark | `msg-prompt` (worst on `selection`) | 7.41 | 4.5 | pass |
| truecolor | dark | `msg-slash` (worst on `selection`) | 7.41 | 4.5 | pass |
| truecolor | dark | `msg-tool` (worst on `selection`) | 5.71 | 4.5 | pass |
| truecolor | dark | `msg-question` (worst on `selection`) | 6.36 | 4.5 | pass |
| truecolor | dark | `msg-answer` (worst on `selection`) | 6.11 | 4.5 | pass |
| truecolor | dark | `msg-denied` (worst on `selection`) | 4.60 | 4.5 | pass |
| truecolor | dark | `msg-sent` (worst on `selection`) | 6.15 | 4.5 | pass |
| truecolor | dark | `msg-received` (worst on `selection`) | 6.15 | 4.5 | pass |
| truecolor | dark | `msg-subagent` (worst on `selection`) | 6.15 | 4.5 | pass |
| truecolor | dark | `msg-reply` (worst on `selection`) | 10.46 | 4.5 | pass |
| truecolor | dark | `res-normal` (worst on `raised`) | 5.66 | 3.0 | pass |
| truecolor | dark | `res-warning` (worst on `selection`) | 6.36 | 4.5 | pass |
| truecolor | dark | `res-critical` (worst on `selection`) | 4.60 | 4.5 | pass |
| truecolor | dark | `on-res-critical-fill` on `res-critical-fill` | 6.93 | 4.5 | pass |
| truecolor | dark | `kind-managed` (worst on `raised`) | 9.42 | 3.0 | pass |
| truecolor | dark | `kind-external` (worst on `selection`) | 4.59 | 4.5 | pass |
| truecolor | dark | `edge` (worst on `raised`) | 7.81 | 3.0 | pass |
| truecolor | dark | `edge-subagent` (worst on `raised`) | 5.84 | 3.0 | pass |
| truecolor | light | `fg` (worst on `selection`) | 13.65 | 4.5 | pass |
| truecolor | light | `fg-strong` (worst on `selection`) | 16.32 | 4.5 | pass |
| truecolor | light | `fg-muted` (worst on `selection`) | 5.18 | 4.5 | pass |
| truecolor | light | `fg-faint` (worst on `panel`) | 3.29 | 3.0 | pass |
| truecolor | light | `line-control` (worst on `panel`) | 3.34 | 3.0 | pass |
| truecolor | light | `focus` (worst on `panel`) | 6.86 | 3.0 | pass |
| truecolor | light | `brand` (worst on `selection`) | 6.41 | 4.5 | pass |
| truecolor | light | `on-fill-brand` on `fill-brand` | 7.45 | 4.5 | pass |
| truecolor | light | `status-working` (worst on `selection`) | 4.91 | 4.5 | pass |
| truecolor | light | `status-waiting` (worst on `selection`) | 5.32 | 4.5 | pass |
| truecolor | light | `on-status-waiting-fill` on `status-waiting-fill` | 8.98 | 4.5 | pass |
| truecolor | light | `status-idle` (worst on `selection`) | 5.18 | 4.5 | pass |
| truecolor | light | `status-stale` (worst on `selection`) | 5.19 | 4.5 | pass |
| truecolor | light | `status-error` (worst on `selection`) | 5.18 | 4.5 | pass |
| truecolor | light | `status-stopped` (worst on `selection`) | 5.18 | 4.5 | pass |
| truecolor | light | `mode-default` (worst on `selection`) | 5.18 | 4.5 | pass |
| truecolor | light | `mode-plan` (worst on `selection`) | 5.14 | 4.5 | pass |
| truecolor | light | `mode-edits` (worst on `selection`) | 5.30 | 4.5 | pass |
| truecolor | light | `on-mode-auto` on `mode-auto` | 6.47 | 4.5 | pass |
| truecolor | light | `on-mode-bypass` on `mode-bypass` | 5.51 | 4.5 | pass |
| truecolor | light | `mode-dontask` (worst on `selection`) | 5.24 | 4.5 | pass |
| truecolor | light | `msg-prompt` (worst on `selection`) | 6.41 | 4.5 | pass |
| truecolor | light | `msg-slash` (worst on `selection`) | 6.41 | 4.5 | pass |
| truecolor | light | `msg-tool` (worst on `selection`) | 4.91 | 4.5 | pass |
| truecolor | light | `msg-question` (worst on `selection`) | 5.32 | 4.5 | pass |
| truecolor | light | `msg-answer` (worst on `selection`) | 5.14 | 4.5 | pass |
| truecolor | light | `msg-denied` (worst on `selection`) | 5.18 | 4.5 | pass |
| truecolor | light | `msg-sent` (worst on `selection`) | 5.04 | 4.5 | pass |
| truecolor | light | `msg-received` (worst on `selection`) | 5.04 | 4.5 | pass |
| truecolor | light | `msg-subagent` (worst on `selection`) | 5.04 | 4.5 | pass |
| truecolor | light | `msg-reply` (worst on `selection`) | 13.65 | 4.5 | pass |
| truecolor | light | `res-normal` (worst on `panel`) | 5.32 | 3.0 | pass |
| truecolor | light | `res-warning` (worst on `selection`) | 5.32 | 4.5 | pass |
| truecolor | light | `res-critical` (worst on `selection`) | 5.18 | 4.5 | pass |
| truecolor | light | `on-res-critical-fill` on `res-critical-fill` | 5.51 | 4.5 | pass |
| truecolor | light | `kind-managed` (worst on `panel`) | 6.86 | 3.0 | pass |
| truecolor | light | `kind-external` (worst on `selection`) | 5.24 | 4.5 | pass |
| truecolor | light | `edge` (worst on `panel`) | 5.39 | 3.0 | pass |
| truecolor | light | `edge-subagent` (worst on `panel`) | 5.61 | 3.0 | pass |
| 256 | dark | `fg` (worst on `selection`) | 8.95 | 4.5 | pass |
| 256 | dark | `fg-strong` (worst on `selection`) | 11.37 | 4.5 | pass |
| 256 | dark | `fg-muted` (worst on `selection`) | 4.78 | 4.5 | pass |
| 256 | dark | `fg-faint` (worst on `raised`) | 3.34 | 3.0 | pass |
| 256 | dark | `line-control` (worst on `raised`) | 3.34 | 3.0 | pass |
| 256 | dark | `focus` (worst on `raised`) | 6.54 | 3.0 | pass |
| 256 | dark | `brand` (worst on `selection`) | 5.63 | 4.5 | pass |
| 256 | dark | `on-fill-brand` on `fill-brand` | 9.92 | 4.5 | pass |
| 256 | dark | `status-working` (worst on `selection`) | 4.65 | 4.5 | pass |
| 256 | dark | `status-waiting` (worst on `selection`) | 6.17 | 4.5 | pass |
| 256 | dark | `on-status-waiting-fill` on `status-waiting-fill` | 10.16 | 4.5 | pass |
| 256 | dark | `status-idle` (worst on `selection`) | 4.78 | 4.5 | pass |
| 256 | dark | `status-stale` (worst on `selection`) | 5.25 | 4.5 | pass |
| 256 | dark | `status-error` (worst on `selection`) | 4.81 | 4.5 | pass |
| 256 | dark | `status-stopped` (worst on `selection`) | 4.78 | 4.5 | pass |
| 256 | dark | `mode-default` (worst on `selection`) | 4.78 | 4.5 | pass |
| 256 | dark | `mode-plan` (worst on `selection`) | 6.00 | 4.5 | pass |
| 256 | dark | `mode-edits` (worst on `selection`) | 4.77 | 4.5 | pass |
| 256 | dark | `on-mode-auto` on `mode-auto` | 7.37 | 4.5 | pass |
| 256 | dark | `on-mode-bypass` on `mode-bypass` | 8.47 | 4.5 | pass |
| 256 | dark | `mode-dontask` (worst on `selection`) | 4.95 | 4.5 | pass |
| 256 | dark | `msg-prompt` (worst on `selection`) | 5.63 | 4.5 | pass |
| 256 | dark | `msg-slash` (worst on `selection`) | 5.63 | 4.5 | pass |
| 256 | dark | `msg-tool` (worst on `selection`) | 4.65 | 4.5 | pass |
| 256 | dark | `msg-question` (worst on `selection`) | 6.17 | 4.5 | pass |
| 256 | dark | `msg-answer` (worst on `selection`) | 6.00 | 4.5 | pass |
| 256 | dark | `msg-denied` (worst on `selection`) | 4.81 | 4.5 | pass |
| 256 | dark | `msg-sent` (worst on `selection`) | 6.60 | 4.5 | pass |
| 256 | dark | `msg-received` (worst on `selection`) | 6.60 | 4.5 | pass |
| 256 | dark | `msg-subagent` (worst on `selection`) | 6.60 | 4.5 | pass |
| 256 | dark | `msg-reply` (worst on `selection`) | 8.95 | 4.5 | pass |
| 256 | dark | `res-normal` (worst on `raised`) | 4.07 | 3.0 | pass |
| 256 | dark | `res-warning` (worst on `selection`) | 6.17 | 4.5 | pass |
| 256 | dark | `res-critical` (worst on `selection`) | 4.81 | 4.5 | pass |
| 256 | dark | `on-res-critical-fill` on `res-critical-fill` | 8.47 | 4.5 | pass |
| 256 | dark | `kind-managed` (worst on `raised`) | 6.54 | 3.0 | pass |
| 256 | dark | `kind-external` (worst on `selection`) | 4.95 | 4.5 | pass |
| 256 | dark | `edge` (worst on `raised`) | 7.66 | 3.0 | pass |
| 256 | dark | `edge-subagent` (worst on `raised`) | 3.84 | 3.0 | pass |
| 256 | light | `fg` (worst on `panel`) | 13.40 | 4.5 | pass |
| 256 | light | `fg-strong` (worst on `panel`) | 15.75 | 4.5 | pass |
| 256 | light | `fg-muted` (worst on `panel`) | 4.76 | 4.5 | pass |
| 256 | light | `fg-faint` (worst on `panel`) | 3.11 | 3.0 | pass |
| 256 | light | `line-control` (worst on `panel`) | 3.11 | 3.0 | pass |
| 256 | light | `focus` (worst on `panel`) | 4.41 | 3.0 | pass |
| 256 | light | `brand` (worst on `panel`) | 4.56 | 4.5 | pass |
| 256 | light | `on-fill-brand` on `fill-brand` | 5.61 | 4.5 | pass |
| 256 | light | `status-working` (worst on `panel`) | 5.07 | 4.5 | pass |
| 256 | light | `status-waiting` (worst on `panel`) | 4.50 | 4.5 | pass |
| 256 | light | `on-status-waiting-fill` on `status-waiting-fill` | 10.16 | 4.5 | pass |
| 256 | light | `status-idle` (worst on `panel`) | 4.76 | 4.5 | pass |
| 256 | light | `status-stale` (worst on `panel`) | 5.53 | 4.5 | pass |
| 256 | light | `status-error` (worst on `panel`) | 5.85 | 4.5 | pass |
| 256 | light | `status-stopped` (worst on `panel`) | 4.76 | 4.5 | pass |
| 256 | light | `mode-default` (worst on `panel`) | 4.76 | 4.5 | pass |
| 256 | light | `mode-plan` (worst on `panel`) | 6.26 | 4.5 | pass |
| 256 | light | `mode-edits` (worst on `panel`) | 5.48 | 4.5 | pass |
| 256 | light | `on-mode-auto` on `mode-auto` | 6.97 | 4.5 | pass |
| 256 | light | `on-mode-bypass` on `mode-bypass` | 5.40 | 4.5 | pass |
| 256 | light | `mode-dontask` (worst on `panel`) | 4.80 | 4.5 | pass |
| 256 | light | `msg-prompt` (worst on `panel`) | 4.56 | 4.5 | pass |
| 256 | light | `msg-slash` (worst on `panel`) | 4.56 | 4.5 | pass |
| 256 | light | `msg-tool` (worst on `panel`) | 5.07 | 4.5 | pass |
| 256 | light | `msg-question` (worst on `panel`) | 4.50 | 4.5 | pass |
| 256 | light | `msg-answer` (worst on `panel`) | 6.26 | 4.5 | pass |
| 256 | light | `msg-denied` (worst on `panel`) | 5.85 | 4.5 | pass |
| 256 | light | `msg-sent` (worst on `panel`) | 5.89 | 4.5 | pass |
| 256 | light | `msg-received` (worst on `panel`) | 5.89 | 4.5 | pass |
| 256 | light | `msg-subagent` (worst on `panel`) | 5.89 | 4.5 | pass |
| 256 | light | `msg-reply` (worst on `panel`) | 13.40 | 4.5 | pass |
| 256 | light | `res-normal` (worst on `panel`) | 4.41 | 3.0 | pass |
| 256 | light | `res-warning` (worst on `panel`) | 4.50 | 4.5 | pass |
| 256 | light | `res-critical` (worst on `panel`) | 5.85 | 4.5 | pass |
| 256 | light | `on-res-critical-fill` on `res-critical-fill` | 5.40 | 4.5 | pass |
| 256 | light | `kind-managed` (worst on `panel`) | 4.41 | 3.0 | pass |
| 256 | light | `kind-external` (worst on `panel`) | 4.76 | 4.5 | pass |
| 256 | light | `edge` (worst on `panel`) | 5.89 | 3.0 | pass |
| 256 | light | `edge-subagent` (worst on `panel`) | 4.76 | 3.0 | pass |

## Failures

None.
