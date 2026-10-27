# Spacing, layout and borders

## Cells and lines

The terminal is a grid of cells, so the web is too.

| TUI | Web | Token |
|---|---|---|
| 1 cell | 8 px (≈ 1ch at 13 px) | `cell-1` |
| 2 cells (one tree level) | 16 px | `cell-2` |
| 3 cells | 24 px | `cell-3` |
| 4 cells (gutter between project clusters) | 32 px | `cell-4` |
| 1 line | 20 px | `row-1` |
| 2 lines (a compact node, a map lane) | 40 px | `row-2` |
| — | 10 px, web only, inside cards | `row-half` |

Padding inside rows, panes, menus and cards is `0 1`: no vertical padding and one cell at each side. On the web that is `0 8px` with a 20 px line. `row-half` is the only spacing the TUI can't express, so it never goes between rows; it only adds breathing room inside a web card.

## Main screen layout

| Region | TUI | Web |
|---|---|---|
| Status bar | 1 line, docked bottom, `panel` | 24 px, docked bottom |
| Message tree | 34 cells, left, `panel`, toggled with `prefix t` | 280 px, resizable 220–420 px |
| Map | top of the right column, height auto, at most 50 % | React Flow canvas, top, resizable split |
| Panes | the rest, split by `prefix %` and `prefix "` | CSS grid of panes, drag the gutters |

**By terminal width:**

- **160 columns or more:** everything shows. The tree, the map with one row per session, and two side-by-side panes.
- **120 to 159 columns:** the tree collapses and opens as an overlay with `prefix t`. The map drops the latest-step column and keeps the lanes.
- **Under 120 columns:** one pane at a time. The map becomes window `0` and you switch to it with `prefix 0` or `prefix g`.

The web uses the same three layouts at 1280 px and 960 px.

## Borders

A border tells you what kind of thing it surrounds. The same vocabulary works in Textual and on the web.

| Meaning | TUI (Textual border) | Web |
|---|---|---|
| Tiled, at rest: panes, sidebars | `solid` `┌─┐` in `line` | 1 px `line`, radius 0 |
| Focused | `heavy` `┏━┓` in `focus` | 2 px `focus` |
| Floating: cards, menus, pickers, dialogs | `round` `╭─╮` in `line-strong` | 1 px `line-strong`, radius 4 px (`radius-card`), `shadow-float` |
| Waiting for you | `round` in `status-waiting-fill`, title as a fill chip | 1 px `status-waiting-fill` plus a 3 px left edge |
| External session | `dashed` `┏╍┓` in `kind-external` | 1 px dashed `kind-external` |
| Zoomed pane | `double` `╔═╗` in `focus` | 3 px double `focus` |
| Bypass permissions | title on a `mode-bypass` fill | a 3 px diagonal-stripe hazard edge along the top |
| Danger dialog (stop) | `round` in `status-error` | 1 px `status-error` |
| Broadcast | `round` / heavy prompt edge in `edge` | 1 px `edge`, 2 px teal prompt edge |

Textual has no light dashed border (`dashed` is drawn heavy). An external pane therefore shows focus through color and a bold title rather than line weight.

## Focused vs unfocused panes

| | Unfocused | Focused |
|---|---|---|
| Border | `solid` in `line` (1 px on the web) | `heavy` in `focus` (2 px) |
| Title | `fg`, plain | `fg-strong`, bold; the index becomes a `fill-brand` chip |
| Status line | dim | `fg` for model and cost; colors kept |
| Prompt box edge | `line` | `line-control` |
| Caret | hidden | shown |

## Pane anatomy

| Part | TUI | Web |
|---|---|---|
| Header | Lives in the top border (`border_title`): `index name ◆ project … status`. Saves a line per pane | 24 px `panel` row |
| Conversation | Fills the rest. Glyph gutter 2 cells, text after it. Long output is collapsed. Virtualized to stay fast at thousands of messages | Same |
| Dock | Optional: a question card, permission prompt or `/` menu sits between conversation and prompt box, so the answer is where your hands are | Same |
| Prompt box | 1 to 6 lines, `›` marker, hairline above | Same |
| Status line | In the bottom border (`border_subtitle`): `model │ @branch │ ctx bar │ mode │ cost`. When narrow, drop cost first, then branch | 24 px `panel` row |

## Density rules

- One line per item everywhere: tree rows, menu items, status bar entries, map rows.
- No blank lines in the TUI except inside cards.
- Right-align numbers (times, counts, percentages) so their columns line up.
- Map rows use fixed columns: project 13, kind 1, name 15, status 13, mode 11, branch 17, ago 4, alert 6, step (whatever is left), then lanes.
- 15 sessions plus a header fit in 16 lines.
