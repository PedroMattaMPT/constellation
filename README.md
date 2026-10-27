# Constellation

A control room for all your Claude Code sessions. See every running session on one map, find any message, and drive any session from one place: prompts, slash commands, modes, and answers to its questions.

## Why

You work with many Claude Code sessions at once, across different projects. After a while you lose track of them:

- which session is working on what
- which ones are stuck waiting for you
- which ones are forgotten and sitting idle
- which ones are messaging each other
- which ones are using up CPU, memory, GPU or tokens

Constellation brings all of them together so you can take back control.

## How it works

Constellation is its own app, built the way tmux is built: a **server** that holds the sessions, and **clients** that attach to it.

```
            ┌─────────────── constellation server ───────────────┐
  TUI  ◄──► │  managed sessions (Agent SDK): full control         │ ◄── ~/.claude files
  web  ◄──► │  external sessions (started elsewhere): watch/adopt │ ◄── /proc, nvidia-smi
            │  graph · message tree · modes · resources           │
            └─────────────────────────────────────────────────────┘
```

- **The server** (Python) runs sessions through Claude Code's Agent SDK for Python, watches sessions you started elsewhere, and tracks resources.
- **Two clients**: a terminal UI (Textual) and a web UI (React). Both attach to the same server and show the same thing. Closing one doesn't stop any session, and you reattach later, like `tmux attach`.
- **No terminal emulator.** Managed sessions run headless and Constellation draws them itself, so nothing ever types into a terminal.

### Two kinds of sessions

- **Managed**: started from Constellation. Full control: prompts, slash commands, model, mode, questions, permission prompts, interrupt, rewind.
- **External**: started by you in a terminal with `claude`. Constellation watches them live through Claude Code's files and can send them messages. Those messages arrive as from another session, not from you, so they can't run slash commands or answer prompts. To control one fully, **adopt** it: Constellation reopens the session by its ID as a managed session, after you close the terminal copy.

## Design system

Both clients follow one design system: [`design-system/`](design-system/README.md). There is also an [online version](https://claude.ai/artifact/18qFzpTDZ8iUVLFnXZcW8B) with live component previews.

The web app adds a few things a terminal can't draw: the star map and the buttons that hide the tree and the pane. They're listed in [ROADMAP.md](ROADMAP.md#web-only), and the terminal UI leaves them out.

- [Brand book](design-system/README.md): principles, content rules, and sections on [color](design-system/01-color.md), [typography](design-system/02-typography.md), [layout](design-system/03-layout.md), [glyphs](design-system/04-glyphs.md), [keyboard](design-system/05-keyboard.md), [screens](design-system/06-screens.md), [Claude Code features](design-system/07-features.md) and the [terminal implementation](design-system/08-terminal.md)
- [Token source](design-system/assets/Source/constellation.tokens.json): the single source of truth for every color, glyph and key binding. [`build_tokens.py`](design-system/assets/Source/build_tokens.py) generates the rest from it, so never edit a generated file.
- Terminal UI: [`constellation_theme.py`](design-system/assets/Source/constellation_theme.py) (Textual themes) and [`constellation.tcss`](design-system/assets/Source/constellation.tcss)
- Web UI: [`constellation.css`](design-system/assets/Source/constellation.css), the [React components](design-system/components/) and the [fonts](design-system/fonts/)
- [Screenshots](design-system/assets/Screens/) of the main screen in every theme and color depth

## Features

### 1. Session map

A graph of every **running** session, updated live.

- **Nodes**: each session shows its name, project folder, git branch, mode and status (working, idle, or waiting for you), plus how long since it last did anything. It also shows the task it was given and what it's doing right now: the latest step, such as "Editing `src/app.ts`", plus a one-line summary written by a model when you ask for one. Subagents appear as small child nodes.
- **Links**: arrows show messages one session sent another, and thicker lines mean more messages. Subagents reporting back to their parent show up as links too. Click a link to read its messages.
- **Attention**: sessions waiting for you stand out, and so do forgotten ones.
- Sessions are grouped by project.

### 2. Message tree

A collapsible sidebar like NERDTree for jumping straight to anything that happened in any session:

```
project
└── session
    └── prompt (one per turn)
        ├── slash command (/compact, /model, /loop, ...)
        ├── tool call (Bash, Edit, Agent, ...)
        ├── question asked / answered
        ├── message sent to another session
        ├── message received from another session
        ├── subagent started / reported back
        └── reply
```

Select a node to open that point in the session's conversation. Filter by type, for example only slash commands or only messages between sessions.

### 3. Panes (tmux-style)

The layout borrows from tmux, in both the terminal UI and the web UI:

- windows and split panes, each holding one session
- each pane shows that session's conversation, a prompt box and a status line: model · branch · context bar · mode
- a status bar listing every session, the way tmux lists windows
- a prefix key with tmux-like bindings to switch, split, zoom, and jump to the session that needs you

### 4. Claude Code features

Managed sessions keep Claude Code's features. Constellation draws its own version of each, using what the Agent SDK provides:

| Feature | How (Python SDK) |
|---|---|
| `/` menu with autocomplete | `get_server_info()` lists the commands: built-ins that work without a terminal, bundled skills, your skills, custom commands, plugins and MCP prompts |
| Model picker | `set_model()`, with the model list and effort levels from `get_server_info()` |
| Effort | `/effort <level>` sent as a prompt |
| `/compact`, `/clear` | sent as prompts; compacting reports how many tokens there were before |
| Context percentage, `/context` | `get_context_usage()`: percentage, tokens used and maximum, breakdown by category, auto-compact threshold |
| `/resume` | `list_sessions()`, `get_session_messages()` for a preview, then `resume` |
| `/fork`, `/rename` | `fork_session()`, `rename_session()`, `tag_session()` |
| `/rewind` | `rewind_files()`, with file checkpointing switched on |
| `/mcp` | `get_mcp_status()`, `reconnect_mcp_server()`, `toggle_mcp_server()` |
| Esc to interrupt | `interrupt()`; `stop_task()` stops a background task |
| `/usage`, cost | the `usage` command and token counts on every message |
| `/config` | `/config key=value` sent as a prompt |
| Pasting images | supported in streaming input |

Not available:

- commands that only exist for Claude Code's terminal screen, such as `/theme`, `/terminal-setup` and `/login`. You log in once in the normal `claude`.
- features only the TypeScript SDK has:
  - Ctrl+B, which moves a running command or subagent into the background
  - listing the session's subagents (`/agents`)
  - reloading plugins and skills without restarting the session
  - previews on question options

### 5. Modes

Every session shows its mode: default, accept edits, plan, auto, bypass permissions, or don't ask. For managed sessions, switch with `set_permission_mode()`. The change applies to the next tool call.

### 6. Answering agent questions

When a session stops to ask you something, the question appears in Constellation and you answer it there. For managed sessions both arrive through the SDK's `can_use_tool` callback, which waits as long as needed:

- **Questions with choices** (`AskUserQuestion`): the question and its options, single or multiple choice, with a free-text "Other"
- **Permission prompts**: the tool and exactly what it wants to run or change. Allow, deny, allow with changes, or allow and remember.

Sessions with an open question go to the top of the attention list and get flagged in the status bar.

### 7. Resource tracking

For each session, live and since it started:

- **Machine**: CPU and memory for the Claude process and everything it started (shells, dev servers, MCP servers, training scripts), plus GPU memory when an NVIDIA card is in use
- **Model**: tokens for each turn and in total (input, output, cache), cost, and how full the context window is

The last 30 minutes are kept as rolling history for each session and shown as small charts. Alerts fire when:

- the context window passes 80%
- a session or something it started keeps the CPU busy for a long time
- memory or GPU memory passes a limit you set

### 8. Managing sessions

- **Start** a session from the UI: choose the folder, model and mode, and it opens in a new pane.
- **Stop** a session. Constellation asks you to confirm first.
- **Rename** a session.
- **Send one prompt to several sessions** at once, like tmux `synchronize-panes`. You pick the sessions explicitly, for example every session in one repo.

### 9. Notifications

A desktop notification fires when a session asks a question or shows a permission prompt, or when a resource alert fires. Clicking it opens that session.

## Scope (v1)

- **Live sessions only.** When a session exits, it leaves the map. Past sessions are reachable only through `/resume`.
- **This machine only.** No cloud sessions and no Remote Control sessions on other machines.
- **Local and private.** The server listens on localhost only, and nothing leaves the machine apart from Claude Code's own traffic.

## Not in v1

- History and replay of past sessions
- Sessions on other machines or in the cloud
- Other agents such as Codex

## Where the data comes from

| Need | Source |
|---|---|
| Everything about managed sessions | the Agent SDK message stream and its methods (see Features) |
| Which external sessions are running, their status | `~/.claude/sessions/<pid>.json` (one per running session), `claude agents --json` |
| External sessions' prompts, replies, tool calls, slash commands | the transcript: `~/.claude/projects/<folder>/<sessionId>.jsonl`, written live |
| External sessions' mode | `permission-mode` entry in the transcript (written each turn) |
| External sessions waiting for you | registry `status: waiting`, plus `waitingFor` (`permission prompt` or `input needed`) from `claude agents --json`. What they're asking: often the open call in the transcript, and always the two optional hooks |
| Messaging external sessions | one JSON line on the session's inbox socket; Constellation binds its own socket to receive replies |
| Subagents | the SDK stream (`parent_tool_use_id`); for external sessions, `<sessionId>/subagents/agent-*.jsonl` |
| Messages between sessions | `SendMessage` calls (sender) and `origin.kind: "peer"` entries (receiver), matched by `msg_id` |
| CPU, memory, child processes | `psutil`, for each session's process and its children |
| GPU | `nvidia-smi`, matched to the session's processes |

The Agent SDK, `claude agents --json` and hooks are documented interfaces. The transcript and registry files aren't, and their format can change between Claude Code releases. All file parsing sits in one layer that skips anything it doesn't recognise. The full field-by-field reference, with what was verified and what's still open, is [docs/data-sources.md](docs/data-sources.md).

## Things to get right

- **Load your setup.** Managed sessions must load your settings, CLAUDE.md, skills, plugins and MCP servers (`setting_sources=["user", "project", "local"]`) and use your normal login. Never use bare mode, which skips all of that and needs an API key. The docs say bare will become the default for headless runs in a future release, so set this explicitly.
- **One process per session.** Adopting an external session reopens it in Constellation, so the terminal copy must be closed first.
- **Localhost only.** Anyone who can reach the server can run commands through your sessions.
- **Bypass stays behind a second key.** Claude Code only lets a session switch to bypass if it started with `--allow-dangerously-skip-permissions`, so every managed session does. Constellation asks for the key that names the session before it switches, and the API checks it too.
- **The hooks are yours to install.** Seeing what a terminal session asks, reliably, needs two hooks in your user settings, which then run in every session. Constellation installs or removes them only when you say so, and they only report: they never answer or block.
- **Not a child of the session that started it.** If you start the server from inside Claude Code (`! ./dev`), it drops that session's variables first, or its sessions would write no transcript and claim the parent's inbox.

## Decided

- **App**: its own app, a server with a terminal UI and a web UI as clients. Not a terminal emulator.
- **Stack**: a Python server on the Agent SDK for Python (with `psutil` for resource tracking), a Textual terminal UI, and a React web UI with React Flow for the graph. The server and the terminal UI share Python code. The messages between server and clients are defined once in Python, and the web UI's TypeScript types are generated from them.
- **Sessions**: managed sessions run through the Agent SDK. External sessions can be watched, messaged and adopted.
- **Scope**: live sessions on this machine only.
- **Work sessions**: shown fully, like any other session.
- **"What it's doing now"**: the latest step, plus a model-written summary on demand. The exact form gets refined during the build.
- **v1 features**: session map, message tree, tmux-style panes, Claude Code's commands and pickers, modes, answering questions and permission prompts, resource tracking with alerts, starting, stopping and renaming sessions, sending one prompt to several sessions, and desktop notifications.
- **Audience**: a personal tool for now, built for Linux, with the Linux-specific parts (`/proc`, `nvidia-smi`) kept separate so it can be opened up later.

## Running it

Needs Linux, Claude Code, Python 3.12+ with [uv](https://docs.astral.sh/uv/), and Node 24+. The web app covers roadmap Phases 2 to 5:

- It shows every running session live: the map, the message tree, and each conversation.
- It starts and drives sessions of its own: prompts and images, the `/` menu, model, effort and mode, questions and permission prompts, context, MCP servers, fork, rewind and resume.
- It messages and adopts sessions you started in a terminal, and shows what they ask, read-only.
- It shows what each session costs, in tokens and dollars and in CPU, memory and GPU, raises alerts past your limits, and can send desktop notifications when a session needs you (`:notify on`).
- It works like tmux: `C-Space` then a key. Panes split, zoom and live in windows; `C-Space b` sends one prompt to several sessions, `C-Space f` finds in every conversation, and `C-Space ?` lists every key.

- **Development:** `./dev` starts the server on 127.0.0.1:7337 and the web app with live reload on 127.0.0.1:7338. Open the link the server prints: the token in it is new on every start.
- **Without the dev server:** build the web app once with `npm --prefix web run build`, then run `uv run --project server constellation serve` and open the link it prints.
- **One snapshot as JSON:** `uv run --project server constellation snapshot`.
- **Checks:**
  - server tests: `cd server && uv run pytest`
  - web types: `npm --prefix web run typecheck`
  - web tests: `npm --prefix web test`
- **After changing `server/src/constellation/protocol.py`:** run `npm --prefix web run gen:protocol` to regenerate the web app's types.

| Folder | What |
|---|---|
| `server/` | Python: collector, session manager, HTTP and WebSocket API (`constellation` command; see [`docs/api.md`](docs/api.md)) |
| `web/` | React web app; uses `design-system/` as it is |
| `design-system/` | The design system: tokens, components, brand book |
| `docs/` | Reference: where every piece of session data comes from |
| `research/` | The Phase 1 probe and the test fixtures |

## Roadmap

The plan and the task list live in [ROADMAP.md](ROADMAP.md). The web app comes first: research, a read-only live map, then managed sessions (the MVP), resources and alerts, the tmux-style workspace, and finally the terminal UI.

## License

MIT. See [`LICENSE`](LICENSE).
