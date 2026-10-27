# Keyboard

Everything can be done from the keyboard. The model is tmux: one prefix key, then a single key, and tmux's own letter wherever tmux has one. Inside a pane, Claude Code's own keys keep working, so nothing you know from `claude` changes.

## The prefix: `C-Space`

- **Not `C-b`.** Many users run Constellation inside tmux, where `C-b` is taken. Claude Code also uses it for "move to background".
- **Not `C-a`.** The prompt box is a readline-style editor, where `C-a` means start of line. Browsers use it for select-all.
- **`C-Space` is free** in readline, in Claude Code, in tmux's defaults and in Linux browsers. Textual receives it as `ctrl+space` / `ctrl+@`.
- **Setting:** `keys.prefix`. The suggested alternative is `C-a`. On macOS the web client warns that `⌃Space` switches input sources by default.
- **Press the prefix twice** to send it to the pane.

After the prefix, Constellation waits for one key. If none comes within 600 ms, the which-key overlay (`Kbd` card) lists what is available, grouped by attention, sessions, and panes & windows. `prefix ?` lists every binding.

## Bindings

### After the prefix (C-Space)

| Key | Does |
|---|---|
| `a` | jump to the next session that needs you |
| `A` | list everything waiting, oldest first |
| `c` | start a session (launcher) |
| `,` | rename the focused session |
| `&` | stop the focused session (asks first) |
| `x` | close the pane (the session keeps running) |
| `%` | split: new pane to the right |
| `"` | split: new pane below |
| `z` | zoom / unzoom the pane |
| `h j k l / arrows` | move to the pane in that direction |
| `o` | next pane |
| `0-9` | go to window n (0 is the map) |
| `n p` | next / previous window |
| `'` | go to session by number or name |
| `g` | show / hide the map |
| `t` | show / hide the message tree |
| `b` | send one prompt to several sessions |
| `r` | resume picker (/resume) |
| `f` | find in every conversation |
| `[` | scroll mode in the pane (vi keys, / to search) |
| `:` | command prompt |
| `?` | list every binding |
| `d` | detach this client (sessions keep running) |
| `C-Space` | send the prefix key itself |

### In a pane (no prefix: Claude Code’s own keys)

| Key | Does |
|---|---|
| `enter` | send prompt |
| `alt+enter / ctrl+j` | new line in the prompt |
| `/` | command menu (at the start of the prompt) |
| `@` | mention a file |
| `escape` | interrupt the running turn |
| `escape escape` | rewind picker |
| `shift+tab` | cycle mode: default → edits → plan (→ bypass → auto when enabled) |
| `ctrl+v` | paste an image |
| `ctrl+r` | search prompt history |

### Question card

| Key | Does |
|---|---|
| `1-4` | pick option n (toggle in multi-choice) |
| `space` | toggle the highlighted option |
| `o` | Other: type your own answer |
| `tab / shift+tab` | next / previous question |
| `enter` | submit all answers |
| `escape` | later (the session keeps waiting) |

### Permission prompt

| Key | Does |
|---|---|
| `y` | allow once |
| `a` | allow and remember |
| `e` | allow with changes |
| `n` | deny (optionally say why) |

### Map focused

| Key | Does |
|---|---|
| `h j k l / arrows` | move between nodes |
| `enter` | open the session in a pane |
| `space` | add to selection (for broadcast) |
| `e` | cycle through this node's links |
| `s` | ask for a one-line summary |

### Tree focused

| Key | Does |
|---|---|
| `enter / o` | open / jump to that point in the conversation |
| `O / X` | expand all / collapse all below |
| `p / P` | go to parent / root |
| `f` | filter by type |
| `/` | search rows |

**The attention key is `prefix a`.** It jumps to the oldest session waiting for you and focuses its question or permission prompt, opening a pane if the session has none. Pressing it again moves to the next waiting session. `prefix A` lists them all, oldest first. Clicking a desktop notification does the same as `prefix a` for that session.

## How bindings are shown

- **Notation:** tmux style. `C-` is Control, `M-` is Meta/Alt, `S-` is Shift. Chords run in sequence: `C-Space a`. Named keys are lowercase in hints (`enter`, `esc`, `tab`, `space`). Never use the ⌘ ⌥ ⇧ symbols: they are Mac-only, and this is a Linux-first tool.
- **Footers:** cards and menus end with `key label  key label`. The key is bold `focus`, the label `fg-muted`. In the TUI this footer sits in the bottom border (`border_subtitle`).
- **Menus:** a numbered list puts the digit before the label (`1 Redis`). A mnemonic letter sits right-aligned (`… y`).
- **Prefix indicator:** while the prefix is armed, the status bar's left segment becomes a `C-Space` chip in `fill-brand`, and the next key's hints appear in the bar.
- **Buttons:** on the web, every button carries its key in `btn__key` style (`Start enter`, `Stop &`).
- **Disabled actions:** they lose their key hint. They stay visible with the reason (`terminal-only`, `adopt to answer`) so you know why nothing happens.
- **Discoverability:** `prefix ?` is shown at the right of the status bar the first five times you start Constellation, then hidden.

## Conflicts handled

| Where | Conflict | Resolution |
|---|---|---|
| Inside tmux | `C-b` | Prefix is `C-Space` |
| Prompt box | readline `C-a C-e C-k C-u C-w` | Left alone; no binding uses them |
| Prompt box | Claude Code's `Esc` (interrupt), `Esc Esc` (rewind), `S-Tab` (mode), `C-v` (image) | Kept, pane scope |
| Browser | `C-k` (search), `C-g` (find next), `C-a` (select all) | Not used |
| Textual | `C-c` (copy), `C-q` (quit) | Quitting is `prefix d` (detach). `C-c` in a pane clears the prompt; pressing it twice does not exit |
