# ModeBadge

A session's permission mode, colored by risk. Restricted and asking modes are text; modes that run commands without you are filled chips.

| Mode | Glyph | ASCII | Token | Treatment | Means |
|---|---|---|---|---|---|
| plan | `‖` | `=` | `mode-plan` | green text | reads only until you approve a plan |
| dontAsk | `∅` | `0` | `mode-dontask` | slate text | never waits; unapproved calls are denied |
| default | `·` | `.` | `mode-default` | muted text | asks before edits and commands |
| acceptEdits | `±` | `+` | `mode-edits` | violet text | edits files without asking |
| auto | `»` | `>` | `mode-auto` / `on-mode-auto` | violet **fill** | a classifier approves most actions |
| bypassPermissions | `!` | `!` | `mode-bypass` / `on-mode-bypass` | vermillion **fill**, `BYPASS`, plus the hazard edge on pane and node | nothing is checked |

`KindMark` lives on this card too: `◆` managed (`kind-managed`) and `◇` external (`kind-external`, with the `ext` tag).

**16 colors:** auto is reverse magenta and bypass is reverse red + bold, so both stay filled without truecolor.

**Don't:** shorten `BYPASS`. Don't use the mode color on anything but the badge and the bypass edge.
