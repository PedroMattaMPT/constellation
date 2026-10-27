# Glyphs

Glyphs carry meaning before color does. There are three tiers:

| Tier | When | Source |
|---|---|---|
| **unicode** (default) | UTF-8 locale | Geometric shapes, arrows, box drawing, block elements. Every glyph is one cell wide and none has an emoji presentation |
| **ascii** | `CONSTELLATION_GLYPHS=ascii`, or a non-UTF-8 locale | One printable ASCII character per glyph, unique within its category |
| **nerd** (optional) | `CONSTELLATION_GLYPHS=nerd`, and only if the user says a Nerd Font is installed | Font Awesome 4 codepoints (U+F000–F2E0) and the Powerline branch U+E0A0, which all Nerd Font versions keep in place |

Rules:

- **Get glyphs through `glyph(category, name)`.** Never type a literal into a component. The tier is resolved once at startup.
- **One meaning per glyph within a category.** Across categories, the slot tells them apart: a status glyph always sits in the status column, a mode glyph always next to its label.
- **The shape grammar:**
  - Filled means active or yours: `●` working, `◆` managed, `▲` critical.
  - Hollow means at rest or watched: `○` idle, `◇` external, `△` warning.
  - Dotted means fading: `◌` stale.
  - The odd shape out is the one that needs you: `?`.
- **Avoid emoji-capable code points.** `⚠ ⚙ ▶ ◀ ▪ ▫ ‼ ✔ ↩ ⏸ ⏵ ↗ ↘` can render two cells wide and in color in some terminals, which breaks alignment.
- **East Asian width:** shapes like `● ○ ■ ◆` are "ambiguous width". In CJK locales some terminals draw them two cells wide. If the terminal reports that, Constellation switches to the ascii tier.
- **No logo, no pictures.** A session is a star (`◆`), links are lines (`─ ━ ═`), and that is the whole metaphor.

### Status

| Name | Glyph | ASCII | Nerd Font | Label | Means | Fonts with it |
|---|---|---|---|---|---|---|
| `working` | `●` | `*` | U+F111 | working | the turn is running (tools, thinking, streaming) | 6/7 |
| `waiting` | `?` | `?` | U+F059 | needs you | stopped to ask you: a question or a permission prompt | 7/7 |
| `idle` | `○` | `o` | U+F10C | idle | turn finished, nothing pending | 6/7 |
| `stale` | `◌` | `~` | U+F017 | stale | idle past the forgotten threshold (30 min default) | 5/7 |
| `error` | `×` | `x` | U+F00D | error | the turn or the process failed | 7/7 |
| `stopped` | `■` | `#` | U+F04D | stopped | exiting or exited (launcher, resume picker) | 6/7 |

### Mode

| Name | Glyph | ASCII | Nerd Font | Label | Means | Fonts with it |
|---|---|---|---|---|---|---|
| `default` | `·` | `.` | U+F007 | default | asks before edits and commands (Claude Code calls it manual) | 7/7 |
| `plan` | `‖` | `=` | U+F04C | plan | reads only until you approve a plan | 5/7 |
| `acceptEdits` | `±` | `+` | U+F040 | edits | file edits go through without asking | 7/7 |
| `auto` | `»` | `>` | U+F04E | auto | a classifier approves most actions | 7/7 |
| `bypassPermissions` | `!` | `!` | U+F071 | BYPASS | nothing is checked | 7/7 |
| `dontAsk` | `∅` | `0` | U+F05E | no-ask | never waits; unapproved calls are denied | 4/7 |

### Message types

| Name | Glyph | ASCII | Nerd Font | Label | Means | Fonts with it |
|---|---|---|---|---|---|---|
| `project` | `⌂` | `=` | U+F07B | project | a project folder (tree root) | 5/7 |
| `prompt` | `›` | `$` | U+F120 | prompt | your prompt, one per turn | 7/7 |
| `slash` | `/` | `/` | / | command | a slash command you ran | 7/7 |
| `tool` | `λ` | `&` | U+F0AD | tool | a tool call (Bash, Edit, Read, Agent …) | 6/7 |
| `question` | `?` | `?` | U+F059 | asked | a question or permission prompt asked | 7/7 |
| `answer` | `✓` | `v` | U+F00C | answered | answered, allowed | 5/7 |
| `denied` | `×` | `x` | U+F05E | denied | denied, or a tool failed | 7/7 |
| `sent` | `→` | `>` | U+F1D8 | sent | message sent to another session | 7/7 |
| `received` | `←` | `<` | U+F112 | received | message received from another session | 7/7 |
| `subagent_started` | `◦` | `+` | U+F0E8 | subagent | a subagent started | 5/7 |
| `subagent_reported` | `↑` | `^` | U+F122 | reported | a subagent reported back | 7/7 |
| `reply` | `¶` | `"` | U+F075 | reply | the agent's reply | 7/7 |

### Alert

| Name | Glyph | ASCII | Nerd Font | Label | Means | Fonts with it |
|---|---|---|---|---|---|---|
| `normal` | `·` | `.` | U+F111 | ok | below every threshold | 7/7 |
| `warning` | `△` | `^` | U+F071 | warn | context ≥ 80 %, CPU busy > 5 min, memory/GPU ≥ 80 % of its limit | 4/7 |
| `critical` | `▲` | `!` | U+F06A | CRIT | context ≥ 95 %, or a limit passed | 6/7 |

### Kind

| Name | Glyph | ASCII | Nerd Font | Label | Means | Fonts with it |
|---|---|---|---|---|---|---|
| `managed` | `◆` | `+` | U+F005 | managed | started from Constellation; full control | 5/7 |
| `external` | `◇` | `:` | U+F06E | ext | started elsewhere; watched, messaged, adoptable | 4/7 |

### Tree, graph and meters

| Element | Glyphs | ASCII | Fonts with it |
|---|---|---|---|
| tree `collapsed` | `▸` | `+` | 4/7 |
| tree `expanded` | `▾` | `-` | 4/7 |
| tree `branch` | `├─` | `|-` | 7/7 |
| tree `last` | `└─` | ``-` | 7/7 |
| tree `pipe` | `│ ` | `| ` | 7/7 |
| tree `cursor` | `▌` | `>` | 7/7 |
| graph `edge_light` | `─` | `-` | 7/7 |
| graph `edge_heavy` | `━` | `=` | 6/7 |
| graph `edge_double` | `═` | `#` | 7/7 |
| graph `lane_light` | `│` | `|` | 7/7 |
| graph `lane_heavy` | `┃` | `|` | 6/7 |
| graph `lane_double` | `║` | `H` | 7/7 |
| graph `arrow_in` | `◂` | `<` | 4/7 |
| graph `arrow_out` | `▸` | `>` | 4/7 |
| graph `corner` | `╭╮╰╯` | `++++` | 6/7 |
| graph `dashed` | `┄┆` | `-:` | 6/7 |
| graph `subagent` | `└◦` | ``+` | 5/7 |
| activity spinner (120 ms) | `▖ ▘ ▝ ▗` | `- \ | /` | 6/7 |
| context bar (eighths) | `▏▎▍▌▋▊▉█` | `[####----]` | 6/7 |
| sparkline | `▁▂▃▄▅▆▇█` | `_.--==##` | 6/7 |
| misc `branch` | `@` | `@` | 7/7 |
| misc `separator` | `│` | `|` | 7/7 |
| misc `ellipsis` | `…` | `~` | 7/7 |
| misc `radio_on` | `(●)` | `(*)` | 6/7 |
| misc `radio_off` | `( )` | `( )` | 7/7 |
| misc `check_on` | `[x]` | `[x]` | 7/7 |
| misc `check_off` | `[ ]` | `[ ]` | 7/7 |
| misc `image` | `▣` | `[img]` | 3/7 |
| misc `mcp` | `mcp` | `mcp` | 7/7 |

Fonts checked: DejaVu Sans Mono, JetBrains Mono, Hack, Fira Code, Source Code Pro, IBM Plex Mono, Liberation Mono. A glyph missing from the terminal's font is drawn from the fallback font in the same cell (fontconfig on Linux, CoreText on macOS); DejaVu Sans Mono, present on nearly every Linux desktop, has every glyph in the default tier.

## Reading the graph glyphs

- **Edge weight shows volume:** `─` for 1–2 messages, `━` for 3–9, `═` for 10 or more. Lanes use the matching verticals `│ ┃ ║`.
- **`◂` marks the receiving end** of a lane. A pair of sessions that messaged both ways has arrowheads at both ends.
- **In the TUI, one lane per pair of sessions,** weighted by the total. The web draws one directed edge per direction.
- **Subagents** hang under their parent as `└◦ name`, joined by a dotted (`┄ ┆`) link.
