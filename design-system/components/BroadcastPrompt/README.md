# BroadcastPrompt

Send one prompt to several sessions you pick (`prefix b`), like tmux `synchronize-panes`. It says what each session will do with the prompt before you send it.

**Anatomy:**

- **Title:** `→ send to several sessions`, then `n selected` in teal.
- **Targets,** grouped by project (`p` picks a whole project): `▌` · `[x]` · kind · name · status · note:
  - waiting: "answer its question first: the prompt queues"
  - working: "queued after this turn"
  - external: "arrives as a peer message"
  - plan mode: "will only plan"
- **Prompt box:** 2 px teal edge, teal `›`.
- **Foot:** keys, `Cancel`, `Send to n C-enter`.

`C-enter` is used to send, not `enter`, so a stray return can't reach five sessions.

| State | Web | TUI |
|---|---|---|
| default | `edge` border | `round $edge` |
| focused (row) | `selection` + `▌` | same |
| selected (picked) | `[x]` in bold `msg-sent` | same |
| disabled (Send with nothing picked) | 45 % opacity | dim |
| needs attention | waiting targets keep their amber chip | same |

While a broadcast is armed, each target pane's prompt box gets the teal edge and the status bar shows `→ 3`. Text typed in the dialog is mirrored into each of those boxes, like synchronize-panes.
