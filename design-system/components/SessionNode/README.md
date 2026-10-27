# SessionNode

One running session on the map: name, project, branch, mode, status, time since last activity, the task it was given and its latest step, in four rows of cells.

**Anatomy** (40ch wide, 1 cell padding):

1. **Head:** `[x]` when selected, kind `◆`/`◇`, index, **name**, `ext` tag, then `StatusBadge` on the right.
2. **Meta:** project, `@branch`, then `ModeBadge` and the time since last activity, right-aligned.
3. **Task:** the first prompt or its title, one line, end-ellipsis.
4. **Step:** the activity spinner while working, `×` on error, `›` otherwise, then the latest step (`Edit src/limits/route.ts`, `asked: Which session store?`).
5. **Optional:** a model-written summary, italic. It appears only after you press `s` on the node.
6. **Optional:** a resource row with `ContextBar` (6 cells), a CPU `Sparkline` (last 12 minutes) and an `AlertFlag`.
7. **Subagents** hang below as `SubagentNode`s on a dotted link.

| State | Web | TUI |
|---|---|---|
| default | `raised`, 1 px `line-strong` | map row, plain |
| focused | `focus` border + 1 px ring | `▌` in `focus`, bold name, lanes for its pairs in `focus` |
| selected (for broadcast) | `selection` ground, `[x]` | `selection` row, `[x]` |
| disabled (stopped, leaving the map) | `fg-faint`, `line` border, no fills or edges, no key hints | dim row |
| needs attention | amber border + 3 px amber edge, `? needs you` chip, pulled to the top of its group | amber chip in the status column, `outer` left edge in `status-waiting-fill` |
| stale | 3 px `status-stale` edge, `◌ stale 3h`, step dim italic | rose status, dim italic step |
| error | 3 px `status-error` edge, `× error`, step in `status-error` | same |
| external | dashed `kind-external` border, `◇`, `ext` | `◇`, italic name in `kind-external`, `ext` |
| bypass | 3 px hazard stripe on top, `! BYPASS` chip | `! BYPASS` chip |
| compact | one line: kind, name, status glyph, mode glyph, time | map row without the step |

**TUI form.** The terminal map is a table, not a graph: one row per session grouped by project (fixed columns: project 13, kind, name 15, status 13, mode 11, branch 17, time 4, alert 6, step), with message lanes at the right edge. 15 sessions fit in 16 lines.

**Consumer provides:** `name`, `project`, `branch`, `mode`, `status`, `kind`, `ago`, `task`, `step`; optional `summary`, `ctx`, `cpu` (30 samples), `alert`, `subagents`, `index`, `focused`, `selected`, `disabled`, `compact`. In React Flow, render it as the custom node body and put handles on the left and right edges.

**Do:** sort waiting sessions to the top of each project group. Keep the node width fixed so groups line up. Show the step in present tense, as it happens.
**Don't:** color the whole node by status. Don't hide the mode. Don't show a summary unless it was asked for.

**Keys (map focused):** `h j k l` move · `enter` open in a pane · `space` select · `e` cycle edges · `s` summary · `,` rename · `&` stop.
