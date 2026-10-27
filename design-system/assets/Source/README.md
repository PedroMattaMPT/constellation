# Source

The single source of truth and everything generated from it. Edit `constellation.tokens.json`, run `python3 build_tokens.py --check`, and commit the outputs. Never edit a generated file by hand.

| File | Kind | What it is |
|---|---|---|
| `constellation.tokens.json` | source | Palette (hex per theme, optional xterm-256 pins), semantic tokens (palette ref, role, ANSI color + attribute, usage), glyph tiers (unicode / ascii / nerd + labels), spacing in px and cells, radii, strokes, shadows, type, key bindings |
| `build_tokens.py` | generator | Standard library only. Writes the files below into `build/`. `--check` exits 1 when a contrast or 256-color check fails |
| `constellation_theme.py` | generated | Textual themes `constellation-dark`, `-light`, `-dark-256`, `-light-256`, `-ansi`; `ConstellationApp` base class; `glyph()`, `style()`, `chip()`, `resolve()`; `GLYPHS`, `ANSI_STYLES`, `FILLS` |
| `constellation.tcss` | generated | Textual CSS for every component, written against theme variables only |
| `constellation.css` | generated | Web custom properties: dark default, `[data-theme="light"]`, `prefers-color-scheme`; `@font-face`; glyph strings (`--glyph-status-working`); text style classes |
| `glyphs.ts` | generated | The glyph table and `glyph()` for the React app (the component bundle imports it) |
| `report.md` | generated | Every contrast pair (truecolor and 256, both themes) and the 256-color landing check |
| `constellation_specimen.py` | reference | The main screen and the prompt screen as a runnable Textual app; `--shots DIR` writes the renders in `Screens` |
| `JetBrainsMono-OFL.txt` | license | SIL Open Font License for the bundled JetBrains Mono files in `fonts/` |

Requirements: Python 3.10+. The specimen needs Textual 2 or later; it was built and rendered with Textual 8.2.
