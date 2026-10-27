# Roadmap

The web app comes first. The terminal UI follows once the web MVP works. Each phase ends with a milestone you can try.

| Phase | Goal | Milestone |
|---|---|---|
| 1 | Research: where every piece of session data comes from | Data sources documented, and a probe prints a live snapshot |
| 2 | Live map: a read-only web app | See every running session, its links and its conversation, and jump to any message |
| 3 | Managed sessions: Claude Code's features in the web app | **MVP**: drive sessions from the browser |
| 4 | Resources, alerts and notifications | See what each session costs the machine, and get told when one needs you |
| 5 | Workspace: tmux-style panes and working with many sessions | The full v1 in the web app |
| 6 | Terminal UI (Textual) | The same thing in the terminal |

Rules for every phase:

- **One parsing layer.** It skips anything it doesn't recognise. Formats are documented against the Claude Code version they were checked on (2.1.310 so far).
- **Fixtures are synthetic or personal.** Never commit transcripts or anything else from work sessions.
- **Localhost only.** The server listens on 127.0.0.1 and requires a per-run token.
- **The design system comes first.**
  - Every screen is built from its components and tokens.
  - It follows its rules: glyphs only through `glyph()`, its voice (terse, lowercase), nothing moving longer than 120 ms, and its keys.
  - A UI task is done only after it's checked against the brand book (`design-system/README.md` and its sections) and the guidelines of each component it uses.
  - Where something can't follow the design system yet, it goes into this roadmap, never silently.
  - To change the design itself, edit `design-system/assets/Source/constellation.tokens.json` and rebuild. Never edit a generated file.
  - Exception: a few things you asked for go past the design system's rule that the web app only uses what the terminal can draw. They're listed under [Web only](#web-only), and the terminal UI leaves them out.

---

## Phase 1: Research

Find out how to get everything Constellation shows about sessions it didn't start. This means reading Claude Code's own files and the process table, without changing anything. Most of this was confirmed during planning, and the open questions are listed under each task.

### Finding sessions

- [x] **1.1 Running-session registry** (`~/.claude/sessions/<pid>.json`)
  - document every field
  - list the status values (`busy`, `idle` and `shell` seen so far) and when each appears
  - find out when a file appears and when it disappears
  - check liveness with `pid` plus `procStart`
  - learn how `name` and `nameSource` change on `/rename`
- [x] **1.2 `claude agents --json`**
  - what it adds over the registry, for normal and background sessions
  - confirm `status: waiting` and `waitingFor` by leaving a permission prompt open in a test session
  - time how long a call takes, to choose how often to poll it
- [x] **1.3 Background sessions** (`~/.claude/jobs/<id>/state.json`, `~/.claude/daemon/roster.json`): the fields `intent`, `detail` and `state`, the linked PRs and artifacts in `children`, and how a job maps to a registry entry.

### Reading a session

- [x] **1.4 Finding the transcript.**
  - Confirm how a working directory becomes a folder name under `~/.claude/projects/`. Both `/` and `.` seem to become `-`.
  - Check worktrees.
- [x] **1.5 Entry catalogue.** List every entry `type` and `subtype`:
  - `user`, `assistant`, `attachment`, `system`, `mode`, `permission-mode`, `ai-title`, `last-prompt`, `file-history-snapshot`, `api-request*`, and so on
  - say which matter and which to skip
  - map each to a message-tree node type: prompt, slash command, tool call, question, answer, denied, sent, received, subagent or reply
- [x] **1.6 Turns.**
  - group entries into turns (`parentUuid`, `promptId`)
  - handle sidechains
  - pair each `tool_use` with its `tool_result`
  - handle interrupted turns
- [x] **1.7 Session identity over time.** For each of `/clear`, `/compact`, `/resume`, `/fork`, `/rename` and `--continue`, does the session ID change, or does a new file start? Find out how to follow the chain.
- [x] **1.8 Live tailing.**
  - Are transcripts only ever appended to, or sometimes rewritten?
  - How to handle partly written lines.
  - Watch with byte offsets.
  - Measure the largest transcript and how long it takes to load.
  - Build an index from entry ID to byte offset, so the app can jump to any message without reading the whole file.
- [x] **1.9 State from the transcript.** Work out each of these from the transcript, and how reliable each one is:
  - the latest step and the current mode
  - the title and the last prompt
  - a pending `AskUserQuestion`, or a tool call still waiting for its result
  - token use

### Links between sessions

- [x] **1.10 Messages between sessions.**
  - Sender side: the `SendMessage` call (`to`, `summary`, `message`) and the `msg_id` in its result.
  - Receiver side: the `origin.kind: "peer"` entry (`from`, `name`, `msg_id`, `fromMode`, `hopChain`, `verifiedPeerPid`).
  - Matching: link sender to receiver through the socket path, the process ID and the registry, and match the two transcripts by `msg_id`.
  - Define the edge model.
- [x] **1.11 Subagents.**
  - their transcripts under `subagents/agent-*.jsonl`
  - how each links to the parent's `Agent` call
  - hand-back messages (`handback`)
  - background and nested subagents
- [x] **1.12 Other links.** Decide which of these become edges: idle-notice subscriptions, agent-team teammates, forks (`forkParentSessionId`), and sessions working in the same repo or worktree.
- [x] **1.13 Messaging a session you didn't start.**
  - the message format on a session's inbox socket and the auth line
  - how the receiver labels a sender that isn't a Claude session
  - test it against a throwaway session

### Processes and resources

- [x] **1.14 Process tree.** Use `psutil` to get from the `claude` process to its children: shells, MCP servers and dev servers. Measure CPU and memory, and how much the sampling itself costs.
- [x] **1.15 GPU.** Get memory per process from `nvidia-smi` or `pynvml`, and match it to a session's process tree.
- [x] **1.16 Context window for sessions you didn't start.** Estimate it from the last reply's `usage` and the model's context size. Check the estimate against the percentage in Claude Code's own status line.

### Deliverables

- [x] **1.17 Fixture sessions.**
  - Run throwaway sessions in a scratch folder that cover every case:
    - slash commands, a subagent
    - a question, a permission prompt
    - messages in both directions
    - `/compact`, `/clear`, `/fork`, `/rename`
    - an interrupt
  - Their transcripts become the test fixtures.
  - This costs some tokens.
- [x] **1.18 `docs/data-sources.md`.** A field reference for all of the above, stating the Claude Code version it was checked against.
- [x] **1.19 Probe script.** A read-only script that prints one JSON snapshot:
  - sessions, with status, mode, title, latest step and any pending question
  - message edges
  - subagents

  Check it against the sessions actually running.

**Done when** the probe's snapshot matches the live sessions, every item above is answered in `docs/data-sources.md`, and what's still unknown is listed there.

**Done (2026-10-26).** The findings are in [docs/data-sources.md](docs/data-sources.md), the probe is [research/probe.py](research/probe.py) and the fixtures are in [research/fixtures/](research/fixtures/). What's still open moved to later tasks: what a terminal session is asking goes to 3.12 (hooks), and live cost and context windows go to 4.3. Agent-team links weren't seen in any transcript; they get looked at when one shows up.

---

## Phase 2: Live map (read-only web app)

### Foundation

- [x] **2.1 Repo and tooling.**
  - `git init`
  - a Python server in `server/`, using `uv`, `ruff` and `pytest`
  - a web app in `web/`, using Vite, React and TypeScript
  - one command that runs both in development
- [x] **2.2 Server skeleton.**
  - FastAPI on 127.0.0.1 with a per-run token
  - a WebSocket for live state
  - HTTP endpoints for pages of a transcript
- [x] **2.3 Protocol.**
  - Pydantic models: `Session`, `Entry`, `Edge`, `Subagent`, `Snapshot`, `Delta`.
  - Export them as JSON Schema and generate the web app's TypeScript types from that.
- [x] **2.4 Collector.**
  - the Phase 1 parsers as one tolerant layer
  - file watching and an in-memory state
  - changes pushed to clients as deltas
  - tests against the fixtures

### Web app

- [x] **2.5 App shell.**
  - Wire in the design system: `constellation.css`, the fonts, the glyphs, and the components from `design-system/components/src`.
  - Dark and light themes.
  - The layout from `03-layout.md`: status bar, tree, map and pane area.
- [x] **2.6 Session map.**
  - React Flow with `SessionNode` and `MessageEdge`
  - grouped by project
  - sessions that need you and stale sessions surface first
  - live updates
- [x] **2.7 Conversation view.** Read-only and virtualized, with a glyph gutter and tool output collapsed.
- [x] **2.8 Message tree.**
  - project › session › turn › entries
  - filter by type
  - jump to any message through a link made of session plus entry ID, with the target highlighted
- [x] **2.9 Status bar.** Every session listed like tmux windows, plus a counter of sessions that need you.

**Done when** opening localhost shows every running session live, with its links and conversation, and any message is one click away.

**Done (2026-10-26).** Run it with `./dev` (see the README). Checked against the live sessions on this machine:
- **Map:** 9 sessions in their project groups, message edges with the peers that exited, subagents under their parent, and the minimap.
- **Tree:** expanding a session lists its turns, and expanding a turn lists its entries. Double-clicking jumps the pane to that message and flashes it.
- **Conversation:** older pages load as you scroll up, any entry opens to its full content, and new entries stream in live.
- **Themes:** light and dark both work.
- **Server tests:** 13 tests, built from the Phase 1 fixtures.

Left for later:
- tests for the web app
- map layout from measured card sizes; it uses an estimate now
- a single pane; panes are Phase 5

### Follow-ups

These are parts of the design system the read-only app doesn't have yet, plus one correctness fix found after Phase 2:

- [ ] **2.10 Rewound branches.**
  - A transcript is a tree: rewinding or editing a prompt starts a new branch from the same parent, and the old branch stays in the file.
  - Show only the live branch, followed back from `last-prompt.leafUuid`, and mark the abandoned ones.
  - Today both show, as if both were current.
- [ ] **2.11 Map keys and controls.**
  - Keys: `h j k l` move between nodes, `enter` opens in the pane, `space` selects, `e` cycles a node's edges, `s` asks for a summary.
  - A toggle between full and compact nodes.
  - Live edges: dashes run twice when a message arrives.
- [ ] **2.12 Edges and status bar.**
  - Clicking an edge opens the messages between the two sessions in the tree, filtered to peer messages.
  - Hovering a status-bar session shows its task and latest step.
- [ ] **2.13 Tree search and filter keys.** `f` filter and `/` search, with matches underlined.

---

## Phase 3: Managed sessions (MVP)

- [x] **3.1 SDK check.** Answer each of these yes or no, with notes in `docs/`. Done: everything works; answers and the traps in [`docs/sdk-check.md`](docs/sdk-check.md), lab script [`research/sdk_check.py`](research/sdk_check.py).
  - **Session setup:** start a `ClaudeSDKClient` session with `setting_sources=["user", "project", "local"]`, your normal login and no bare mode, and confirm it loads your CLAUDE.md, skills, plugins and MCP servers.
  - **Calls:** `get_context_usage()`, `get_server_info()` (does it include the model list?), `set_model()`, `set_permission_mode()` and `interrupt()`.
  - **Commands:** `/compact`, `/clear`, `/effort`, `/config key=value` and a skill, sent as prompts.
  - **Images:** pasting images.
  - **Questions and permissions:** `can_use_tool` receives both a question and a permission prompt, with the placeholder `PreToolUse` hook the Python docs require.
  - **Visibility:** does a managed session write a normal transcript, appear in `~/.claude/sessions/`, bind an inbox socket and show up in `/list-agents`?
- [x] **3.2 Session manager.** Done on the server ([`manager.py`](server/src/constellation/manager.py), API in [`docs/api.md`](docs/api.md)). It was checked against a real session: start, prompt, queue, rename, a permission prompt answered through the API, stop. The browser controls come with 3.4, and stopping asks first there (`ConfirmStop`).
  - start a session (folder, model, mode), running your installed `claude` (`cli_path`), not the SDK's bundled copy
  - leave `permission_mode` unset unless you pick one, so your default mode applies
  - drop `TMUX` and `TMUX_PANE` from the session's environment, or its registry entry claims the server's tmux pane
  - a queue for incoming prompts
  - SDK events fed into the state
  - stop (with confirmation) and rename
  - sessions survive clients disconnecting
  - one process per session
- [x] **3.3 One model for both kinds.** Done: the collector reads managed sessions from Claude Code's files like any other and keys both by process (`<pid>-<procStart>`). It marks the manager's own as `managed` and lets the SDK stream win for status, mode, cost and pending requests. A managed process that exits on its own is forgotten and leaves the map. Managed sessions also show up in Claude Code's files, so merge the two views by session ID. Checked in 3.1: they're in the registry (`entrypoint: "sdk-py"`), the transcripts and `claude agents`, with an inbox socket. After `/clear`, the new ID comes from the next result, not from the reset message.
- [x] **3.4 Pane.**
  - a prompt box (multi-line, images), with queued prompts shown and droppable
  - a status line: model · branch · context bar · mode · cost
  - interrupt
  - start, stop and rename from the browser: `SessionLauncher`, `ConfirmStop` and rename in the header. The milestone needs them; 5.2 builds on them.
  - Done, and checked in the browser against a real session: start from the launcher with a first prompt, type, queue behind a running turn, rename inline, stop with `C-Space &` then `&`. Keys: `C-Space c` new, `C-Space ,` rename, `C-Space &` stop, `enter` send or queue, `M-enter` newline, `esc` interrupt.
  - Not checked by hand yet: pasting an image (the server path is tested) and `esc` from the browser (the API call is tested).
  - Left for later, from the design system: folder completion in the launcher; "open in a new pane or window" (one pane until 5.1); the live model list (3.5); bypass at start (3.6); `esc esc` rewind (3.9); `@` file mentions.
- [ ] **3.5 `/` menu and model picker** (`CommandMenu`, `ModelPicker`).
- [ ] **3.6 Modes.** `ModeBadge` with switching. Choosing bypass needs a second confirming key, as the design system says.
- [x] **3.7 Answering.**
  - `QuestionCard` and `PermissionPrompt`: allow, deny, allow with changes, allow and remember
  - all three arrive in `can_use_tool`: permission prompts, `AskUserQuestion` and plan approval (`ExitPlanMode`)
  - "allow and remember" applies only the `addRules` suggestion, never the `setMode` one
  - "allow with changes" tells the session what changed: on its own it reports what it asked for, not what ran
  - Done ([`Answer.tsx`](web/src/Answer.tsx)): the cards dock above the prompt box and take focus unless you're typing. `C-Space a` jumps to the session waiting longest. Questions: `1-4`, `space`, `o` Other, `tab`, `enter`. Permissions: `y` / `a` (shows the exact rule) / `e` / `n`, with risk lines for `sudo`, `rm -rf`, `curl | sh`, force pushes and writes outside the project. Plans: approve, or keep planning with a reason. The session learns about edits through a `PostToolUse` hook.
  - Checked live against a real session: a command edited, then allowed (the session noticed what ran), a single question answered with a key, a plan approved (the session moved to `default` mode, then asked before writing).
  - Not checked live yet: several questions in one card, multiple choice, the Other field.
  - Left for 3.6: "approve the plan and accept edits", which Claude Code's terminal offers.
  - pending questions show on the map and in the status bar
- [ ] **3.8 Context.** The context bar with its breakdown, plus `/compact` and `/clear`.
- [ ] **3.9 Session history.**
  - a resume picker (`list_sessions()`, with a preview from `get_session_messages()`)
  - fork, rename, tag
  - rewind (with file checkpointing on)
- [ ] **3.10 MCP status.** `get_mcp_status()`, plus reconnect and toggle.
- [ ] **3.11 Sessions you didn't start.**
  - send them messages, using 1.13
  - adopt one: detect that its terminal copy has exited, then resume it by ID
- [ ] **3.12 Questions from sessions still in a terminal.** The transcript doesn't record what these sessions are asking until it's answered (see `docs/data-sources.md`). Two hooks will report it instead: `PermissionRequest`, and `PreToolUse` limited to `AskUserQuestion`.
  - **Test in a lab session first.**
    - Does the hook receive the full question and options?
    - Do sessions that are already running pick it up, or only new ones?
    - How long does the hook add?
    - Could the hook also answer? That means returning a decision, and checking what happens to the dialog open in the terminal at the same time.
  - **Install only after the test passes.**
    - The hook only reports to the Constellation server, then exits straight away.
    - If the server isn't running, it does nothing.
    - It runs in every session, work ones included, so it must be fast and harmless.
    - Installing and removing it is an explicit action in Constellation.
  - **Show it** on the session as the same `QuestionCard` / `PermissionPrompt`, marked as answered in the terminal.
  - **"Go to terminal":** switch your tmux to the session's pane, using the registry's `tmux` field.
  - **Answering from Constellation** only if the test shows the hook can do it safely. Otherwise you answer in the terminal.

**Done when** you can start, prompt, steer and answer sessions from the browser, without opening a terminal for anything but `/login`.

---

## Phase 4: Resources, alerts and notifications

- [ ] **4.1 Sampler.** CPU and memory per session process tree with `psutil`, kept as a 30-minute rolling history.
- [ ] **4.2 GPU.** Memory per session from `pynvml` or `nvidia-smi`.
- [ ] **4.3 Tokens and cost** per turn and per session. For sessions Constellation didn't start, live cost needs a price table, because `cost-state` isn't written continuously. Context needs a table of each model's window size (only Opus 5.5 and Haiku 5.5 are checked).
- [ ] **4.4 Meters.** `Sparkline` and `ContextBar` on nodes and panes.
- [ ] **4.5 Alerts.**
  - Thresholds from the design system:
    - context at 80% or more is a warning, and 95% or more is critical
    - CPU busy for more than 5 minutes
    - memory or GPU at 80% of its limit is a warning, and past the limit is critical
  - You set the limits.
- [ ] **4.6 Notifications.** Browser notifications when a session needs you or an alert fires. Clicking one opens the session.

## Phase 5: Workspace

- [ ] **5.1 Panes.** tmux-style windows, splits and zoom, with the `C-Space` prefix and the bindings from `05-keyboard.md`.
- [ ] **5.2 Session launcher.** Start, stop and rename from the UI.
- [ ] **5.3 Prompt to many.** Send one prompt to several selected sessions.
- [ ] **5.4 "What it's doing now."** The latest step, plus a model-written summary on demand. Refine it here.
- [ ] **5.5 Narrow screens.** The three layouts from `03-layout.md` (1280 px, 960 px and smaller).

## Web only

Added on 2026-10-26 at your request. They go past design-system principle 2 ("if it can't be drawn in Textual, it doesn't go in the web app"). **The terminal UI doesn't get these**: its map stays the design system's table, and it hides panels with keys.

- **Star map** (`web/src/Star.tsx`). It's the default view; `v` swaps to the design system's cards.
  - Each session is a four-point star, colored by status: sky working, amber needs you, vermillion error, rose stale, starlight idle. External sessions are paler with an outline (◇); yours are solid (◆).
  - A star grows with the context it has used. Subagents are small moons around it.
  - Rings: starlight for the focused session, amber for one that needs you, dashed vermillion for bypass.
  - The label sits beside the star on a faint plate: number, name, kind, status, mode, context bar and latest step. Hovering a star opens the full `SessionNode` card under it after 250 ms.
  - Each project is a constellation. Its stars zigzag down in session order and are joined by faint lines over a soft starlight glow. They keep their place when a status changes; the cards pull waiting sessions to the top instead.
  - The background is a still starfield that drifts a little slower than the map when you pan. Nothing twinkles: the motion rules still hold.
  - The minimap draws stars as dots. The minimap and the map's key hints float (round border, float shadow).
- **Hide buttons.** An `x` sits at the end of the tree header and the pane header.
  - The tree shrinks to a 3-cell strip with `▸` to bring it back.
  - The pane shrinks to its header at the bottom of the map. Clicking that header, a star or a status-bar entry opens it again.
  - The same works from the keyboard with `C-Space t` and `C-Space x`, as in the TUI. On the web, `C-Space x` toggles the pane; in the TUI it only closes it.
- **One key the design system doesn't list:** `v` (stars or cards).

## Phase 6: Terminal UI

- [ ] **6.1 Textual app** built on `constellation_theme.py` and `constellation.tcss`, attached to the same server and protocol.
- [ ] **6.2 Feature parity** with the web app, using the terminal versions of each component from the design system. Leave out everything under [Web only](#web-only).
