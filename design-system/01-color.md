# Color

Dark is the primary theme and light is a full second theme. The neutrals are a night sky with a slight blue tint. The hues start from the Okabe–Ito colorblind-safe set, brightened for dark grounds and darkened for light ones. Every semantic token carries four values:

- a hex color for the dark theme
- a hex color for the light theme
- an xterm-256 index for each theme
- a 16-color ANSI name, plus the text attribute that 16-color mode needs

All four are on the token's card above and in the tables below.

## How color is spent

- **Grounds step up by elevation:** `bg` (the sky) < `surface` (pane bodies, canvas) < `panel` (sidebars, status bar, status lines, prompt box) < `raised` (nodes, cards, menus). `selection` is a starlight tint, used for the cursor row and chosen options. In the light theme `raised` is white like `surface`, so floating things there are set apart by `line-strong` borders, not by shade.
- **One fill means "needs you".** `status-waiting-fill` (amber) is the only amber fill in the product. It appears on the `? needs you` chip, the question and permission card borders, the map row edge and the status bar counter. Resource warnings use amber *text* (`res-warning`), never the fill.
- **Modes are colored by risk, not by name:**
  - restricted: `mode-plan` (green), `mode-dontask` (slate)
  - asking: `mode-default` (muted)
  - elevated: `mode-edits` (violet text), `mode-auto` (violet fill)
  - unchecked: `mode-bypass` (vermillion fill, plus the hazard edge)

  A filled mode chip runs commands without you.
- **Message types come in families:**
  - your voice, starlight: `msg-prompt`, `msg-slash`
  - work, sky: `msg-tool`
  - waiting, amber: `msg-question`
  - resolved, green: `msg-answer`
  - failure, vermillion: `msg-denied`
  - between sessions, teal: `msg-sent`, `msg-received`, `msg-subagent`
  - prose: `msg-reply` (`fg`)

  Teal is also the color of message edges on the map, so a teal row in the tree always matches a line on the map.
- **Resources escalate in three steps:**
  - normal: `res-normal` (cobalt), with numbers in `fg-muted`
  - warning: `res-warning` (amber text, `△`)
  - critical: `res-critical` (vermillion, bold, `▲`); a passed limit becomes the `res-critical-fill` chip
- **Kinds:** `kind-managed` is starlight with solid borders. `kind-external` is slate with dashed borders.
- **Focus:** `focus` (starlight) is the focused border, the cursor bar and the focus ring. It is the lightest hue in the dark theme and the darkest in the light theme, so focus differs from its surroundings in lightness, not hue alone.

## Colorblind safety

Every distinction that matters has a non-color carrier first. The table gives CIEDE2000 distances for each pair under simulated protanopia, deuteranopia and tritanopia (Machado 2009, full severity). A distance under 10 means color alone would not tell the pair apart for that viewer.

| Pair | Theme | Normal | Protan | Deutan | Tritan | What carries it besides color |
|---|---|---|---|---|---|---|
| needs you vs working | dark | 49 | 52 | 55 | 53 | `?` fill chip vs `●` text |
| needs you vs working | light | 57 | 58 | 65 | 61 | same |
| needs you vs error | dark | 26 | 15 | 8 | 13 | fill chip vs text; `?` vs `×`; the words |
| warning vs critical | dark | 26 | 15 | 8 | 13 | `△` vs `▲`; critical is bold and becomes a fill chip once a limit is passed |
| warning vs critical | light | 20 | 4 | 3 | 12 | same: here only the glyph and weight separate them |
| stale vs error | dark | 30 | 39 | 34 | 14 | `◌` vs `×`; "stale 3h" vs "error" |
| prompt vs tool call | dark | 16 | 5 | 8 | 13 | `›` + bold vs `λ` |
| peer message vs answered | dark | 17 | 21 | 23 | 3 | `→ ←` vs `✓` |
| plan vs edits | dark | 46 | 43 | 37 | 31 | `‖` vs `±`, labels |
| working vs edits | dark | 25 | 6 | 2 | 31 | different slots (status vs mode), `●` vs `±` |
| managed vs external | dark | 14 | 14 | 14 | 13 | `◆` vs `◇`, solid vs dashed, `ext` tag |

The two weakest pairs are warning vs critical in the light theme and working vs edits under deuteranopia. Both are designed so that color is never the only signal: the glyphs differ and the slot or weight differs. Don't remove a glyph from a status, mode or alert to save space; drop the word first, never the glyph.

## Tokens

### Surfaces

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `bg` | `#0a0c10` | 233 | `#f6f7fa` | 255 | `default` | App background behind everything; the sky the map floats on. |
| `surface` | `#0f1218` | 234 | `#ffffff` | 231 | `default` | Pane bodies, conversation and map canvas. |
| `panel` | `#141821` | 235 | `#eef0f5` | 254 | `default` | Tree sidebar, global status bar, pane status lines, prompt box. |
| `raised` | `#1a1f2a` | 236 | `#ffffff` | 231 | `default` | Session nodes, question and permission cards, menus, dialogs. Light theme sets it apart with line-strong, not shade. |
| `hover` | `#1e2431` | 235 | `#e7eaf1` | 255 | `default` | Web pointer hover on rows and chips. The TUI has no hover state. |
| `selection` | `#26304f` | 237 | `#e3e8fb` | 195 | `default` reverse | Selected rows, the tree cursor, chosen options, multi-select picks. 16-color: reverse video. |

### Text

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `fg` | `#e3e7ee` | 254 | `#1a1e28` | 234 | `default` | Body text and conversation, on bg, surface, panel, raised and selection. |
| `fg-strong` | `#f6f8fc` | 231 | `#07090d` | 232 | `default` bold | Session names, the focused pane title, chosen values; always bold. On every surface. |
| `fg-muted` | `#97a0b2` | 248 | `#566074` | 60 | `default` dim | Metadata (project, branch, times, counts), tool output, secondary labels; the TUI's dim. On every surface. |
| `fg-faint` | `#687186` | 244 | `#7c8496` | 244 | `default` dim | Disabled controls, tree guides, placeholder text. Never for information you need: 3:1 only. |

### Lines

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `line` | `#252b38` | 235 | `#dfe2e9` | 254 | `default` dim | Unfocused pane borders and hairline dividers. Decorative; position already says where a pane ends. |
| `line-strong` | `#343c4d` | 237 | `#c9ced8` | 252 | `default` dim | Card and node outlines in the light theme, menu borders, context-bar track. |
| `line-control` | `#666f85` | 244 | `#7a8396` | 244 | `default` | Borders that identify a control: prompt box, inputs, option boxes. 3:1 on every surface. |

### Focus

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `focus` | `#b3c1ff` | 147 | `#3646b3` | 61 | `default` bold | Focused pane border (TUI heavy line, web 2px), focus ring, tree cursor bar. 16-color: heavy border + bold title. |
| `brand` | `#b3c1ff` | 147 | `#3646b3` | 26 | `blue` | The wordmark and the prefix indicator. Never decoration. |
| `fill-brand` | `#b3c1ff` | 147 | `#3949b8` | 61 | `blue` bold | Prefix-active indicator and the primary action in a dialog. |
| `on-fill-brand` | `#0a0c10` | 232 | `#ffffff` | 231 | `bright_white` bold | Text on fill-brand. |

### Status

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `status-working` | `#5cb4f0` | 39 | `#0b67a6` | 25 | `blue` | ● working: the glyph, the word, the activity spinner. On every surface. |
| `status-waiting` | `#f5a524` | 214 | `#855300` | 94 | `yellow` bold | Text form of ? needs you, for flags inside a line. Prefer the fill. |
| `status-waiting-fill` | `#f5a524` | 214 | `#f2a228` | 214 | `yellow` bold | The ? needs you chip. The only amber fill in the product: if it is amber and filled, a session is waiting for you. |
| `on-status-waiting-fill` | `#15100a` | 233 | `#15100a` | 233 | `black` bold | Text on status-waiting-fill. |
| `status-idle` | `#97a0b2` | 248 | `#566074` | 60 | `default` dim | ○ idle: finished its turn, nothing pending. |
| `status-stale` | `#ec8cc4` | 212 | `#a8306f` | 125 | `magenta` | ◌ stale: idle past the forgotten threshold (default 30 min). Glyph, word and age in rose. |
| `status-error` | `#ff6b45` | 209 | `#b42d0c` | 124 | `red` bold | × error: the turn or the process failed. |
| `status-stopped` | `#97a0b2` | 248 | `#566074` | 60 | `default` dim | ■ stopped: exiting or exited; shown in the launcher and resume picker, then leaves the map. |

### Modes

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `mode-default` | `#97a0b2` | 248 | `#566074` | 60 | `default` | · default (Claude Code's manual): asks before edits and commands. |
| `mode-plan` | `#4cc790` | 42 | `#146e45` | 22 | `green` | ‖ plan: reads only until you approve a plan. |
| `mode-edits` | `#b994ff` | 177 | `#6b3fd0` | 92 | `magenta` | ± accept edits: file edits go through without asking. |
| `mode-auto` | `#b994ff` | 141 | `#6b3fd0` | 92 | `magenta` bold | » auto: a classifier approves most actions. Filled chip: runs commands without you. |
| `on-mode-auto` | `#0a0c10` | 232 | `#ffffff` | 231 | `bright_white` bold | Text on mode-auto. |
| `mode-bypass` | `#ff6b45` | 209 | `#c4320c` | 160 | `red` bold | ! bypass permissions: nothing is checked. Filled vermillion chip plus the hazard edge on the pane and node. |
| `on-mode-bypass` | `#0a0c10` | 232 | `#ffffff` | 231 | `bright_white` bold | Text on mode-bypass. |
| `mode-dontask` | `#8e9ab4` | 110 | `#545f77` | 241 | `cyan` | ∅ don't ask: never waits; anything that would ask is denied. Shown with a denied count. |

### Messages

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `msg-prompt` | `#b3c1ff` | 147 | `#3646b3` | 26 | `default` bold | › your prompt (one per turn). Starlight is your voice. |
| `msg-slash` | `#b3c1ff` | 147 | `#3646b3` | 26 | `default` bold | / slash command you ran. |
| `msg-tool` | `#5cb4f0` | 39 | `#0b67a6` | 25 | `blue` | λ tool call (Bash, Edit, Read, Agent …): the glyph and tool name; arguments stay fg-muted. |
| `msg-question` | `#f5a524` | 214 | `#855300` | 94 | `yellow` | ? question or permission asked. Bold while unanswered. |
| `msg-answer` | `#4cc790` | 42 | `#146e45` | 22 | `green` | ✓ question answered, permission allowed. |
| `msg-denied` | `#ff6b45` | 209 | `#b42d0c` | 124 | `red` | × permission denied, tool failed. |
| `msg-sent` | `#45c4c4` | 80 | `#0a6c75` | 23 | `cyan` | → message sent to another session. |
| `msg-received` | `#45c4c4` | 80 | `#0a6c75` | 23 | `cyan` | ← message received from another session (also every message to an external session from you). |
| `msg-subagent` | `#45c4c4` | 80 | `#0a6c75` | 23 | `cyan` | ◦ subagent started, ↑ subagent reported back. |
| `msg-reply` | `#e3e7ee` | 254 | `#1a1e28` | 234 | `default` | ¶ the agent's reply text. |

### Resources

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `res-normal` | `#7f97cc` | 104 | `#4a6293` | 61 | `default` | Sparkline bars and context fill below the warning threshold. |
| `res-warning` | `#f5a524` | 214 | `#855300` | 94 | `yellow` | △ warning: context ≥ 80 %, CPU busy > 5 min, memory/GPU ≥ 80 % of its limit. Text and bars, never a fill. |
| `res-critical` | `#ff6b45` | 209 | `#b42d0c` | 124 | `red` bold | ▲ critical: context ≥ 95 %, a limit passed. Bars and text. |
| `res-critical-fill` | `#ff6b45` | 209 | `#c4320c` | 160 | `red` bold | The ▲ chip in the status bar and on nodes when a limit is passed. |
| `on-res-critical-fill` | `#0a0c10` | 232 | `#ffffff` | 231 | `bright_white` bold | Text on res-critical-fill. |
| `res-track` | `#343c4d` | 237 | `#c9ced8` | 252 | `default` dim | Empty part of the context bar and sparkline baseline. |

### Kinds

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `kind-managed` | `#b3c1ff` | 147 | `#3646b3` | 61 | `default` bold | ◆ managed (started here, full control): the glyph; node and pane borders stay solid. |
| `kind-external` | `#8e9ab4` | 110 | `#545f77` | 60 | `cyan` | ◇ external (started elsewhere, watched): the glyph, the ext tag and the dashed border. |

### Links

| Token | Dark | 256 | Light | 256 | 16 colors | Use |
|---|---|---|---|---|---|---|
| `edge` | `#45c4c4` | 80 | `#0a6c75` | 23 | `cyan` | Message edges on the map and link lanes in the TUI; weight shows volume. |
| `edge-subagent` | `#8e9ab4` | 103 | `#545f77` | 60 | `default` dim | Parent to subagent links (dotted). |

## Palette

Palette entries are the raw values behind the semantic tokens. Components never use them directly.

| Palette entry | Dark | Light | Role |
|---|---|---|---|
| `ground` | `#0a0c10` | `#f6f7fa` | App background, the night sky. |
| `ground-1` | `#0f1218` | `#ffffff` | Pane and canvas body. |
| `ground-2` | `#141821` | `#eef0f5` | Sidebars, status bar, status lines. |
| `ground-3` | `#1a1f2a` | `#ffffff` | Cards, nodes, menus, dialogs. |
| `ground-hover` | `#1e2431` | `#e7eaf1` | Web hover only. |
| `ground-sel` | `#26304f` | `#e3e8fb` | Selection and cursor row, tinted with starlight. |
| `ink` | `#e3e7ee` | `#1a1e28` |  |
| `ink-strong` | `#f6f8fc` | `#07090d` |  |
| `ink-muted` | `#97a0b2` | `#566074` |  |
| `ink-faint` | `#687186` | `#7c8496` |  |
| `rule` | `#252b38` | `#dfe2e9` |  |
| `rule-strong` | `#343c4d` | `#c9ced8` |  |
| `rule-control` | `#666f85` | `#7a8396` |  |
| `star` | `#b3c1ff` | `#3646b3` | Starlight: brand, focus, your own voice. |
| `sky` | `#5cb4f0` | `#0b67a6` | Work in progress. |
| `amber` | `#f5a524` | `#855300` | Needs you. Text form; the fill is amber-fill. |
| `vermillion` | `#ff6b45` | `#b42d0c` | Danger and failure. |
| `rose` | `#ec8cc4` | `#a8306f` | Forgotten (stale) sessions. |
| `green` | `#4cc790` | `#146e45` | Safe and resolved. |
| `teal` | `#45c4c4` | `#0a6c75` | Constellation lines: messages between sessions. |
| `violet` | `#b994ff` | `#6b3fd0` | Elevated autonomy (accept edits, auto). |
| `slate` | `#8e9ab4` | `#545f77` | Watched, not yours (external sessions). |
| `cobalt` | `#7f97cc` | `#4a6293` | Calm resource readings. |
| `amber-fill` | `#f5a524` | `#f2a228` |  |
| `on-amber-fill` | `#15100a` | `#15100a` |  |
| `vermillion-fill` | `#ff6b45` | `#c4320c` |  |
| `on-vermillion-fill` | `#0a0c10` | `#ffffff` |  |
| `violet-fill` | `#b994ff` | `#6b3fd0` |  |
| `on-violet-fill` | `#0a0c10` | `#ffffff` |  |
| `star-fill` | `#b3c1ff` | `#3949b8` |  |
| `on-star-fill` | `#0a0c10` | `#ffffff` |  |

## Fallbacks

**256 colors.** The generator picks each 256-color fallback as follows:

1. Start from indices 16–255 only. Indices 0–15 are the user's own terminal palette and can be anything.
2. Keep the indices that still meet the token's contrast need against the 256-color grounds.
3. Rule out indices already used by a different meaning in the same group, so working and stale can't collapse into one index.
4. From what remains, take the one nearest by CIEDE2000.

The surfaces are pinned:

| Theme | bg | surface | panel | raised | selection |
|---|---|---|---|---|---|
| dark | 233 | 234 | 235 | 236 | 237 |
| light | 255 | 231 | 254 | 231 | 195 |

Rich downgrades truecolor to 256 by rounding, and its gray ramp is off by one at the light end. So the 256 themes feed Textual a value that lands exactly on the chosen index. `report.md` checks every token.

**16 colors.** In 16-color mode the terminal's own palette applies (`Theme(ansi=True)`), so Constellation inherits Solarized, Gruvbox, Dracula or whatever the user runs. Rules for this mode:

- Use only the six normal hues (red, green, yellow, blue, magenta, cyan), plus `default`.
- Don't use bright variants for meaning. Solarized maps `bright_black`, `bright_green`, `bright_yellow`, `bright_blue` and `bright_cyan` to its grays, and `bright_black` equals the Solarized Dark background.
- Muted text is `default` plus **dim**, never `bright_black`.
- Selection and cursor rows use **reverse**.
- Fills are an explicit background plus a fixed foreground:
  - yellow with `black` for needs-you (dark text on yellow works in light and dark terminals)
  - red with `bright_white` for bypass and critical
  - magenta with `bright_white` for auto
- Focus is carried by the border weight (heavy vs light) and a bold title, so it needs no color at all.

**No color** (`NO_COLOR`, or a monochrome terminal). Textual's monochrome filter applies. Everything still reads: statuses through glyphs and words, needs-you through the reversed chip, focus through the heavy border.

## Contrast

Every check passes in both themes, in truecolor and in the 256-color fallback:

- text tokens: 4.5:1 on `bg`, `surface`, `panel`, `raised` and `selection`
- marks: 3:1 on the four grounds
- `on-*` text: 4.5:1 on its fill

`assets/Source/report.md` lists each pair with its worst ground. `line` (about 1.3:1) and `line-strong` are decorative on purpose: an unfocused pane's position already says where it ends. Anything that identifies a control, such as the prompt box, inputs or option boxes, uses `line-control` (3:1 or more).
