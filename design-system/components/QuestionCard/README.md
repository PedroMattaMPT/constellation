# QuestionCard

A question a session asked you (`AskUserQuestion`): 1 to 4 questions, each with 2 to 4 options, single or multiple choice, plus a free-text Other.

**Anatomy:**

- **Head:** the amber chip with the question's header (`? Session store`), a stepper when there are several questions (`✓ Session store · 2 Rollout`), and the session name.
- **Question:** bold `fg-strong`.
- **Options:** `▌` bar · `(●)`/`( )` or `[x]`/`[ ]` · number key in `focus` · label · description in `fg-muted`.
- **Other:** always present as `o`. It turns into an inline input when chosen.
- **Foot:** key hints and `Submit enter`.

The card docks in the session's pane above the prompt box, and the same card opens from the status bar or `prefix a`.

| State | Web | TUI |
|---|---|---|
| default (waiting) | amber border, title chip | `round $status-waiting-fill`, title on the fill |
| focused (option) | `selection` + `▌`, bold label | same |
| selected (picked) | `(●)` / `[x]` in `focus` | same |
| disabled (external session) | dashed `kind-external` border; footer reads "answer it in its terminal, or A adopt to answer here" | `dashed` border |
| answered | collapses to one record line: `✓ Session store: Redis · Rollout: dev, staging` | same |

**Data:** delivered through the SDK's `can_use_tool` callback, which waits as long as needed. The answer goes back as the tool result. For external sessions, a pending question is an `AskUserQuestion` call in the transcript with no result yet: it can be shown, not answered.

**Keys:** `1-4` pick or toggle · `space` toggle · `o` Other · `tab`/`S-tab` next or previous question · `enter` submit · `esc` later (the session keeps waiting).

**Don't:** auto-submit on a single keypress when there are several questions. Don't hide Other. Don't reorder options: the session may refer to them by number.
