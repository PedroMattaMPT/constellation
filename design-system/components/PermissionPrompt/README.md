# PermissionPrompt

A permission prompt: the tool, exactly what it wants to run or change, and four answers: allow once, allow and remember, allow with changes, deny.

**Anatomy:**

- **Head:** the amber chip with the tool (`? Bash`), the verb ("wants to run a command"), the session.
- **Subject:** the full command (`$ psql …`) in bold, or the file path with a diff (`+` in `msg-answer`, `-` in `msg-denied`).
- **Context:** the working directory.
- **Risk lines:** `△` for warnings such as "writes to the database". `▲` in a fill chip for destructive commands: deletes outside the project, `sudo`, `curl | sh`, force pushes.
- **Options:** numbered with mnemonic letters on the right:
  - 1 Allow once `y`
  - 2 Allow and remember `a`, showing the exact rule it saves (`Bash(psql -d app_dev:*)`)
  - 3 Allow with changes `e`, which opens the command for editing
  - 4 Deny `n`, with an optional reason sent back to the session
- **Foot:** key hints.

| State | Web | TUI |
|---|---|---|
| default (waiting) | amber border | `round $status-waiting-fill` |
| focused (option) | `selection` + `▌` | same |
| selected (editing changes or reason) | inline input below the options | `Input` below the options |
| disabled (external session) | read-only, "adopt to answer" | same |
| needs attention (destructive) | `▲` chip under the subject | `chip-critical` |

**Data:** the same `can_use_tool` callback. "Allow with changes" returns the edited input; "remember" adds the rule to the session's settings for this project.

**Don't:** truncate the command. Wrap it: the whole point is to see it. Don't put Deny first.
