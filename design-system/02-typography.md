# Typography

The terminal has no fonts and no sizes: only the user's monospace face, and five attributes (bold, dim, italic, underline, reverse) on top of color. The web follows the same rule so the two clients read as one product. Hierarchy comes from those attributes. Size differences are reserved for web chrome that occupies one line in the TUI.

## Web font stack

```css
--font-mono: "JetBrains Mono", "Cascadia Mono", "SF Mono", Menlo, "DejaVu Sans Mono", ui-monospace, "Symbols Nerd Font Mono", monospace;
font-variant-ligatures: none;
```

- **JetBrains Mono** (OFL, self-hosted from `fonts/`). It covers the box-drawing, block-element and arrow glyphs the TUI uses, so trees, bars and lanes look the same on the web. It lacks `◐` and `★`; Constellation uses neither. Self-hosting is a requirement, not a preference: the server listens on localhost only and nothing should call a font CDN.
- The fallbacks have the same 0.6 em advance, so columns stay aligned if JetBrains Mono fails to load.
- **Symbols Nerd Font Mono** is last in the stack. It supplies Nerd Font icons only when the user has it installed and has turned the tier on. It never replaces a letter.
- **Ligatures off.** `->` must stay two cells, exactly as in the terminal.

## Web text styles

| Style | Size / line | Weight | Use | TUI equivalent |
|---|---|---|---|---|
| `text-body` | 13 / 20 | 400 | Everything by default: conversation, rows, nodes | plain |
| `text-bold` | 13 / 20 | 700 | Session names, focused pane title, chosen values, keys in hints | **bold** |
| `text-dim` | 13 / 20 | 400, `fg-muted` | Metadata, tool arguments and output, timestamps | dim (or `fg-muted` in truecolor) |
| `text-italic` | 13 / 20 | 400 italic | Model-written summaries, placeholders | *italic* |
| `text-link` | 13 / 20 | 400, underline | Jumpable references: files, sessions, message ids | underline |
| `text-chrome` | 12 / 20 | 400 | Status bar, status lines, chips, key hints | plain (same cell) |
| `text-label` | 12 / 16 | 700, `fg-muted` | Section labels: `map`, `tree` | bold dim |
| `text-display` | 24 / 28 | 700 | The wordmark and empty states only | bold |

At 13 px, 1 cell = 1ch ≈ 7.8 px and one line = 20 px. Spacing tokens round the cell to 8 px.

## TUI text-attribute hierarchy

| Attribute | When | Never |
|---|---|---|
| **bold** | Session names; the focused pane's title; the highlighted option; keys in hints; your prompts (`›`); `BYPASS`; critical values | For whole paragraphs. Bold is how the eye finds names |
| dim | Metadata: project, `@branch`, times, counts; tool arguments and output; unfocused key labels; in 16-color mode, every `fg-muted` and `fg-faint` | For anything you must act on |
| *italic* | Model-written summaries; external session names (with `◇`); placeholders in the prompt box | As the only signal. Many terminals draw italic as plain or reverse |
| underline | Jumpable references (a file, a session, a message id); the current step in a multi-question stepper; search matches in the tree | Plain emphasis |
| reverse | Selection in 16-color mode; the current session's index in the status bar; the prompt box caret | For status. Chips use explicit fills so they read the same in every theme |

Combinations:

- **bold + color:** names and active items (`msg-prompt` bold, `status-error` bold).
- **italic + `kind-external`:** an external session's name.
- **dim + italic:** a stale session's latest step.
- **reverse + bold:** the 16-color needs-you chip.

Never combine more than two attributes.

## Hierarchy inside a pane

1. The pane title in the border: bold `fg-strong` when focused, plain `fg` when not.
2. Your prompts: bold `msg-prompt`, with a blank half-line before each new turn on the web (none in the TUI, where turns are separated only by the bold `›`).
3. The agent's reply in `fg`.
4. Tool calls: `λ Tool` in `msg-tool`, with arguments dim. Output stays collapsed to one dim line until opened.
5. The status line in the bottom border: dim, except the context bar and the mode chip, which keep their colors.
