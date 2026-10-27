# Screens

The mockups below are not drawn by hand. They are the text output of `constellation_specimen.py`: a Textual app built only from the generated theme and `constellation.tcss`, rendered headless at 160 × 46 cells. The `Screens` asset group has the same screens in color, in the dark and light themes, at 256 colors, in 16 colors under Solarized Dark and Light, and in the ASCII tier.

## Main screen (TUI, 160 × 46)

```text
▾ ⌂ api-server 5                 │ MAP  15 sessions   ? 3 need you   ◌ 2 stale  × 1 error                                           links ── 1  ━━ 3+  ══ 10+
├ ▾ ◆ auth-refactor  ?           │ ▌api-server   ◆ auth-refactor   ? needs you  ± edits    @feat/auth-split 12s          asked: Which session store?     ◂━┓
│ ├ ▸ › 1 Split the auth midd…   │               ◆ migrations      ? needs you  · default  @feat/auth-split  1m          permission: Bash psql -f 0042_… ◂━┛
│ └ ▾ › 2 Go ahead, keep the…    │               ◆ rate-limits    ● working      » auto    @main             4s △ctx +1◦ Edit src/limits/route.ts         ─┐
│   ├ /compact 182k→41k          │               ◇ api-docs       ○ idle        · default  @docs/v2          8m          wrote docs/openapi.yaml         ◂─┘
│   ├ λ Edit session.ts          │               ◆ flaky-tests    × error       · default  @main             3m          × pytest exited 2
│   ├ → migrations tokens tbl?   │  web-app      ◆ checkout-ui    ● working     ± edits    @feat/checkout    2s      +2◦ Read src/checkout/Cart.tsx       ═╗
│   ├ ← migrations 0042 ok       │               ◆ design-tokens  ○ idle        ‖ plan     @feat/checkout    5m          plan ready for review           ◂═╝━┓
│   ├ ◦ explore callers          │               ◆ old-spike      ◌ stale 3h    · default  @spike/ssr        3h          replied: SSR works behind a fl…     ┃
│   ├ ↑ explore 14 found         │               ◇ storybook      ● working     · default  @main             9s          Bash npm run storybook:build    ◂━━━┛
│   └ ? Which session store?     │  ml-pipeline  ◆ train-eval     ● working      ! BYPASS  @exp/lr-sweep     1s △gpu     Bash python train.py --lr 3e-4   ─┐
├ ▸ ◆ migrations  ?              │               ◆ data-clean     ○ idle        ∅ no-ask   @main             6m          2 calls denied                  ◂─┘
├ ▸ ◆ rate-limits ●              │               ◇ notebook-port  ◌ stale 52m   ‖ plan     @main            52m          replied: plan in PLAN.md
├ ▸ ◇ api-docs ○                 │  dotfiles     ◆ nvim-config    ○ idle        · default  @main            14m          replied: done, 3 files
└ ▸ ◆ flaky-tests ×              │  life-admin   ◆ weekly-notes   ● working     ‖ plan     @main             6s          Read notes/2026-10-26.md        ◂━┓
▸ ⌂ web-app 4                    │               ◆ inbox-triage    ? needs you  · default  @main            40s          asked: Which PRs need you toda…  ━┛
▸ ⌂ ml-pipeline 3                │┏━  1 auth-refactor ◆ api-server  ? needs you   ━━━━━━━━━━━━━━┓┌─  3 rate-limits ◆ api-server ● working  ────────────────────┐
▸ ⌂ dotfiles 1                   │┃ › Go ahead, keep the public API the same.                   ┃│ › Limit /login to 5/min per IP.                             │
▸ ⌂ life-admin 2                 │┃ /compact  182k → 41k tokens                                 ┃│ λ Agent explore: where are limits set?                      │
                                 │┃ λ Edit src/auth/session.ts  +48 −12                         ┃│   ◦ explore  working · 6 tools                              │
                                 │┃ → migrations  We need a tokens table, see schema            ┃│ λ Read src/limits/index.ts                                  │
                                 │┃ ← migrations  0042_tokens.sql drafted                       ┃│ λ Edit src/limits/route.ts  +31                             │
                                 │┃ ¶ The token layer is in place. Before I move the            ┃│                                                             │
                                 │┃   sessions over, one decision:                              ┃│ ▘ Editing src/limits/route.ts  4s · esc interrupts          │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃ ╭─  ? Session store  1/2  ────────────────────────────────╮ ┃│                                                             │
                                 │┃ │ Which session store should the token layer use?         │ ┃│                                                             │
                                 │┃ │ ▌ (●) 1 Redis      already in docker-compose            │ ┃│                                                             │
                                 │┃ │   ( ) 2 Postgres   one less service to run              │ ┃│                                                             │
                                 │┃ │   ( ) 3 In-memory  tests only                           │ ┃│                                                             │
                                 │┃ │   ( ) o Other…                                          │ ┃│                                                             │
                                 │┃ ╰────────────── 1-3 pick  o other  tab next  esc later   ─╯ ┃│                                                             │
                                 │┃ ─────────────────────────────────────────────────────────── ┃│ ─────────────────────────────────────────────────────────── │
                                 │┃  › answer above, or type to reply…                          ┃│  › queue a message…                                         │
                                 │┗━  opus-5.5 │ ctx █████··· 64% │ ± edits │ $1.84  ━━━━━━━━━━━┛└─  opus-5.5 │ ctx ███████· 83% △ │  » auto  │ $2.10  ────────┘
 0 map  1 work 2 ml   1? auth-refactor   2? migrations  3●rat 4○api 5×fla 6●che 7○des 8◌old 9●sto 10●tra 11○dat 12◌not +3     ? 3  ◌ 2  △ 2  $9.86 today  20:14
```

Reading it top to bottom, left to right:

- **Tree (34 cells, left).** Projects, then sessions, then prompts (one per turn), then the events inside each turn. `auth-refactor` is expanded to turn 2. The cursor sits on the open question, `? Which session store?`, in bold amber. Every session row ends with its status glyph, and waiting ones carry the `?` chip, so the tree doubles as an attention list.
- **Map (top right).** One row per session, grouped by project. The columns are:
  - kind `◆ ◇`
  - name
  - status: words, plus the amber chip when a session needs you
  - mode: chips for auto and bypass
  - `@branch` and the time since last activity
  - alerts (`△ctx`, `△gpu`)
  - subagents (`+1◦`)
  - the latest step

  At the right edge are the message lanes. `auth-refactor ⇄ migrations` is a heavy pair in `focus` because `auth-refactor` is focused; `checkout-ui → design-tokens` is double (10+ messages). The header counts what needs you.
- **Panes (bottom right).**
  - Pane 1 is focused: heavy border, bold title, needs-you chip. Its question card is docked above the prompt box, and the status line in the bottom border shows model, context 64 % and `± edits`.
  - Pane 3 is unfocused: light border. It is working in auto mode, with the activity spinner on its last line, and its context bar has passed 80 % (`83% △`).
- **Status bar (bottom).**
  - Left: windows (`0 map`, `1 work`, `2 ml`).
  - Middle: every session as `index glyph name`. Waiting sessions are amber chips with their whole name; the others shrink to fit, then `+3`.
  - Right: `? 3` waiting, `◌ 2` stale, `△ 2` warnings, cost today, clock.

## Question card (TUI)

```text
╭─  ? Session store  1/2  ────────────────────────────────╮
│ Which session store should the token layer use?         │
│ ▌ (●) 1 Redis      already in docker-compose            │
│   ( ) 2 Postgres   one less service to run              │
│   ( ) 3 In-memory  tests only                           │
│   ( ) o Other…                                          │
╰────────────── 1-3 pick  o other  tab next  esc later   ─╯
```

- Round border in `status-waiting-fill`. The title is a fill chip carrying the question's header and the stepper (`1/2` when the session asked two questions).
- Options are numbered. `▌` and the `selection` ground mark the highlighted option; `(●)` / `( )` mark the chosen one. Multiple choice uses `[x]` / `[ ]`.
- `o` is always "Other": it opens a one-line input in place.
- Key hints live in the bottom border.
- `esc` leaves the question waiting: the chip stays on the map and in the status bar.

## Permission prompt and `/` menu (TUI, 132 × 26)

```text
┏━  2 migrations ◆ api-server  ? needs you   ━━━━━━━━━━━━━━━━━━━━┓┌─  14 weekly-notes ◆ life-admin ● working  ─────────────────────┐
┃ › Write the token-table migration, then apply it.              ┃│ › Draft the weekly update from this week's notes.              │
┃ λ Write migrations/0042_tokens.sql  +22                        ┃│ λ Read notes/2026-10-26.md                                     │
┃ ¶ Written. Applying it to the local database:                  ┃│ ← inbox-triage  3 PRs need review by Friday                    │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃                                                                ┃│                                                                │
┃ ╭─  ? Bash  wants to run a command  ─────────────────────────╮ ┃│                                                                │
┃ │ $ psql -d app_dev -f migrations/0042_tokens.sql            │ ┃│                                                                │
┃ │ in ~/code/api-server · writes to the database app_dev      │ ┃│   ╭─  / 5 of 41  ──────────────────────────────────────────╮   │
┃ │                                                            │ ┃│   │▌ /compact     built-in  Summarise to free context      │   │
┃ │ ▌ 1 Allow once                                             │ ┃│   │  /context     built-in  What fills the context window  │   │
┃ │   2 Allow and remember  Bash(psql -d app_dev:*)            │ ┃│   │  /config      built-in  Set a key: /config key=value   │   │
┃ │   3 Allow with changes…                                    │ ┃│   │  /code-review skill     Review the current diff        │   │
┃ │   4 Deny, and say why…                                     │ ┃│   │  /commit      command   ~/.claude/commands/commit.md   │   │
┃ ╰─────────── y allow  a always  e edit  n deny  esc later   ─╯ ┃│   ╰─────────────────── ↑↓ move  tab complete  enter run   ─╯   │
┃ ────────────────────────────────────────────────────────────── ┃│ ────────────────────────────────────────────────────────────── │
┃  › answer above, or type to reply…                             ┃│  › /co                                                         │
┗━  opus-5.5 │ ctx ██······ 22% │ · default │ $0.31  ━━━━━━━━━━━━┛└─  opus-5.5 │ @main │ ctx ███····· 33% │ ‖ plan │ $0.27  ───────┘
 0 map  1 work 2 ml   1? auth-refactor   2? migrations  3●rat 4○api 5×fla 6●che 7○des 8◌old +7    ? 3  ◌ 2  △ 2  $9.86 today  20:14
```

- **Left:** a permission prompt docked in the `migrations` pane. It shows the exact command and the working directory, then four numbered options with mnemonic letters. Option 2 shows the rule that "remember" will save.
- **Right:** the `/` menu opened from the prompt box (`/co`). It shows the command, its source (built-in, skill, command, mcp) and a description. The highlight is `▌` plus `selection`.

## ASCII tier

The same main screen with `CONSTELLATION_GLYPHS=ascii`. Every state still reads. In the map below, `?` is the waiting chip, `*` working, `o` idle, `~` stale, `x` error; modes show as `+ edits`, `> auto`, `! BYPASS`; lanes use `= - #` and `<`.

```text
- = api-server 5                 │ MAP  15 sessions   ? 3 need you   ~ 2 stale  x 1 error                                           links -- 1  == 3+  ## 10+
| - + auth-refactor  ?           │ >api-server   + auth-refactor   ? needs you  + edits    @feat/auth-split 12s          asked: Which session store?     <=+
| | + $ 1 Split the auth midd…   │               + migrations      ? needs you  . default  @feat/auth-split  1m          permission: Bash psql -f 0042_… <=+
| ` - $ 2 Go ahead, keep the…    │               + rate-limits    * working      > auto    @main             4s ^ctx +1+ Edit src/limits/route.ts         -+
|   | /compact 182k→41k          │               : api-docs       o idle        . default  @docs/v2          8m          wrote docs/openapi.yaml         <-+
|   | & Edit session.ts          │               + flaky-tests    x error       . default  @main             3m          x pytest exited 2
|   | > migrations tokens tbl?   │  web-app      + checkout-ui    * working     + edits    @feat/checkout    2s      +2+ Read src/checkout/Cart.tsx       #+
|   | < migrations 0042 ok       │               + design-tokens  o idle        = plan     @feat/checkout    5m          plan ready for review           <#+=+
|   | + explore callers          │               + old-spike      ~ stale 3h    . default  @spike/ssr        3h          replied: SSR works behind a fl…     |
|   | ^ explore 14 found         │               : storybook      * working     . default  @main             9s          Bash npm run storybook:build    <===+
|   ` ? Which session store?     │  ml-pipeline  + train-eval     * working      ! BYPASS  @exp/lr-sweep     1s ^gpu     Bash python train.py --lr 3e-4   -+
| + + migrations  ?              │               + data-clean     o idle        0 no-ask   @main             6m          2 calls denied                  <-+
| + + rate-limits *              │               : notebook-port  ~ stale 52m   = plan     @main            52m          replied: plan in PLAN.md
| + : api-docs o                 │  dotfiles     + nvim-config    o idle        . default  @main            14m          replied: done, 3 files
` + + flaky-tests x              │  life-admin   + weekly-notes   * working     = plan     @main             6s          Read notes/2026-10-26.md        <=+
+ = web-app 4                    │               + inbox-triage    ? needs you  . default  @main            40s          asked: Which PRs need you toda…  =+
+ = ml-pipeline 3                │┏━  1 auth-refactor + api-server  ? needs you   ━━━━━━━━━━━━━━┓┌─  3 rate-limits + api-server * working  ────────────────────┐
+ = dotfiles 1                   │┃ $ Go ahead, keep the public API the same.                   ┃│ $ Limit /login to 5/min per IP.                             │
+ = life-admin 2                 │┃ /compact  182k → 41k tokens                                 ┃│ & Agent explore: where are limits set?                      │
                                 │┃ & Edit src/auth/session.ts  +48 −12                         ┃│   + explore  working · 6 tools                              │
                                 │┃ > migrations  We need a tokens table, see schema            ┃│ & Read src/limits/index.ts                                  │
                                 │┃ < migrations  0042_tokens.sql drafted                       ┃│ & Edit src/limits/route.ts  +31                             │
                                 │┃ " The token layer is in place. Before I move the            ┃│                                                             │
                                 │┃   sessions over, one decision:                              ┃│ \ Editing src/limits/route.ts  4s · esc interrupts          │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃                                                             ┃│                                                             │
                                 │┃ ╭─  ? Session store  1/2  ────────────────────────────────╮ ┃│                                                             │
                                 │┃ │ Which session store should the token layer use?         │ ┃│                                                             │
                                 │┃ │ > (*) 1 Redis      already in docker-compose            │ ┃│                                                             │
                                 │┃ │   ( ) 2 Postgres   one less service to run              │ ┃│                                                             │
                                 │┃ │   ( ) 3 In-memory  tests only                           │ ┃│                                                             │
                                 │┃ │   ( ) o Other…                                          │ ┃│                                                             │
                                 │┃ ╰────────────── 1-3 pick  o other  tab next  esc later   ─╯ ┃│                                                             │
                                 │┃ ─────────────────────────────────────────────────────────── ┃│ ─────────────────────────────────────────────────────────── │
                                 │┃  $ answer above, or type to reply…                          ┃│  $ queue a message…                                         │
                                 │┗━  opus-5.5 | ctx #####--- 64% | + edits | $1.84  ━━━━━━━━━━━┛└─  opus-5.5 | ctx #######- 83% ^ |  > auto  | $2.10  ────────┘
 0 map  1 work 2 ml   1? auth-refactor   2? migrations  3*rat 4oapi 5xfla 6*che 7odes 8~old 9*sto 10*tra 11odat 12~not +3     ? 3  ~ 2  ^ 2  $9.86 today  20:14
```

## Web layout

The web app is the same screen, measured in the same cells. It has no top bar and no navigation rail.

1. **Status bar.** Docked bottom, 24 px, `panel`. Same three segments as the TUI. Session entries are clickable; hovering one shows a one-line tooltip (task and latest step). Waiting sessions are amber chips that never shrink. The rest truncate to six letters, then `+n`.
2. **Message tree.** Left, 280 px, resizable from 220 to 420 px, `panel`. A sticky filter bar sits on top: one chip per message type, each with a count, toggled by click or by `1`–`7`. Rows are 20 px with the same glyph guides as the TUI. Double-click or `enter` scrolls the pane to that message and flashes it once (`selection`, 120 ms).
3. **Map.** Top of the main area, React Flow on `surface`.
   - Projects are group nodes: `ProjectGroup`, a 1 px `line` frame with the project label and its waiting count.
   - Sessions are `SessionNode` cards, 40ch wide with four rows. Subagents hang below their parent as small dotted child nodes.
   - Edges are `MessageEdge`: teal, weighted by volume (1.25 / 2.5 / double), with an arrowhead at the receiver. A count chip appears on hover or selection. A message in flight runs a dash twice, then stops.
   - Waiting nodes get the amber edge and are pulled to the top of their group. Stale nodes get the rose edge.
   - Map controls: a minimap (bottom right, `panel`), "fit" (`f`) and a toggle between full and compact nodes. There is no zoom slider; the wheel and `+`/`-` zoom.
4. **Panes.** The area below the map is a CSS grid of `Pane`s. Splits follow the tmux bindings and the gutters can be dragged. The map/panes split is a draggable 4 px gutter. `prefix z` zooms a pane over the map and the other panes.
5. **Floating layer.** Menus, pickers, the launcher and dialogs open centered over the focused pane, never full screen, with `shadow-float`. The `/` menu, question cards and permission prompts dock inside the pane, as in the TUI.
6. **Notifications.** Desktop notifications use the Notification API on the web and `notify-send` from the TUI:
   - title: `? auth-refactor needs you`
   - body: the question, or `Bash: psql -d app_dev …`
   - resource alerts: title `▲ train-eval: GPU 21.4/20 GB`

   Clicking one focuses that session. Sessions that are already visible and focused don't notify.

At 960 px the tree becomes an overlay and the map switches to compact nodes. Below that, one pane shows at a time and the map becomes window 0, as in the TUI.
