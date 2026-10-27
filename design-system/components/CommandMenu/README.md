# CommandMenu

The `/` menu: built-in commands that work without a terminal, bundled skills, your skills, custom commands and MCP prompts. Typing filters it, `tab` completes, `enter` runs.

**Anatomy:**

- **Head:** `/` + the query + caret, then `n of total`.
- **Rows:** `▌` bar, `/name` (match underlined, arguments dim), source (`built-in`, `skill`, `command`, `mcp`, `plugin`), description.
- **Foot:** key hints.

It opens docked above the prompt box, 72ch wide or the pane width. Terminal-only commands (`/theme`, `/terminal-setup`, `/login`, `/color`) stay listed, disabled, with the reason.

| State | Web | TUI |
|---|---|---|
| default | `fg-muted` row, name `fg` | same |
| focused (highlight) | `selection` + `▌`, name bold `fg-strong`, description `fg` | `option-list--option-highlighted` |
| selected (query match) | matched letters underlined | underlined |
| disabled | `fg-faint`, italic reason, no key | dim |
| needs attention | — (the menu never waits on you) | — |

**Data:** `get_server_info()` returns the commands. Rank prefix matches first, then frequency in this session, then alphabetical. On an external session, slash commands can't be sent; the menu says so in its header and shows nothing else.

**Keys:** `↑ ↓` move · `tab` complete · `enter` run · `esc` close.
