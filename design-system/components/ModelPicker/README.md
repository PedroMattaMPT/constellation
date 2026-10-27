# ModelPicker

The picker pattern, shown for `/model` with its effort row. `ResumePicker` is the same pattern with a preview pane, and rewind and `/mcp` use it too.

**ModelPicker anatomy:**

- **Head:** `model`, and "applies to the next turn".
- **Rows:** `▌` · `(●)`/`( )` for the current model · number · name · context size · note.
- **Effort row:** `low medium high max`; the current level gets the `selection` ground and a 2 px `focus` underline. `←` `→` move it.
- **Foot:** key hints.

**ResumePicker anatomy:**

- **Left:** past sessions (`■`, name, tag, age).
- **Right:** the highlighted session's project, turn count, short id and last turns. Prompts are bold starlight.
- **Keys:** `enter` resumes into a new pane, `f` forks, `t` tags, `/` searches.

| State | Web | TUI |
|---|---|---|
| default | muted rows | same |
| focused | `selection` + `▌` | highlighted option |
| selected (current value) | `(●)` in `focus` | `(●)` bold `focus` |
| disabled (a model the plan can't use) | `fg-faint` + reason | dim |
| needs attention | — | — |

**Data:** models come from `get_server_info()` (to be verified in the first prototype) and are applied with `set_model()`. Effort is sent as `/effort <level>`. Past sessions come from `list_sessions()`, their previews from `get_session_messages()`.

**Keys:** `1-4` pick · `←→` effort · `enter` apply · `esc` close.
