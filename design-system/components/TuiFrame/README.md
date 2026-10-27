# TuiFrame

Draws a terminal snippet on the web from Textual-style markup with token names. Every card in this system uses it for its TUI variant, and the web app uses it for help screens and for showing what an external session's terminal looks like.

**Markup:**

- `[b]` bold, `[d]` dim, `[i]` italic, `[u]` underline, `[r]` reverse
- `[status-working]` a color token
- `[on:panel]` a background token
- `[chip:status-waiting-fill]` a fill with its `on-*` color
- `\[` a literal bracket

Tags don't nest; `[/]` closes the open one.

**Helpers** on `Constellation.tui`:

- `vlen(markup)`: visible width
- `pad(markup, w)`
- `cols([[markup, width], …])`: fixed columns
- `box({width, title, footer, lines, border, kind})`: Textual `solid` / `heavy` / `round` / `dashed` / `double` borders, with the title in the top border and the subtitle in the bottom one

**Rendering:** `bg` ground, a 13 px mono face with a 17 px line, so box lines join the way they do in a terminal cell.

**Don't:** use it for real terminal output; it isn't an emulator. Constellation never embeds a terminal.
