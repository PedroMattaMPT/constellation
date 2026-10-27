Constellation is a control room for the 5 to 15 Claude Code sessions you keep open at once. One local server holds the sessions; a Textual terminal UI and a React web app attach to it. This system is written once for both clients. Every color, glyph and key binding lives in `assets/Source/constellation.tokens.json`. `build_tokens.py` turns that file into the Textual themes, the TCSS, the web CSS and the tokens on this page. Change the source, rebuild, and never edit a generated file.

## Principles

1. **Spend color on what needs you.** Only one fill is reserved: amber `status-waiting-fill` means "a session is waiting for your answer". Working, idle and finished states stay quiet. If a screen shows more than a few loud things, every one of them should be a session that needs you.
2. **One product, two renderers.** Design in cells. A web component may use only what the terminal also has: one typeface, one text size, bold, dim, italic, underline, reverse, color and box lines. The web adds only pointer affordances. Count web spacing in cells (8 px) and lines (20 px). If it can't be drawn in Textual, it doesn't go in the web app.
3. **Glyph, then word, then color.** Every status, mode, message type and alert has a glyph and a label, and color only reinforces them. The UI has to survive truecolor → 256 colors → 16 colors → ASCII → monochrome and lose nothing but tint.
4. **The whole sky on one screen.** At 160 × 46 cells, all 15 sessions fit on the map as one row each, next to two working panes. The status bar lists all of them. One line per thing. Truncate names before metadata, and never truncate a session that is waiting.
5. **Risk is always visible.** A session's mode appears wherever its name does. Elevated modes are colored, `auto` and `bypass` are filled chips, and bypass also carries the hazard edge. Stopping a session, broadcasting a prompt and choosing bypass each take a second key that names the target.
6. **Keyboard first, tmux-literate.** There is one prefix, `C-Space`. After it, Constellation uses tmux's own letter wherever tmux has one (`c , & % " z x d [ : ?`). Inside a pane, Claude Code's own keys work (`Esc`, `Esc Esc`, `S-Tab`, `/`). Every action shows its key where it is offered.
7. **Yours or watched, never ambiguous.** Managed sessions are solid: `◆` and solid borders. External sessions are dashed: `◇`, dashed borders and the `ext` tag. Controls an external session can't take stay on screen and say why ("adopt to answer").

## Using this system

- Components use semantic tokens only:
  - grounds: `bg` < `surface` < `panel` < `raised`, and `selection`
  - text: `fg`, `fg-strong`, `fg-muted`, `fg-faint`
  - meaning: `status-*`, `mode-*`, `msg-*`, `res-*`, `kind-*`, `edge`, `edge-subagent`
  - interaction: `focus`, `fill-brand`

  Palette entries (`ground-*`, `ink-*`, `rule-*`, `star`, `sky`, `amber` …) are the raw values behind those tokens. Never reference them from a component.
- Text on a fill uses the fill's `on-*` token: `on-status-waiting-fill`, `on-mode-auto`, `on-mode-bypass`, `on-res-critical-fill`, `on-fill-brand`. Never use literal white or black.
- Contrast holds in both themes and in the 256-color fallback:
  - Text tokens meet 4.5:1 on `bg`, `surface`, `panel`, `raised` and `selection`.
  - Marks (`focus`, `line-control`, `res-normal`, `edge`, `kind-managed`, `fg-faint`) meet 3:1.
  - `fg-faint` is therefore never for text someone has to read. Placeholders, filtered-out rows and switched-off chips take `fg-muted`; `fg-faint` stays on disabled controls, guides and separators.
  - `line` and `line-strong` are decorative.

  `assets/Source/report.md` lists every pair.
- **Web:** load `assets/Source/constellation.css`. It defines the custom properties, with dark as the default, light under `[data-theme="light"]`, and a `prefers-color-scheme` fallback. Load the components from `components/bundle.js` (`window.Constellation`, React 18) with `components/bundle.css`. `SessionNode` and `MessageEdge` are React Flow custom node and edge bodies.
- **Terminal:** subclass `ConstellationApp` from `constellation_theme.py`. It registers dark, light, dark-256, light-256 and 16-color themes and picks the right one for the terminal. Style widgets with `constellation.tcss`.
- **Glyphs:** take them from `glyph(category, name)` (`GLYPHS` in Python, `glyphs.ts` on the web). Never type a glyph literal into a component; the ASCII and Nerd Font tiers depend on that.
- Show a key hint next to every action. In footers it reads `key label` (key in `focus` bold, label in `fg-muted`). In menus the key sits right-aligned. Chords use tmux notation: `C-Space`, `S-Tab`, `M-Enter`.

## Content fundamentals

- **Voice:** terse, lowercase, present tense. Actions are verbs: "stop", "adopt", "send to 3", "allow once". Full sentences appear only in dialogs, errors and the agent's own text.
- **State words, exactly:** `working`, `needs you`, `idle`, `stale 3h`, `error`, `stopped`. **Mode words:** `default`, `plan`, `edits`, `auto`, `BYPASS`, `no-ask`. `BYPASS` is the only uppercase word in the product.
- **Numbers:** relative, short times (`4s`, `12m`, `3h`, `2d`); tokens in thousands (`182k → 41k`); cost as `$1.84`; percentages with no space (`83%`); limits as `21.4/20 GB`.
- **Names:** sessions are kebab-case slugs (`auth-refactor`). Projects are the folder name. Branches carry `@` (`@feat/auth-split`).
- **Truncation:** shorten paths in the middle (`src/…/route.ts`) and prose at the end (`Split the auth midd…`). Never truncate a key hint, a mode label or a waiting session's name.
- No emoji. No exclamation marks except the bypass glyph.
- Text written by a model (summaries on request) is always italic and labeled as such, so it is never mistaken for what the session actually did.

Examples from the product:

> `? needs you` · `● working` · `◌ stale 3h` · `» auto` · `! BYPASS`
> `stop auth-refactor?  The process ends. Its transcript stays: /resume brings it back.`
> `external session · answer it in its terminal, or A adopt to answer here`
> `1-3 pick  o other  tab next  esc later`

## Visual foundations

- **Color:** night-sky neutrals with a slight blue tint, plus Okabe–Ito-derived hues. Each hue has one job: starlight for you and focus, sky for work, amber for needs-you, vermillion for danger, rose for forgotten, green for safe and resolved, teal for links between sessions, violet for elevated autonomy. See **Color**.
- **Type:** one monospace face (JetBrains Mono on the web, the user's font in the terminal) at one size, 13/20. The hierarchy comes from bold, dim, italic, underline and reverse. See **Typography**.
- **Cells:** 1 cell = 8 px, 1 line = 20 px. Padding is `0 1` everywhere: no vertical padding inside rows, one cell at the sides. See **Spacing, layout and borders**.
- **Borders say what a thing is:**
  - square solid: tiled (panes, sidebars)
  - heavy: focused
  - round: floating (cards, menus, dialogs)
  - dashed: external
  - double: zoomed

  The web uses the same border vocabulary: 1 px and 2 px lines, radius 0 for tiles and 4 px for floating things.
- **Focus:**
  - A focused pane gets a heavy `focus` border in the TUI and a 2 px `focus` border on the web; its title turns bold `fg-strong`.
  - The focused row gets `selection` plus the `▌` cursor bar in `focus`.
  - On the web, keyboard focus on a control draws `ring-focus`. A full-width row in a scrolling list draws `ring-focus-inset`, because the list would clip an outer ring.
- **States:** every component defines five.
  - default: quiet
  - focused: `focus` border or `▌` bar
  - selected: `selection` ground, plus `[x]` in multi-select
  - disabled: `fg-faint`, with no key hint; fills and attention edges drop out. Never fade a disabled thing with opacity.
  - needs attention: amber fill chip plus a 3-px amber edge, and it surfaces in the status bar
- **Motion:** three things move: the activity spinner (`▖▘▝▗`, 120 ms), the text caret, and a message in flight, whose edge runs its dashes twice and stops (`MessageEdge`). Nothing transitions longer than 120 ms. Reduced motion stops all three. A waiting session never blinks, because blinking is noise when five things wait at once.
- **Elevation:** only floating things cast a shadow, and only on the web (`shadow-float`). In the terminal, a round border marks a floating thing instead.

## Iconography

Constellation uses glyphs, not icons. The default tier is Unicode that renders in standard monospace fonts. Every glyph has an ASCII fallback, used when the locale is not UTF-8 or `CONSTELLATION_GLYPHS=ascii` is set. An optional Nerd Font tier adds Font Awesome codepoints (U+F000–F2E0) and the Powerline branch (U+E0A0). No emoji: they render two cells wide and in color. There is no logo. The wordmark is the word `constellation` set in `text-display` (web) or bold (TUI). See **Glyphs** for every glyph and its font coverage.

## What is here

- **Sections:** Color · Typography · Spacing, layout and borders · Glyphs · Keyboard · Screens (ASCII mockups and the web layout) · Claude Code features · Terminal implementation.
- **Components** (web and TUI variants on every card):
  - map: `SessionNode`, `MessageEdge`
  - tree: `TreeRow`
  - panes: `Pane`, `StatusBar`
  - commands: `CommandMenu`, `ModelPicker`
  - answering: `QuestionCard`, `PermissionPrompt`
  - resources: `ContextBar`, `Sparkline`
  - sessions: `SessionLauncher`, `BroadcastPrompt`
  - atoms: `StatusBadge`, `ModeBadge`, `Kbd`, `TuiFrame`
- **Assets:**
  - `Screens`: real renders of the Textual specimen in every theme, at 256 and 16 colors, and in ASCII.
  - `Source`: the token source, the generator, the generated Textual theme, TCSS, CSS and `glyphs.ts`, the contrast report and the specimen app.
