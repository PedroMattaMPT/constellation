# Roadmap

The web app comes first. Each phase ends with a milestone you can try. **The terminal UI (Phase 6) is frozen** (2026-10-27): Phases 4 and 5 come first, and the web app is iterated on until you say to start the terminal UI.

| Phase | Goal | Milestone |
|---|---|---|
| 1 | Research: where every piece of session data comes from | Data sources documented, and a probe prints a live snapshot |
| 2 | Live map: a read-only web app | See every running session, its links and its conversation, and jump to any message |
| 3 | Managed sessions: Claude Code's features in the web app | **MVP**: drive sessions from the browser |
| 4 | Resources, alerts and notifications | See what each session costs the machine, and get told when one needs you |
| 5 | Workspace: tmux-style panes and working with many sessions | The full v1 in the web app |
| 6 | Terminal UI (Textual), **frozen** until you say | The same thing in the terminal |

Rules for every phase:

- **One parsing layer.** It skips anything it doesn't recognise. Formats are documented against the Claude Code version they were checked on (2.1.310 so far).
- **Fixtures are synthetic or personal.** Never commit transcripts or anything else from work sessions.
- **Localhost only.** The server listens on 127.0.0.1 and requires a per-run token.
- **The design system comes first.**
  - Every screen is built from its components and tokens.
  - It follows its rules: glyphs only through `glyph()`, its voice (terse, lowercase), its motion (only the spinner, the caret and a message in flight move; no transition over 120 ms), `fg-faint` never on text you read, disabled things never faded with opacity, and its keys.
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
- tests for the web app. Done (2026-10-27): Vitest (`npm --prefix web test`), 23 tests of the logic behind the map, tree, conversation, prompt box, answer cards and store.
- map layout from measured card sizes; it uses an estimate now. Done (2026-10-27): cards stack the heights React Flow measures once drawn. The column of peers that aren't sessions now starts past the widest row, not the last one.
- a single pane; panes are Phase 5

### Follow-ups

These are parts of the design system the read-only app didn't have yet, plus one correctness fix found after Phase 2. Done on 2026-10-27, and checked in the browser against live sessions.

- [x] **2.10 Rewound branches.**
  - A transcript is a tree: rewinding or editing a prompt starts a new branch from the same parent, and the old branch stays in the file.
  - Show only the live branch and mark the abandoned ones. Today both show, as if both were current.
  - Done ([`transcript.py`](server/src/constellation/claude/transcript.py)): a typed prompt with the same parent as an earlier one leaves everything from the earlier prompt on behind (`abandoned` on entries and turns). `last-prompt.leafUuid` turned out not to name the live branch (off the chain in 104 of 140 local transcripts), so it isn't used; the numbers are in [`docs/data-sources.md`](docs/data-sources.md).
  - The conversation folds each left-behind run into one rule, `rewound · 1 turn left behind`, that opens it (muted, kept for context). The tree keeps those turns in time order, muted, with `rewound` as their meta. A jump into one opens it.
- [x] **2.11 Map keys and controls.**
  - Keys: `h j k l` move between nodes, `enter` opens in the pane, `space` selects, `e` cycles a node's edges, `s` asks for a summary.
  - A toggle between full and compact nodes.
  - Live edges: dashes run twice when a message arrives.
  - Done ([`Map.tsx`](web/src/Map.tsx)): the map takes the keys when it has focus (a click on it, or `C-Space 0`), and its key hints show while it does. Also `,` rename and `&` stop on a managed node, `esc` drops the selected edge. The cursor follows whatever you open elsewhere. Selection shows `[x]` (cards) and a check and the selection ground (stars); it's kept for 5.3.
  - `s` asks a small model (Haiku, one print-mode call with nothing saved) for a one-line summary from the session's latest steps. It shows italic and labelled `summary` on the node, and in the card's summary row.
  - `c` toggles compact nodes in both views.
- [x] **2.12 Edges and status bar.**
  - Clicking an edge opens the messages between the two sessions in the tree, filtered to peer messages.
  - Hovering a status-bar session shows its task and latest step.
  - Done: the tree opens both sessions at those messages, underlines them, keeps the rest muted with only the peer chip on, and shows a bar (`→← a and b · 2 messages · esc back`). `e` then `enter` on the map does the same. The tooltip is a floating one-line card above the bar.
- [x] **2.13 Tree search and filter keys.** `f` filter and `/` search, with matches underlined.
  - Done ([`Tree.tsx`](web/src/Tree.tsx)): `f` puts the keys on the filter chips (`← →`, `space` or `enter`, `1`-`7`, `esc` back). `/` opens a search bar under them: matching rows are underlined, `enter` and `n` / `N` go through them, `esc` clears. It searches the rows in the tree, so collapsed turns aren't searched until opened; finding in every conversation is `C-Space f` (5.x).
- **Checked live since:** the dash on a live edge (a peer message arrived; the edge ran its dashes for about 1.7 s, then went solid).
- [x] **Design-system renders.**
  - The Hallmark pass on 2026-10-27 changed what the Textual specimen draws: the `map` label is lowercase and prompt placeholders are `fg-muted`.
  - `design-system/assets/Screens` still shows the old renders. Re-render them with `python3 constellation_specimen.py --shots DIR` under Textual 8.2, rasterized at 2× like the originals.
  - Done (2026-10-27): all eight re-rendered under Textual 8.2.8 and Rich 15.0.0 (`uv run --no-project --with "textual==8.2.*" python constellation_specimen.py --shots DIR`). Their text exports match the screens in `06-screens.md` line for line. Each SVG was rasterized at 1280 px wide and 2× (2560 px, the originals' size) by headless Chrome through an `<img>`, so the font is Chrome's monospace fallback.

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
- [x] **3.5 `/` menu and model picker** (`CommandMenu`, `ModelPicker`).
  - Done ([`Prompt.tsx`](web/src/Prompt.tsx), [`Pickers.tsx`](web/src/Pickers.tsx), [`options.py`](server/src/constellation/options.py)): `/` at the start of the prompt docks the `CommandMenu` above it, with Claude Code's 136 commands and their source, ranked by prefix, then by how often you ran each in this session, then by name. `↑ ↓` `tab` `enter` `esc`. Terminal-only commands stay listed, disabled. `/model`, `/context`, `/mcp`, `/resume`, `/rewind`, `/fork` and `/rename` open Constellation's own version; `/clear` asks first while questions wait.
  - `ModelPicker` opens from the model in the status line or `/model`: the 13 models the session reports, `(●)` on the one in use, the effort row underneath (`← →`, `tab`). It applies with `set_model()` and `/effort`; the status line then reads `haiku-5.5 low`.
  - The launcher's model chips are the live list now (the short names), once any session has reported it.
  - Checked live: a model and an effort changed from the picker, the menu filtered with `/co`.
- [x] **3.6 Modes.** `ModeBadge` with switching. Choosing bypass needs a second confirming key, as the design system says.
  - Done: `S-Tab` in the prompt box cycles default → edits → plan → auto. A click on the mode badge opens the mode menu (`1-5`, `enter`); no-ask stays listed, disabled ("set it at launch"), as the design system keeps it out of switching.
  - Choosing bypass shows `▲ bypass · every tool in <name> runs unchecked. ! again to confirm`; `!` switches. The launcher takes bypass too, behind typing the folder's name back. The API checks both (`confirm`).
  - Claude Code only lets a session switch to bypass if it started with `--allow-dangerously-skip-permissions`, so every managed session starts with it ([`docs/sdk-check.md`](docs/sdk-check.md)).
  - Plan approval gained "approve, and accept edits" (`a`), left over from 3.7.
  - Checked live: `S-Tab`, bypass from the menu with `!` (hazard stripe and `BYPASS` chip), back to default; the launcher's bypass rule on screen.
- [x] **3.7 Answering.**
  - `QuestionCard` and `PermissionPrompt`: allow, deny, allow with changes, allow and remember
  - all three arrive in `can_use_tool`: permission prompts, `AskUserQuestion` and plan approval (`ExitPlanMode`)
  - "allow and remember" applies only the `addRules` suggestion, never the `setMode` one
  - "allow with changes" tells the session what changed: on its own it reports what it asked for, not what ran
  - Done ([`Answer.tsx`](web/src/Answer.tsx)): the cards dock above the prompt box and take focus unless you're typing. `C-Space a` jumps to the session waiting longest. Questions: `1-4`, `space`, `o` Other, `tab`, `enter`. Permissions: `y` / `a` (shows the exact rule) / `e` / `n`, with risk lines for `sudo`, `rm -rf`, `curl | sh`, force pushes and writes outside the project. Plans: approve, or keep planning with a reason. The session learns about edits through a `PostToolUse` hook.
  - Checked live against a real session: a command edited, then allowed (the session noticed what ran), a single question answered with a key, a plan approved (the session moved to `default` mode, then asked before writing).
  - Not checked live yet: several questions in one card, multiple choice, the Other field.
  - "approve the plan and accept edits" came with 3.6.
  - pending questions show on the map and in the status bar
- [x] **3.8 Context.** The context bar with its breakdown, plus `/compact` and `/clear`.
  - Done: a click on the context bar, or `/context`, opens the breakdown from `get_context_usage()` (the design system's `ContextBar` with slices, the legend, and the tick where auto-compact fires), the memory files, and `/compact` (`c`) and `/clear` (`C`). A terminal session's bar opens its number only.
  - `/compact` reads as the design system's inline record, `/compact 55k → 12k tokens`, one row; auto compactions say `auto`. While it runs, the activity line says `compacting…`.
  - `/clear` asks first when questions are waiting; the conversation then draws a full-width rule labelled `cleared` where the new transcript starts.
  - Every session's context window size is learnt from `get_context_usage()`, so managed sessions on other models get a percentage too.
  - Checked live: the breakdown. `/compact` and `/clear` as prompts were checked in 3.1.
- [x] **3.9 Session history.**
  - a resume picker (`list_sessions()`, with a preview from `get_session_messages()`)
  - fork, rename, tag
  - rewind (with file checkpointing on)
  - Done: `C-Space r` or `/resume` opens the resume picker: every past session, newest first, with its turns and last prompts and replies, `running` on the ones open now. `enter` resumes into the pane (or goes to it, if it's running), `f` forks, `t` tags, `/` searches.
  - `/fork [name]` starts `<name>-fork` with the same model and effort. Rename was 3.4.
  - `esc esc` in the prompt box, or `/rewind`, opens the rewind picker: your prompts, newest first, and what going back restores (the files edited since, `△` on those outside the project, the turns dropped). `enter` rewinds code and conversation, `c` the conversation only, `f` the files only; it asks again if files outside the project change. The conversation rewind restarts the session cut back to before that prompt, with the same model, mode and effort, and puts the prompt back in the box to edit, as Claude Code does.
  - Checked live: rewinding code and conversation (the file went back, the old turn showed as `rewound` after the next prompt), fork, resume, tag, search.
- [x] **3.10 MCP status.** `get_mcp_status()`, plus reconnect and toggle.
  - Done: the status line's `mcp 4 · △ 1 down` segment, read after every turn; a click, or `/mcp`, opens the picker (`●` connected, `×` failed, `○` disabled, `?` needs auth, with tool counts and scope). `r` reconnects, `space` enables or disables. Claude Code remembers a toggle for the project, as `/mcp` does.
  - Checked live: a server disabled and enabled again. Not checked live: reconnecting a failed server.
- [x] **3.11 Sessions you didn't start.**
  - send them messages, using 1.13
  - adopt one: detect that its terminal copy has exited, then resume it by ID
  - Done ([`inbox.py`](server/src/constellation/inbox.py)): a terminal session's prompt box sends a peer message (the banner says so, and `/` says slash commands can't be sent). Constellation binds its own inbox, `constellation-<pid>.sock`, so replies arrive; they show as the session's sent messages and as edges to the `constellation` endpoint.
  - `A` (or `adopt` in the pane header) asks you to close the terminal copy, then waits for it to exit and resumes the session by id as managed. Focus follows it.
  - Checked live: a message delivered and answered with `SendMessage`; a terminal session adopted after `/exit` (same session id, its turns read, then driven from the browser).
- [x] **3.12 Questions from sessions still in a terminal.** The transcript doesn't record what these sessions are asking until it's answered (see `docs/data-sources.md`). Two hooks will report it instead: `PermissionRequest`, and `PreToolUse` limited to `AskUserQuestion`.
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
  - **Done** ([`hooks.py`](server/src/constellation/hooks.py)); the lab test's answers are in [`docs/data-sources.md`](docs/data-sources.md#pending-questions-and-permission-prompts):
    - The hooks get the full question and options. Running sessions pick them up without a restart. The report script takes 1 to 9 ms.
    - A hook can answer, but while it runs the terminal shows no dialog, so answering from Constellation isn't safe: you answer in the terminal.
    - The hooks are **not installed**. Installing (or removing) is the button in "see what it asks", on a waiting terminal session. It writes the script to `~/.claude/hooks/` and two entries to `~/.claude/settings.json`, keeping everything else.
    - The question shows on the session as the read-only `QuestionCard` (or `PermissionPrompt`), with "answer it in its terminal, or A adopt"; "go to terminal" switches your tmux to its pane.
    - Found on the way: Claude Code 2.1.311 often writes the open call to the transcript before it's answered, so without hooks Constellation shows an open question from there. One real waiting session had no open call written, so the hooks remain the reliable path.
  - Checked live in a lab terminal session (its own tmux server, hooks in its folder's settings only): a question and a permission prompt reported, shown, and cleared when answered in the terminal. Not checked live: "go to terminal" (it would switch your own tmux).

**Phase 3 done (2026-10-27).** Sessions start, take prompts, slash commands, model, effort and mode changes, answer questions and permission prompts, compact, clear, fork, rewind and resume from the browser. Sessions started elsewhere can be messaged and adopted. Server tests: 42.

Left for later, done on 2026-10-27 and checked live:
- **Folder completion in the launcher:** the folders that complete what you type show under it; `tab` completes, `↑ ↓` pick, and the error line says "not a folder" when nothing completes it.
- **`@` file mentions:** `@` in the prompt box lists the project's files and folders (git's own list, so ignored files stay out), best match first; `tab` or `enter` inserts it. Claude Code reads a mentioned file through the SDK as in its terminal.
- **`C-r` prompt history:** your prompts in this folder, newest first: Claude Code's history plus the prompts of the sessions running there, as those sent through Constellation never reach its history file.
- **Fork's inline record in both sessions:** `/fork → name` in the original at the moment of the fork, `/fork from name` in the fork after its copied history. Either opens the other.
- **A failed adoption** shows as a notice over the map, with why and `claude --resume <id>`, until you dismiss it.
- **Checked live:** pasting an image, `esc` from the browser (3.4); two questions in one card, multiple choice, Other (3.7); reconnecting a failed MCP server, which says why it failed again (3.10); go to terminal, in a lab tmux server with an attached client (3.12).
- **Tests for the web app:** see Phase 2.

Design-system gaps found by an audit of the web app against `design-system/`, done on 2026-10-27 and checked live:
- **The prefix's screens** ([`Keys.tsx`](web/src/Keys.tsx)). 600 ms after `C-Space` the which-key overlay lists what can follow, and the status bar shows the same keys while the prefix waits. `C-Space ?` lists every binding, `A` everything waiting (oldest first), `'` goes to a session by number or name.
- **`C-Space :` command prompt** over the status bar, for what has no key of its own: `model`, `effort`, `mode`, `context`, `compact`, `clear`, `mcp`, `fork`, `rename`, `rewind`, `stop`, `stop-task`, `adopt`, `new`, `resume`, `hooks`, `theme`, `keys`. `tab` completes; a refusal shows in the bar with why (`… is external: adopt it first`). Bypass still takes its second key in the mode menu.
- **Theme:** dark, the design system's primary theme, unless you choose `:theme light`, or `:theme auto` to follow your system. The choice is remembered.
- **Inline records:** a mode change is a record (`/mode ‖ plan`) in the conversation and the tree; an answered question reads `Color: Blue` (its header, then the answer); an interrupt is muted, `interrupted by you`.
- **Images:** a prompt's sent images show as `▣ image 1` chips that open the image over the panes. A pasted image shows its size and a thumbnail before it's sent.
- **Background tasks:** a managed session's running background tasks are listed above its prompt box, each with `■ stop` (`stop_task()`), or `:stop-task`.
- **Found on the way:**
  - A conversation opened on a fresh page could land a few rows short of its end, because Virtuoso keeps the top row still while it measures rows. It now keeps the end in view until you scroll or click.
  - Sessions driven through the SDK write no `permission-mode` lines; their prompt lines carry the mode instead ([`docs/sdk-check.md`](docs/sdk-check.md)).
- **Not done:** `prefix ?` at the right of the status bar for your first five starts. The design system's `StatusBar` has no place for it yet.
- Server tests: 50. Web tests: 34.

Still left: nothing. "Open in a new pane or window" came with 5.1, and summaries that cost nothing with 5.4.

**Done when** you can start, prompt, steer and answer sessions from the browser, without opening a terminal for anything but `/login`.

---

## Phase 4: Resources, alerts and notifications

- [x] **4.1 Sampler.** CPU and memory per session process tree with `psutil`, kept as a 30-minute rolling history.
  - Done ([`resources.py`](server/src/constellation/resources.py)): every 5 s, beside the collector's poll, one walk of each session's tree into 30 one-minute buckets (CPU averaged, memory at its peak).
  - CPU counts processes that came and went between samples: a process's time includes the children it waited for, so a build's short-lived compilers land on the shell that ran them.
  - Cost: 85 ms per pass for 11 sessions and about 150 processes.
- [x] **4.2 GPU.** Memory per session from `pynvml` or `nvidia-smi`. Done with `nvidia-smi` every 15 s (no new dependency); sessions show no GPU without it.
- [x] **4.3 Tokens and cost** per turn and per session. For sessions Constellation didn't start, live cost needs a price table, because `cost-state` isn't written continuously. Context needs a table of each model's window size (only Opus 5.5 and Haiku 5.5 are checked).
  - Done ([`usage.py`](server/src/constellation/usage.py)): a price table for every current model, from Anthropic's API reference; Opus 5.5 and Haiku 4.5 also match Claude Code's own `cost-state`, cache writes split by their 5-minute and 1-hour rates, and web searches included.
  - A terminal session's cost is its latest `cost-state` from this process plus its replies since, its subagents' included; `costEstimated` says when part of it is priced here.
  - Checked on 87 sessions: over the same span the transcript accounts for a median 93% of Claude Code's own figure, and never more. The rest is Claude Code's side calls (titles, compaction), which never reach a transcript.
  - Today's total in the status bar sums every transcript written to today, an estimate for the same reason. Transcripts are read a chunk at a time: one session here has a 2 GB transcript.
  - Context windows: 1M for every current model, 200K for Haiku 4.5.
- [x] **4.4 Meters.** `Sparkline` and `ContextBar` on nodes and panes.
  - Done: cards carry the design system's resource row (context, the CPU of the last 12 minutes, the most severe alert); stars carry the alert beside their context bar.
  - In a pane, the usage card (`/usage`, `:usage`, or a click on the cost in the status line) shows tokens per turn, the input / cache / output split, the cost, and CPU, memory and GPU over the last 30 minutes against your limits.
- [x] **4.5 Alerts.**
  - Thresholds from the design system:
    - context at 80% or more is a warning, and 95% or more is critical
    - CPU busy for more than 5 minutes
    - memory or GPU at 80% of its limit is a warning, and past the limit is critical
  - You set the limits.
  - Done: `Session.alerts`, most severe first. The status bar counts them (`△ n`). Limits default from the machine (memory: a quarter of it per session; GPU: the card's memory; CPU: 200%), and `:limit mem 12`, `gpu 14`, `cpu 300` or `reset` changes them, saved in `~/.config/constellation/settings.json`.
  - Checked live: a session that launched a game (8.8 GB) went critical against the 7.7 GB default limit, with runaway CPU at 340% after 7 minutes; raising the limit to 12 GB cleared the memory alert.
- [x] **4.6 Notifications.** Browser notifications when a session needs you or an alert fires. Clicking one opens the session.
  - Done ([`Notify.ts`](web/src/Notify.ts)): `:notify on` asks the browser, then a session that starts waiting notifies `? name needs you` with what it asks, and an alert that fires or gets worse notifies `▲ name: memory 8.8/7.7 GB`. A filling context bar only notifies at 95%, where the design system says it raises an alert.
  - Nothing is sent for the session you're looking at, and each session keeps one notification. A click opens the session, with its question card focused.
  - Checked live with the browser's notifications recorded: a managed session's question notified once, and its next question replaced it.
- **Design-system gaps found on the way:**
  - The `StatusBar` has no `▲` counter for critical alerts, which the `Sparkline` guide asks for; critical alerts count in `△ n` for now.
  - The `Pane` has no place for sparklines, so they live in the usage card the design system describes for `/usage`.
  - Nothing says how notifications get turned on; here it's `:notify on`, since a browser only asks after a key press or click.

**Phase 4 done (2026-10-27).** Server tests: 59. Web tests: 38.

## Phase 5: Workspace

- [x] **5.1 Panes.** tmux-style windows, splits and zoom, with the `C-Space` prefix and the bindings from `05-keyboard.md`.
  - Done ([`panes.ts`](web/src/panes.ts), [`Panes.tsx`](web/src/Panes.tsx)): each window is a tree of splits whose leaves are panes, one session each, kept in this browser.
  - Keys: `%` and `"` split (the go-to picker fills the new pane), `h j k l` and the arrows move, `o` next pane, `z` zoom over the map and the other panes, `x` close the pane (the very last one is put away instead, as before), `1`-`9` windows, `n p` next and previous, `g` hide the map, `:window` a new window. The gutters drag.
  - Opening a session shows it where it already is, in any window, or in the focused pane. A started, resumed or forked session gets a pane of its own beside the focused one (the launcher also offers a new window), or a window when no half would be big enough to read.
  - Only the focused pane takes keys: a question in another pane waits there. A pane whose session ended keeps its place for the one that replaces it (adopted, rewound).
  - The status bar lists the windows, named after the project of their focused pane.
  - `C-Space f` finds in every conversation: each message's line, as the tree shows it, newest first; `enter` opens it in its session. `C-Space [` is scroll mode: `j k`, `d u`, `f b`, `g G` move through the conversation while the prompt keeps its text; `/` opens find, `q` or `esc` ends it.
  - Checked live: three panes in two splits, moves, zoom without reloading the conversation, a second window and back, closing a window's last pane, find, and scroll mode.
- [x] **5.2 Session launcher.** Start, stop and rename from the UI. Done in Phase 3; the launcher now also says where to open: a new pane or a new window.
- [x] **5.3 Prompt to many.** Send one prompt to several selected sessions.
  - Done ([`Broadcast.tsx`](web/src/Broadcast.tsx)): `C-Space b` lists every session by project, with what each will do with the prompt (queued behind a question or a turn, peer message, plan only). `space` picks, `p` a whole project, `*` every idle one, `tab` goes between the list and the prompt, and `C-enter` sends, so a stray return can't reach five sessions. The picks made on the map with `space` come along.
  - Managed sessions get it as a prompt, terminal sessions as a peer message; one without an inbox can't be picked. While the dialog is open, the targets' prompt boxes carry the teal edge.
- [x] **5.4 "What it's doing now."** The latest step, plus a model-written summary on demand. Refine it here.
  - Done: `s` costs nothing when nothing happened since the last summary, or when Claude Code's own recap (`away_summary`) is newer than the session's latest step; then that recap is the summary. Only otherwise does it ask a small model.
  - On the map, a summary shows its age, and dims once the session has moved on since.
  - Checked live: two stale sessions summarized in 1 to 2 ms from their recaps, with no model call.
- [x] **5.5 Narrow screens.** The three layouts from `03-layout.md` (1280 px, 960 px and smaller).
  - Done: below 1280 px the tree is a strip that opens over the map (`C-Space t`) and the map shows compact nodes; below 960 px one pane shows at a time and the map is window `0` (`C-Space 0`, `C-Space g`; opening a session goes back to its pane).
  - Checked live at 1100 and 800 px.
- **Not done, and why:**
  - The status bar's `→ 3` while a broadcast is armed: the design system's `StatusBar` has no place for it. And the text typed into the broadcast isn't mirrored into each target's prompt box yet; the targets show the teal edge.
  - `C-Space d` (detach): a browser tab has nothing to detach from; closing it is detaching.
  - Scroll mode's `/` opens find in every conversation rather than searching only this one.
  - Find searches each message's line and detail, not its full text: full text would mean reading transcripts of up to 2 GB again.
- **Design-system gaps:** `BroadcastPrompt` only draws (its prompt and buttons are static), so the dialog is built from its classes; the `StatusBar` has no broadcast counter.

**Phase 5 done (2026-10-27).** Server tests: 61. Web tests: 50.

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
- **Keys the design system doesn't list:** `v` (stars or cards), and `c` for the toggle between full and compact nodes, which the design system describes without a key.

## Phase 6: Terminal UI

**Frozen** (2026-10-27): not started until you say. The web app still uses only what the terminal can draw (design-system principle 2), apart from [Web only](#web-only), so the terminal UI can follow it later.

- [ ] **6.1 Textual app** built on `constellation_theme.py` and `constellation.tcss`, attached to the same server and protocol.
- [ ] **6.2 Feature parity** with the web app, using the terminal versions of each component from the design system. Leave out everything under [Web only](#web-only).
