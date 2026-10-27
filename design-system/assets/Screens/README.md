# Screens

Real renders of `constellation_specimen.py`, a Textual app styled only by the generated `constellation_theme.py` and `constellation.tcss`. They are not mockups drawn by hand. Each is 160 × 46 cells (the prompt screens 132 × 26), exported through Rich's SVG exporter and rasterized at 2×. The SVG exporter draws its own window frame; the font is the renderer's monospace fallback, so line weights look lighter than in a real terminal.

- `main-dark.png`: the main screen (tree, map with lanes, two panes, status bar), truecolor, dark theme. The reference.
- `main-light.png`: the same in the light theme.
- `main-dark-256.png`: the `constellation-dark-256` theme rendered through a 256-color console, so you see the xterm palette values the terminal will draw.
- `main-16-solarized-dark.png`, `main-16-solarized-light.png`: the 16-color theme (`ansi=True`) under the Solarized Dark and Light palettes. Solarized maps most bright colors to grays, which is why the 16-color theme uses only the six normal hues, dim and reverse.
- `main-ascii.png`: the ASCII glyph tier (`CONSTELLATION_GLYPHS=ascii`).
- `prompts-dark.png`, `prompts-light.png`: a permission prompt docked in a focused pane, and the `/` menu over a prompt box.

Use them to check a TUI change against the expected look: run `python3 constellation_specimen.py --shots DIR` and compare.
