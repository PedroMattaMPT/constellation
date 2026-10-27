# Terminal implementation

How the TUI uses the system, and the Textual details that matter. Everything here is tested: the `Screens` group shows `constellation_specimen.py` rendered with these exact files.

## Files (all in `assets/Source`)

| File | What it is |
|---|---|
| `constellation.tokens.json` | The single source: palette, semantic tokens (hex per theme, xterm-256 pins, ANSI name + attribute), glyph tiers, spacing, radii, strokes, shadows, type, key bindings |
| `build_tokens.py` | Generator, standard library only. `python3 build_tokens.py --check` rebuilds everything and fails if any contrast or 256-color check fails |
| `constellation_theme.py` | Generated. Five Textual `Theme`s, `GLYPHS`, `ANSI_STYLES`, `FILLS`, and the helpers `ConstellationApp`, `apply_theme`, `glyph`, `style`, `chip`, `resolve` |
| `constellation.tcss` | Generated. Status, mode, message, resource and kind classes, chips, layout, panes, prompt box, tree, cards, meters, dialogs |
| `constellation.css` | Generated. Web custom properties, `@font-face`, glyph strings and text style classes |
| `glyphs.ts` | Generated. The glyph table and `glyph()` for the web |
| `report.md` | Generated. Every contrast and 256-color check |
| `constellation_specimen.py` | The main screen and the prompt screen as a runnable Textual app; `--shots DIR` writes the SVG and text renders |

## Themes and color depth

```python
from constellation_theme import ConstellationApp, glyph, style

class Constellation(ConstellationApp):   # registers the themes and picks one in __init__
    THEME_VARIANT = "dark"                 # or "light"
```

| Terminal | Theme | How it's chosen |
|---|---|---|
| truecolor | `constellation-dark` / `constellation-light` | `app.console.color_system == "truecolor"` |
| 256 | `constellation-dark-256` / `constellation-light-256` | `"256"` |
| 16 / Windows | `constellation-ansi` (`Theme(ansi=True)`) | anything else |

`CONSTELLATION_COLOR=truecolor|256|16` overrides detection, and so does `NO_COLOR`.

## Gotchas this system already handles

- **Custom variables must exist before the CSS is parsed.** `ConstellationApp.get_theme_variable_defaults()` returns the dark theme's variables, so `constellation.tcss` parses under any theme.
- **Pick the theme in `__init__`, not `on_mount`.** Textual calls `on_mount` on every class in the MRO, so a base class choosing the theme there would override the subclass.
- **`$token-style` variables.** Every token has a companion variable such as `$fg-muted-style`. It is `none` in truecolor and 256 themes, and `dim`, `bold` or `reverse` in the 16-color theme. Always write `color: $fg-muted; text-style: $fg-muted-style;`; never hard-code `dim`, or truecolor text gets dimmed twice.
- **Content markup vs Rich markup.** Widgets that take Textual content (`Static`, border titles) resolve `$token` themselves: `[$status-working]●[/]`. `Tree` labels are Rich markup, which doesn't, so pass them through `resolve(app, markup)`. `MessageTree.process_label` in the specimen shows how.
- **Fills.** Use `style(app, "status-waiting-fill")`, which returns `bold $on-status-waiting-fill on $status-waiting-fill`, or `chip(app, token, text)`. In 16 colors those variables become `ansi_black on ansi_yellow`, which reads in both light and dark terminal themes.
- **The 256 themes hold "feed" values,** not the xterm palette values. Rich's 8-bit downgrade maps every low-saturation color through `round(lightness × 25)`, which is one step dark at the light end of the gray ramp. The generator feeds the center of each gray bucket so Rich emits exactly the chosen index.
- **Textual's `dashed` border is heavy** (`┏╍┓`). External panes therefore show focus through color and a bold title, not weight.
- **`ansi-background` / `ansi-foreground`** are set in the 16-color theme, because Textual's own widget CSS reads them.

## Widget map

| Component | Textual |
|---|---|
| `StatusBar` | `Static` docked bottom, `height: 1`, rebuilt from session events. Widths are counted with `rich.cells.cell_len`, never `len` |
| Map (TUI form of `SessionNode` + `MessageEdge`) | A `ScrollView` of rows, 1 line each (2 with the step line in wide mode). Lanes are computed by greedy interval colouring, short pairs innermost |
| `TreeRow` | `Tree` subclass `MessageTree` with `ICON_NODE = "▸ "`, `ICON_NODE_EXPANDED = "▾ "`, `guide_depth = 2`, lazy children. The type filter is a one-line `Horizontal` of toggles above it |
| `Pane` | `Vertical` with `border_title` (header) and `border_subtitle` (status line). Contains a virtualized conversation (`ListView` or a `ScrollView` of `Static`s, collapsed tool output), the optional dock and a `TextArea`-based `PromptBox` |
| `CommandMenu`, `ModelPicker`, `ResumePicker` | `OptionList` subclasses with `border: round $line-strong`; the resume picker is a `Horizontal` of `OptionList` + preview `Static` |
| `QuestionCard`, `PermissionPrompt` | `Vertical` with `border: round $status-waiting-fill`, a title chip, `RadioSet` or `SelectionList` for options, an `Input` for Other, changes and reasons |
| `ContextBar`, `Sparkline` | `Static` drawing eighth-blocks; Textual's own `Sparkline` also works with `.sparkline--max-color` set to the level |
| `SessionLauncher`, `ConfirmStop`, `BroadcastPrompt` | `ModalScreen`s with `round` borders (`status-error` for stop, `edge` for broadcast) |
