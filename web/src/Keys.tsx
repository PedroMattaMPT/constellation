// The prefix's own screens (design system: keyboard): the which-key overlay that appears 600 ms after C-Space, every
// binding (C-Space ?), everything waiting (C-Space A), go to a session (C-Space '), and the command prompt
// (C-Space :), tmux's `:` for what has no key of its own.
import { KeyHints, KindMark, MsgGlyph, StatusBadge, WhichKey, glyph } from '@ds';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, reason } from './api';
import { ago, msgType, task } from './format';
import { notifying, setNotifying } from './Notify';
import { underline } from './PromptMenus';
import type { Effort, Limits, Mode, SearchHit, Session } from './protocol';
import { step } from './Star';
import { numbered, store, useStore, waitingOldestFirst } from './store';

const close = () => store.set({ dialog: null });

type Group = { title: string; keys: Array<[string, string]> };

/** What C-Space unlocks here, the attention key first (design system: Kbd). */
export const PREFIX_GROUPS: Group[] = [
  { title: 'attention', keys: [['a', 'next waiting'], ['A', 'all waiting'], ['f', 'find everywhere']] },
  {
    title: 'sessions',
    keys: [['c', 'new'], [',', 'rename'], ['&', 'stop'], ['r', 'resume'], ["'", 'go to'], ['b', 'send to several'], [':', 'command']],
  },
  {
    title: 'panes & windows',
    keys: [
      ['%', 'split right'], ['"', 'split below'], ['hjkl', 'move'], ['o', 'next pane'], ['z', 'zoom'], ['x', 'close pane'],
      ['1-9', 'window'], ['n p', 'next, previous'], ['[', 'scroll'], ['0', 'the map'], ['g', 'hide the map'], ['t', 'tree'],
      ['?', 'every key'],
    ],
  },
];

/** Every binding: the prefix's, then the keys of each place (C-Space ?). */
export const ALL_GROUPS: Group[] = [
  ...PREFIX_GROUPS,
  {
    title: 'in a pane',
    keys: [['enter', 'send'], ['M-enter', 'newline'], ['/', 'commands'], ['@', 'a file'], ['esc', 'interrupt'], ['esc esc', 'rewind'], ['S-tab', 'mode'], ['C-r', 'history']],
  },
  {
    title: 'map',
    keys: [['hjkl', 'move'], ['enter', 'open'], ['space', 'select'], ['e', 'links'], ['s', 'summary'], ['c', 'compact'], ['f', 'fit'], ['v', 'stars or cards']],
  },
  {
    title: 'tree',
    keys: [['j k', 'move'], ['enter', 'open'], ['O X', 'all below'], ['p P', 'parent, root'], ['f', 'filter'], ['/', 'search']],
  },
];

/** The overlay that appears when the prefix waits for its key (600 ms). The prefix handler has the keys. */
export function WhichKeyOverlay() {
  return (
    <div className="keys-overlay">
      <WhichKey groups={PREFIX_GROUPS} />
    </div>
  );
}

/** C-Space ?: every binding, until esc. */
export function KeysDialog() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  return (
    <div
      className="keys-overlay keys-overlay--all"
      tabIndex={-1}
      ref={box}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' && event.key !== '?' && event.key !== 'q') return;
        event.preventDefault();
        close();
      }}
    >
      <WhichKey groups={ALL_GROUPS} />
    </div>
  );
}

// ── Sessions by number or name, and what waits for you ──────────────────

/** C-Space ': a number is the session with that number; anything else matches names and projects. */
export function matchSessions(items: Array<{ n: number; session: Session }>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  if (/^\d+$/.test(q)) {
    const exact = items.filter(({ n }) => String(n) === q);
    return exact.length ? exact : items.filter(({ n }) => String(n).startsWith(q));
  }
  const starts = items.filter(({ session }) => session.name.toLowerCase().startsWith(q));
  const rest = items.filter(
    ({ session }) => !starts.some((x) => x.session.id === session.id) && `${session.name} ${session.project}`.toLowerCase().includes(q),
  );
  return [...starts, ...rest];
}

function SessionRow({ n, session, on, detail, onPick }: { n: number; session: Session; on: boolean; detail: string; onPick: () => void }) {
  const now = useStore((s) => s.now);
  return (
    <div
      role="option"
      aria-selected={on}
      className={`cn-menu__item picker__row${on ? ' cn-menu__item--on' : ''}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
    >
      <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
      <span className="picker__n">{n}</span>
      <span className="cn-menu__name" title={session.name}>{session.name}</span>
      <KindMark kind={session.kind} />
      <StatusBadge status={session.status} compact />
      <span className="cn-menu__desc" title={detail}>{detail}</span>
      <span className="cn-dim">{ago(session.pending[0]?.at ?? session.lastActivityAt, now)}</span>
    </div>
  );
}

/** C-Space ': type a number or a name, enter goes there. */
export function GoToDialog() {
  const sessions = useStore((s) => s.sessions);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  const found = useMemo(() => matchSessions(numbered(sessions), query), [sessions, query]);
  useEffect(() => setHighlighted(0), [query]);

  const go = (id: string | undefined) => {
    if (!id) return;
    close();
    store.focus(id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') setHighlighted((h) => Math.min(found.length - 1, h + 1));
    else if (event.key === 'ArrowUp') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'Enter') go(found[highlighted]?.session.id);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  return (
    <div className="picker">
      <div className="cn-menu cn-picker" role="dialog" aria-label="go to a session">
        <div className="cn-menu__head">
          <b>go to</b>
          <input
            ref={field}
            className="menu-search"
            value={query}
            placeholder="number or name"
            spellCheck={false}
            aria-label="number or name"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="cn-dim">{`${found.length} of ${Object.keys(sessions).length}`}</span>
        </div>
        <div role="listbox" aria-label="sessions">
          {found.slice(0, 14).map(({ n, session }, i) => (
            <SessionRow key={session.id} n={n} session={session} on={i === highlighted} detail={step(session) || task(session)} onPick={() => go(session.id)} />
          ))}
          {!found.length ? <div className="cn-menu__item cn-dim picker__row">no session matches</div> : null}
        </div>
        <div className="cn-menu__foot">
          <KeyHints keys={[['↑↓', 'move'], ['enter', 'go'], ['esc', 'close']]} />
        </div>
      </div>
    </div>
  );
}

/** C-Space f (design system): find in every conversation; enter opens the message in its session. */
export function FindDialog() {
  const sessions = useStore((s) => s.sessions);
  const now = useStore((s) => s.now);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  useEffect(() => {
    if (!query.trim()) {
      setHits(null);
      return;
    }
    const timer = window.setTimeout(
      () =>
        api.search(query).then(
          (found) => {
            setHits(found);
            setHighlighted(0);
          },
          () => setHits([]),
        ),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [query]);
  const n = useMemo(() => new Map(numbered(sessions).map((x) => [x.session.id, x.n])), [sessions]);

  const open = (hit: SearchHit | undefined) => {
    if (!hit) return;
    close();
    store.jumpTo(hit.session, hit.entry.id);
  };
  const list = hits ?? [];
  const top = Math.max(0, Math.min(highlighted - 7, list.length - 14));
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') setHighlighted((h) => Math.min(list.length - 1, h + 1));
    else if (event.key === 'ArrowUp') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'Enter') open(list[highlighted]);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  return (
    <div className="picker">
      <div className="cn-menu cn-picker find" role="dialog" aria-label="find in every conversation">
        <div className="cn-menu__head">
          <b>find</b>
          <input
            ref={field}
            className="menu-search"
            value={query}
            placeholder="in every conversation"
            spellCheck={false}
            aria-label="find in every conversation"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="cn-dim">{hits ? `${hits.length}${hits.length === 50 ? '+' : ''} found` : ''}</span>
        </div>
        <div role="listbox" aria-label="messages found">
          {list.slice(top, top + 14).map((hit, i) => {
            const on = top + i === highlighted;
            const session = sessions[hit.session];
            return (
              <div
                key={`${hit.session}:${hit.entry.id}`}
                role="option"
                aria-selected={on}
                className={`cn-menu__item picker__row${on ? ' cn-menu__item--on' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => open(hit)}
              >
                <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
                <span className="picker__n">{n.get(hit.session) ?? ''}</span>
                <span className="cn-menu__name find__session" title={session?.name}>{session?.name ?? hit.session}</span>
                <MsgGlyph type={msgType(hit.entry.kind)} />
                <span className="cn-menu__desc" title={hit.entry.text}>
                  {underline(hit.entry.text, query.trim())}
                  {hit.entry.detail ? <span className="cn-dim"> {underline(hit.entry.detail, query.trim())}</span> : null}
                </span>
                <span className="cn-dim">{hit.entry.at ? ago(Date.parse(hit.entry.at), now) : ''}</span>
              </div>
            );
          })}
          {hits && !hits.length ? <div className="cn-menu__item cn-dim picker__row">nothing found</div> : null}
        </div>
        <div className="cn-menu__foot">
          <KeyHints keys={[['↑↓', 'move'], ['enter', 'open'], ['esc', 'close']]} />
          <span className="cn-fill" />
          <span className="cn-dim">each message's line, as the tree shows it</span>
        </div>
      </div>
    </div>
  );
}

/** C-Space A: everything waiting for you, oldest first. enter goes there with its card focused, as C-Space a does. */
export function WaitingDialog() {
  const sessions = useStore((s) => s.sessions);
  const [highlighted, setHighlighted] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  const waiting = useMemo(() => {
    const n = new Map(numbered(sessions).map((x) => [x.session.id, x.n]));
    return waitingOldestFirst(sessions).map((session) => ({ n: n.get(session.id) ?? 0, session }));
  }, [sessions]);
  const shown = Math.min(highlighted, Math.max(0, waiting.length - 1));

  const go = (id: string | undefined) => {
    if (!id) return;
    close();
    store.attendTo(id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'j') setHighlighted(Math.min(waiting.length - 1, shown + 1));
    else if (event.key === 'ArrowUp' || event.key === 'k') setHighlighted(Math.max(0, shown - 1));
    else if (event.key === 'Enter') go(waiting[shown]?.session.id);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  return (
    <div className="picker" tabIndex={-1} ref={box} onKeyDown={onKeyDown}>
      <div className="cn-menu cn-picker" role="dialog" aria-label="everything waiting">
        <div className="cn-menu__head">
          <b>waiting for you</b>
          <span className="cn-fill" />
          <span className="cn-dim">oldest first</span>
        </div>
        <div role="listbox" aria-label="waiting sessions">
          {waiting.map(({ n, session }, i) => (
            <SessionRow
              key={session.id}
              n={n}
              session={session}
              on={i === shown}
              detail={session.waitingFor ?? task(session)}
              onPick={() => go(session.id)}
            />
          ))}
          {!waiting.length ? <div className="cn-menu__item cn-dim picker__row">nothing is waiting for you</div> : null}
        </div>
        <div className="cn-menu__foot">
          <KeyHints keys={[['↑↓', 'move'], ['enter', 'go'], ['esc', 'close']]} />
        </div>
      </div>
    </div>
  );
}

// ── The command prompt (C-Space :) ──────────────────────────────────────

const THEME_KEY = 'constellation.theme';

/** Dark, the design system's primary theme, unless you chose light, or auto to follow your system. */
export function applyTheme(theme = savedTheme()) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

function savedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const MODES: Mode[] = ['default', 'plan', 'acceptEdits', 'auto', 'bypassPermissions', 'dontAsk'];

/** The commands, with what they take. Session commands act on the focused session. */
export const COMMANDS: Array<[string, string, string]> = [
  ['model', '[model]', 'pick or set the model'],
  ['effort', '<level>', 'set the effort'],
  ['mode', '[mode]', 'pick or set the mode'],
  ['context', '', 'what fills the context'],
  ['usage', '', 'tokens, cost and resources'],
  ['compact', '', 'summarise to free context'],
  ['clear', '', 'start the conversation over'],
  ['mcp', '', 'MCP servers'],
  ['fork', '[name]', 'continue in a new session'],
  ['rename', '<name>', 'rename the session'],
  ['rewind', '', 'go back to a prompt'],
  ['stop', '', 'stop the session'],
  ['stop-task', '[id]', 'stop a background task'],
  ['adopt', '', 'resume a terminal session here'],
  ['new', '', 'start a session'],
  ['window', '', 'a new window of panes'],
  ['resume', '', 'resume a past session'],
  ['hooks', '', "see what terminal sessions ask"],
  ['limit', 'mem|gpu|cpu <n>|reset', 'when a session raises an alert'],
  ['notify', 'on|off', 'desktop notifications'],
  ['theme', 'light|dark|auto', 'the color theme'],
  ['keys', '', 'every key'],
];

/** Done (null), refused with why (a string), or done with something to say. */
export type Outcome = string | null | { info: string };

function limitsText(limits: Limits): string {
  return `limits: memory ${limits.memoryGb ?? '—'} GB · GPU ${limits.gpuGb ?? '—'} GB · CPU ${limits.cpuPercent}% for 5m`;
}

const LIMIT_FIELDS: Record<string, 'memoryGb' | 'gpuGb' | 'cpuPercent'> = { mem: 'memoryGb', memory: 'memoryGb', gpu: 'gpuGb', cpu: 'cpuPercent' };

/** Runs one command line. */
export async function run(line: string): Promise<Outcome> {
  const [name, ...rest] = line.trim().replace(/^:/, '').split(/\s+/);
  const arg = rest.join(' ');
  const { focused, sessions } = store.state;
  const session = focused ? sessions[focused] : undefined;
  const open = (kind: 'model' | 'mode' | 'context' | 'mcp' | 'rewind' | 'stop' | 'adopt' | 'clear' | 'usage') => {
    if (!session) return 'no session';
    store.set({ dialog: { kind, session: session.id } });
    return null;
  };
  const managed = () => (!session ? 'no session' : session.kind !== 'managed' ? `${session.name} is external: adopt it first` : null);
  try {
    switch (name) {
      case 'new':
        store.set({ dialog: { kind: 'launcher' } });
        return null;
      case 'resume':
        store.set({ dialog: { kind: 'resume' } });
        return null;
      case 'hooks':
        store.set({ dialog: { kind: 'hooks' } });
        return null;
      case 'keys':
        store.set({ dialog: { kind: 'keys' } });
        return null;
      case 'window':
        store.newWindow();
        return null;
      case 'theme': {
        if (!['light', 'dark', 'auto'].includes(arg)) return 'theme light, dark or auto';
        try {
          if (arg === 'dark') localStorage.removeItem(THEME_KEY);
          else localStorage.setItem(THEME_KEY, arg);
        } catch {
          // not remembered, still applied
        }
        applyTheme(arg);
        return null;
      }
      case 'context':
        return open('context');
      case 'usage':
        return open('usage');
      case 'limit': {
        const [what, value] = rest;
        if (!what) return { info: limitsText(await api.limits()) };
        if (what === 'reset') return { info: limitsText(await api.setLimits({ reset: true })) };
        const n = Number(value);
        if (!LIMIT_FIELDS[what] || !(n > 0)) return 'limit mem <GB>, gpu <GB>, cpu <percent>, or reset';
        return { info: limitsText(await api.setLimits({ [LIMIT_FIELDS[what]]: n })) };
      }
      case 'notify':
        if (!arg) return { info: `notifications ${notifying() ? 'on' : 'off'}` };
        if (arg !== 'on' && arg !== 'off') return 'notify on or off';
        return (await setNotifying(arg === 'on')) ?? { info: `notifications ${arg}` };
      case 'adopt':
        return session?.kind === 'managed' ? `${session.name} is managed already` : open('adopt');
      case 'stop':
        return managed() ?? open('stop');
    }
    const refused = managed();
    if (refused) return refused;
    const id = session!.id;
    switch (name) {
      case 'model':
        if (!arg) return open('model');
        await api.setModel(id, arg);
        return null;
      case 'effort':
        if (!EFFORTS.includes(arg as Effort)) return `effort ${EFFORTS.join(', ')}`;
        await api.setEffort(id, arg as Effort);
        return null;
      case 'mode':
        if (!arg || arg === 'bypassPermissions') return open('mode'); // bypass takes its second key there
        if (!MODES.includes(arg as Mode)) return `mode ${MODES.join(', ')}`;
        await api.setMode(id, arg as Mode);
        return null;
      case 'mcp':
        return open('mcp');
      case 'rewind':
        return open('rewind');
      case 'compact':
        await api.prompt(id, '/compact');
        return null;
      case 'clear':
        if (session!.pending.length) return open('clear');
        await api.prompt(id, '/clear');
        return null;
      case 'fork': {
        const { id: forked } = await api.fork(id, arg || null);
        store.open(forked); // design system: a fork opens in a new pane
        return null;
      }
      case 'rename':
        if (!arg) {
          store.set({ renaming: id });
          return null;
        }
        await api.rename(id, arg);
        return null;
      case 'stop-task': {
        const tasks = session!.tasks;
        const task = arg ? tasks.find((t) => t.id === arg || t.id.startsWith(arg)) : tasks.length === 1 ? tasks[0] : undefined;
        if (!tasks.length) return 'no background task is running';
        if (!task) return `which one? ${tasks.map((t) => `${t.id.slice(0, 8)} ${t.description}`).join(' · ')}`;
        await api.stopTask(id, task.id);
        return null;
      }
      default:
        return `no such command: ${name}`;
    }
  } catch (failure) {
    return reason(failure);
  }
}

/** C-Space : (design system: keyboard): one line over the status bar, as in tmux. Tab completes the command. */
export function CommandPrompt() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const tasks = useStore((s) => (s.focused ? s.sessions[s.focused]?.tasks : undefined));
  useEffect(() => field.current?.focus(), []);

  const word = value.trimStart().split(/\s+/)[0] ?? '';
  const typingName = !value.includes(' ');
  const matches = useMemo(() => (typingName ? COMMANDS.filter(([name]) => name.startsWith(word)) : []), [word, typingName]);
  useEffect(() => setHighlighted(0), [word]);
  const close = () => store.set({ command: false });

  const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') close();
    else if (event.key === 'Tab' && matches.length) setValue(`${matches[highlighted][0]} `);
    else if (event.key === 'ArrowDown' && matches.length) setHighlighted((h) => (h + 1) % matches.length);
    else if (event.key === 'ArrowUp' && matches.length) setHighlighted((h) => (h - 1 + matches.length) % matches.length);
    else if (event.key === 'Enter') {
      event.preventDefault();
      const line = typingName && matches.length && !COMMANDS.some(([name]) => name === word) ? matches[highlighted][0] : value;
      const outcome = await run(line);
      if (outcome === null) close();
      else if (typeof outcome === 'string') setError(outcome);
      else {
        setInfo(outcome.info); // stays until the next key: esc closes
        setValue('');
      }
      return;
    } else return;
    event.preventDefault();
  };

  return (
    <div className="command-prompt">
      {matches.length && word ? (
        <div className="cn-menu command-prompt__menu" role="listbox" aria-label="commands">
          {matches.slice(0, 8).map(([name, args, what], i) => (
            <div key={name} role="option" aria-selected={i === highlighted} className={`cn-menu__item${i === highlighted ? ' cn-menu__item--on' : ''}`}>
              <span className="cn-row__bar">{i === highlighted ? glyph('tree', 'cursor') : ' '}</span>
              <span className="cn-menu__name">
                {name} {args ? <span className="cn-dim">{args}</span> : null}
              </span>
              <span className="cn-menu__desc">
                {what}
                {name === 'stop-task' && tasks?.length ? <span className="cn-dim"> · {tasks.length} running</span> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="command-prompt__line">
        <span className="cn-chip cn-chip--brand">:</span>
        <input
          ref={field}
          className="command-prompt__input"
          value={value}
          spellCheck={false}
          aria-label="command"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
            setInfo(null);
          }}
          onKeyDown={(event) => void onKeyDown(event)}
          onBlur={close}
        />
        {error ? (
          <span className="cn-status--error cn-ellipsis">
            {glyph('status', 'error')} {error}
          </span>
        ) : info ? (
          <span className="cn-ellipsis">{info}</span>
        ) : (
          <KeyHints keys={[['tab', 'complete'], ['enter', 'run'], ['esc', 'close']]} />
        )}
      </div>
    </div>
  );
}
