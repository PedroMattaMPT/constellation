import { KeyHints, KindMark, MessageRow, ModeBadge, Spinner, StatusBadge, StatusLine, glyph } from '@ds';
import { type MouseEvent, type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { api, reason } from './api';
import { AnswerCard } from './Answer';
import { ago, cost, model, msgType } from './format';
import { HeadButton, HideButton } from './Hide';
import { closeLabel, closePane, usePane } from './paneContext';
import { PromptInput } from './Prompt';
import type { Entry, EntryContent, EntryPage, Mode, Session } from './protocol';
import { numbered, store, useStore } from './store';

const PAGE = 300;
const FLASH_MS = 120; // design system: a jump flashes the row once, selection, 120 ms
const FIRST_INDEX = 1_000_000; // Virtuoso's index of the first row; it counts down as older pages are prepended
const ROW_PX = 20; // a one-line row (design system): Virtuoso's guess for rows it hasn't measured yet
const SETTLE_MS = 1500; // a list opened at its end keeps the end in view this long while its rows are measured

/** The design system's conversation shows prompts, tool calls, peer messages and replies: thinking stays out. */
const shown = (entries: Entry[]) => entries.filter((e) => e.kind !== 'thinking');

/**
 * What the list draws: entries, with a rule where /clear started a new transcript, and one rule for each run of
 * entries a rewind left behind (roadmap 2.10). An opened run shows its entries, faint, under its rule.
 */
type Line =
  | { kind: 'entry'; entry: Entry; cleared: boolean; abandoned: boolean }
  | { kind: 'rewound'; id: string; turns: number; open: boolean }
  | ({ kind: 'record' } & InlineRecord);

/** An inline record that isn't in the transcript (design system: fork's record in both sessions). */
export interface InlineRecord {
  id: string;
  /** Unix ms: it goes after the last entry written before it. */
  at: number;
  text: string;
  detail: string;
  /** The session it points at, while it runs. */
  session: string | null;
}

/** A session's fork records: where it was forked from, and the forks made from it. */
export function records(session: Session): InlineRecord[] {
  const found: InlineRecord[] = [];
  if (session.forkOf) {
    const { at, name, session: from } = session.forkOf;
    found.push({ id: `fork-of:${at}`, at, text: 'fork', detail: `from ${name}`, session: from });
  }
  for (const fork of session.forks) {
    found.push({ id: `fork:${fork.at}:${fork.name}`, at: fork.at, text: 'fork', detail: `${glyph('message', 'sent')} ${fork.name}`, session: fork.session });
  }
  return found;
}

/**
 * Puts each record after the last entry written before it. One that falls before the first entry of a page with
 * older pages, or after the last of a page with newer ones, waits for that page.
 */
export function withRecords(drawn: Line[], found: InlineRecord[], hasBefore: boolean, hasAfter: boolean): Line[] {
  if (!found.length) return drawn;
  const out = [...drawn];
  for (const record of [...found].sort((a, b) => a.at - b.at)) {
    let after = -1;
    out.forEach((line, i) => {
      if (line.kind === 'entry' && line.entry.at && Date.parse(line.entry.at) <= record.at) after = i;
    });
    if ((after < 0 && hasBefore) || (after === out.length - 1 && hasAfter)) continue;
    out.splice(after + 1, 0, { kind: 'record', ...record });
  }
  return out;
}

export function lines(entries: Entry[], open: Set<string>): Line[] {
  const out: Line[] = [];
  let run: { id: string; turns: Set<number>; entries: Entry[] } | null = null;
  let transcript: string | null = null;
  const flush = () => {
    if (!run) return;
    const isOpen = open.has(run.id);
    out.push({ kind: 'rewound', id: run.id, turns: run.turns.size, open: isOpen });
    if (isOpen) for (const entry of run.entries) out.push({ kind: 'entry', entry, cleared: false, abandoned: true });
    run = null;
  };
  for (const entry of entries) {
    const cleared = transcript !== null && entry.sessionId !== transcript;
    transcript = entry.sessionId;
    if (entry.abandoned) {
      run ??= { id: entry.id, turns: new Set(), entries: [] };
      run.turns.add(entry.turn);
      run.entries.push(entry);
      continue;
    }
    flush();
    out.push({ kind: 'entry', entry, cleared, abandoned: false });
  }
  flush();
  return out;
}

/** The first entry of the left-behind run that holds `id`, to open it when a jump lands inside. */
export function runOf(entries: Entry[], id: string): string | null {
  let first: string | null = null;
  for (const entry of entries) {
    if (!entry.abandoned) first = null;
    else first ??= entry.id;
    if (entry.id === id) return entry.abandoned ? first : null;
  }
  return null;
}

interface Loaded {
  entries: Entry[];
  /** Range of seq loaded, hidden entries included, for paging and live appends. */
  firstSeq: number;
  lastSeq: number;
  hasBefore: boolean;
  hasAfter: boolean;
  first: number;
  /** Where the list opens: the newest line, or the entry jumped to. */
  start: { index: number; align: 'end' | 'center' };
  /** Remounts the list when a new page set replaces the old one. */
  generation: number;
}

type Opened = EntryContent | 'loading' | 'error';

function fromPage(page: EntryPage, generation: number, open: Set<string>, found: InlineRecord[], focus?: string): Loaded {
  const entries = shown(page.entries);
  const drawn = withRecords(lines(entries, open), found, page.hasBefore, page.hasAfter);
  const at = focus ? drawn.findIndex((l) => l.kind === 'entry' && l.entry.id === focus) : -1;
  return {
    entries,
    firstSeq: page.entries[0]?.seq ?? 0,
    lastSeq: page.entries.at(-1)?.seq ?? -1,
    hasBefore: page.hasBefore,
    hasAfter: page.hasAfter,
    first: FIRST_INDEX,
    start: at >= 0 ? { index: at, align: 'center' } : { index: Math.max(0, drawn.length - 1), align: 'end' },
    generation,
  };
}

function Body({ content }: { content: Opened }) {
  if (content === 'loading') return <span className="cn-dim">loading{glyph('misc', 'ellipsis')}</span>;
  if (content === 'error') return <span className="cn-status--error">could not load this entry</span>;
  return (
    <div className="conv-body">
      {content.text ? <pre>{content.text}</pre> : null}
      {content.input ? <pre className="conv-body__input">{content.input}</pre> : null}
      {content.result != null ? <pre className="conv-body__result">{content.result || 'no output'}</pre> : null}
      {content.truncated ? <div className="cn-dim">cut at 100 kB</div> : null}
    </div>
  );
}

/** A full-width rule with a label: `cleared` after /clear (design system), `rewound` before a left-behind run. */
function Rule({ label, onClick }: { label: ReactNode; onClick?: () => void }) {
  return (
    <div className={`conv-rule${onClick ? ' conv-rule--button' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <span className="conv-rule__label">{label}</span>
    </div>
  );
}

function Row({ sessionKey, entry, opened, flash, abandoned, onToggle }: { sessionKey: string; entry: Entry; opened?: Opened; flash: boolean; abandoned: boolean; onToggle: () => void }) {
  let text: ReactNode = entry.text;
  let detail: ReactNode = entry.detail;
  if (entry.kind === 'tool') text = entry.tool ?? entry.text;
  // The glyph is the slash: `/compact 182k → 41k tokens` (design system: inline record).
  if ((entry.kind === 'slash' || entry.kind === 'compact') && entry.text.startsWith('/')) text = entry.text.slice(1);
  if (entry.kind === 'sent' || entry.kind === 'received') detail = entry.peer ? `${entry.kind === 'sent' ? 'to' : 'from'} ${entry.peer}` : null;
  // A mode change: the design system's inline record, with the new mode's badge.
  if (entry.kind === 'mode') {
    text = 'mode';
    detail = <ModeBadge mode={entry.text as Mode} />;
  }
  let body: ReactNode = null;
  if (opened) body = <Body content={opened} />;
  else if (entry.images) {
    // Sent images (design system: ▣ name), opened in the floating layer.
    body = (
      <span className="conv-images">
        {Array.from({ length: entry.images }, (_, n) => (
          <button
            key={n}
            type="button"
            className="cn-tag tag-button"
            onClick={(event) => {
              event.stopPropagation();
              store.set({ dialog: { kind: 'image', session: sessionKey, entry: entry.id, n } });
            }}
          >
            {glyph('misc', 'image')} image {n + 1}
          </button>
        ))}
      </span>
    );
  }
  else if (entry.resultPreview && (entry.kind === 'tool' || entry.kind === 'subagent_started')) {
    // Output stays collapsed to one dim line until opened; a failure keeps the denied glyph and color.
    body = entry.resultError ? (
      <span className="cn-msg--denied">{glyph('message', 'denied')} {entry.resultPreview}</span>
    ) : (
      <span className="cn-dim">{entry.resultPreview}</span>
    );
  }
  const classes = ['conv-row', `conv-row--${entry.kind}`];
  if (flash) classes.push('conv-row--flash');
  if (abandoned) classes.push('conv-row--abandoned');
  return (
    <div className={classes.join(' ')} onClick={onToggle} title="open">
      <MessageRow type={msgType(entry.kind)} text={text} detail={detail} body={body} />
    </div>
  );
}

/** The pane's activity line while the session works. Only a managed session can be interrupted from here. */
function Activity({ step, session }: { step: string; session: Session | null }) {
  return (
    <div className="cn-msg cn-msg--activity conv-row">
      <span className="cn-msg__gutter cn-status--working">
        <Spinner />
      </span>
      <span className="cn-msg__main">
        <span className="cn-status--working">{step}</span>
        {session ? (
          <>
            <span className="cn-dim"> · </span>
            <button type="button" className="link-button cn-dim" onClick={() => void api.interrupt(session.id).catch(() => {})}>
              esc to interrupt
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}

/** What an external session waits on. Its question shows only if its hooks reported it (roadmap 3.12). */
function Waiting({ session }: { session: Session }) {
  const hooks = useStore((s) => s.hooks);
  const pane = session.tmux?.split('.').pop();
  const request = session.pending[0];
  const [error, setError] = useState<string | null>(null);
  const terminal = () => api.terminal(session.id).catch((failure: unknown) => setError(reason(failure)));
  return (
    <div className="conv-waiting">
      {request && session.kind === 'managed' ? null : (
        <>
          <StatusBadge status="waiting" />
          <span>{session.waitingFor ?? 'waiting'}</span>
        </>
      )}
      {session.kind === 'managed' ? (
        request ? <span className="cn-dim">· {request.tool}</span> : null
      ) : (
        <>
          <span className="cn-dim">· answer it in its terminal{pane ? ` (tmux ${pane})` : ''}</span>
          {pane ? (
            <button type="button" className="link-button" onClick={() => void terminal()}>
              go to terminal
            </button>
          ) : null}
          {!request && hooks && !hooks.installed ? (
            <button type="button" className="link-button" onClick={() => store.set({ dialog: { kind: 'hooks' } })}>
              see what it asks
            </button>
          ) : null}
        </>
      )}
      {error ? <span className="cn-status--error">{glyph('status', 'error')} {error}</span> : null}
    </div>
  );
}

/** Prompts sent while a turn runs wait here, in order, until it ends. */
function Queue({ session }: { session: Session }) {
  return (
    <div className="queue">
      {session.queued.map((text, i) => (
        <div key={i} className="queue__row">
          <span className="cn-msg--prompt">{glyph('message', 'prompt')}</span>
          <span className="cn-ellipsis queue__text">{text}</span>
          <span className="cn-dim">queued</span>
        </div>
      ))}
      <button type="button" className="cn-btn queue__drop" onClick={() => void api.clearQueue(session.id).catch(() => {})}>
        drop queued
      </button>
    </div>
  );
}

/** Background tasks still running (a background command, a background subagent), each with its stop. */
function Tasks({ session }: { session: Session }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="queue">
      {session.tasks.map((task) => (
        <div key={task.id} className="queue__row tasks__row">
          <span className={task.type?.includes('agent') ? 'cn-msg--subagent' : 'cn-msg--tool'}>
            {glyph('message', task.type?.includes('agent') ? 'subagent_started' : 'tool')}
          </span>
          <span className="cn-ellipsis queue__text">{task.description}</span>
          <span className="cn-dim">in the background</span>
          <button type="button" className="link-button" onClick={() => api.stopTask(session.id, task.id).catch((failure: unknown) => setError(reason(failure)))}>
            {glyph('status', 'stopped')} stop
          </button>
        </div>
      ))}
      {error ? <span className="cn-status--error">{glyph('status', 'error')} {error}</span> : null}
    </div>
  );
}

/** The name in the pane header, edited in place (C-Space , or a double-click): enter saves, esc cancels. */
function Name({ session }: { session: Session }) {
  const renaming = useStore((s) => s.renaming === session.id);
  const done = () => store.set({ renaming: null });
  if (!renaming) {
    return (
      <span
        className="cn-pane__name"
        onDoubleClick={session.kind === 'managed' ? () => store.set({ renaming: session.id }) : undefined}
        title={session.kind === 'managed' ? 'double-click to rename · C-Space ,' : undefined}
      >
        {session.name}
      </span>
    );
  }
  return (
    <span className="cn-rename">
      <input
        className="rename__input"
        defaultValue={session.name}
        autoFocus
        spellCheck={false}
        aria-label="new name"
        onFocus={(event) => event.currentTarget.select()}
        onBlur={done}
        onKeyDown={(event) => {
          if (event.key === 'Escape') done();
          else if (event.key === 'Enter') {
            const name = event.currentTarget.value.trim();
            if (name && name !== session.name) void api.rename(session.id, name).catch(() => {});
            done();
          } else return;
          event.preventDefault();
        }}
      />
      <span className="cn-dim"> enter save · esc cancel</span>
    </span>
  );
}

/**
 * The design system's StatusLine: model │ @branch │ ctx │ mode │ mcp │ cost. On the web its segments take a click
 * (design system: Claude Code features): the model opens the model picker, the context bar its breakdown, the mode
 * badge the mode menu, mcp the MCP servers, the cost the usage card.
 */
function Status({ session }: { session: Session }) {
  const managed = session.kind === 'managed';
  const open = (kind: 'model' | 'context' | 'mode' | 'mcp' | 'usage') => store.set({ dialog: { kind, session: session.id } });
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const line = target.closest('.cn-statusline');
    if (!line) return;
    const segment = [...line.children].find((child) => child.contains(target));
    if (!segment) return;
    if (segment.classList.contains('cn-ctx')) open('context');
    else if (segment.classList.contains('cn-statusline__cost')) open('usage');
    else if (!managed) return;
    else if (segment === line.firstElementChild) open('model');
    else if (segment.matches('.cn-chip, .cn-mode')) open('mode');
    else if (segment.textContent?.startsWith('mcp')) open('mcp');
  };
  const name = [model(session), session.effort].filter(Boolean).join(' ');
  return (
    <div className={`statusline${managed ? ' statusline--live' : ''}`} onClick={onClick}>
      <StatusLine
        model={name || '—'}
        branch={session.branch ?? '—'}
        ctx={Math.round(session.context?.percent ?? 0)}
        mode={session.mode ?? 'default'}
        cost={cost(session.costUsd)}
        mcp={session.mcp ? { up: session.mcp.connected, down: session.mcp.failed } : undefined}
      />
    </div>
  );
}

/**
 * C-Space [ (design system: scroll mode, as tmux's copy mode): vi keys move through the conversation while the prompt
 * box keeps its text. q or esc ends it; / opens find.
 */
function useScrollMode(on: boolean, section: RefObject<HTMLElement | null>, toEnd: () => void) {
  useEffect(() => {
    if (!on) return;
    (document.activeElement as HTMLElement | null)?.blur();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const scroller = section.current?.querySelector<HTMLElement>('[data-virtuoso-scroller]');
      if (!scroller) return;
      const half = scroller.clientHeight / 2;
      const by: Record<string, number> = { j: ROW_PX, ArrowDown: ROW_PX, k: -ROW_PX, ArrowUp: -ROW_PX, d: half, u: -half, f: half * 2, b: -half * 2, PageDown: half * 2, PageUp: -half * 2 };
      if (event.key in by) scroller.scrollBy({ top: by[event.key] });
      else if (event.key === 'g') scroller.scrollTo({ top: 0 });
      else if (event.key === 'G') toEnd();
      else if (event.key === '/') store.set({ scroll: null, dialog: { kind: 'find' } });
      else if (event.key === 'q' || event.key === 'Escape') store.set({ scroll: null });
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [on]);
}

export function Conversation({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const pane = usePane();
  const zoomed = useStore((s) => s.zoomed);
  const paneFocus = useStore((s) => s.paneFocus);
  const section = useRef<HTMLElement>(null);
  const scrolling = useStore((s) => s.scroll !== null && s.scroll === pane.id);
  useScrollMode(scrolling, section, () => list.current?.scrollToIndex({ index: 'LAST', align: 'end' }));
  // A key moved here (C-Space h j k l, o, a window): the prompt box takes the keys, unless a card already has them.
  useEffect(() => {
    if (!pane.focused || !paneFocus || section.current?.contains(document.activeElement)) return;
    section.current?.querySelector<HTMLElement>('.cn-card[tabindex="0"], textarea')?.focus();
  }, [paneFocus, pane.focused]);
  const sessions = useStore((s) => s.sessions);
  const jump = useStore((s) => s.jump);
  const now = useStore((s) => s.now);
  const n = useMemo(() => numbered(sessions).find((x) => x.session.id === id)?.n ?? 0, [sessions, id]);

  const [data, setData] = useState<Loaded | null>(null);
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [runs, setRuns] = useState<Set<string>>(() => new Set()); // left-behind runs shown open
  const [flash, setFlash] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const found = useMemo(() => (session ? records(session) : []), [session?.forkOf, session?.forks]);
  const recordsRef = useRef(found);
  recordsRef.current = found;
  const list = useRef<VirtuosoHandle>(null);
  const settleUntil = useRef(0);
  // Virtuoso places the last row by guessed heights, then keeps the top row still as it measures the real ones:
  // until you scroll or click, follow the end instead.
  useEffect(() => {
    settleUntil.current = data?.start.align === 'end' ? Date.now() + SETTLE_MS : 0;
  }, [data?.generation]);
  const unsettle = () => (settleUntil.current = 0);

  const loadTail = useCallback(() => {
    const mine = ++generation.current;
    return api.entries(id, { limit: PAGE }).then(
      (page) => mine === generation.current && setData(fromPage(page, mine, runsRef.current, recordsRef.current)),
      () => {}, // not known to the server yet (a session just started): the effect below asks again
    );
  }, [id]);

  useEffect(() => {
    setData(null);
    setOpened({});
    setRuns(new Set());
    void loadTail();
  }, [loadTail]);

  // A session opened right after starting can be focused before the server sees it, or before its transcript
  // exists: load again once it does.
  const known = !!session;
  const written = !!session?.transcriptExists;
  useEffect(() => {
    if (known && !data) void loadTail();
  }, [known, written]);

  useEffect(() => {
    if (!jump || jump.session !== id) return;
    const mine = ++generation.current;
    void api.entries(id, { around: jump.entry, limit: PAGE }).then((page) => {
      if (mine !== generation.current) return;
      // A jump into a run a rewind left behind opens that run.
      const run = runOf(shown(page.entries), jump.entry);
      const open = run ? new Set([...runsRef.current, run]) : runsRef.current;
      setRuns(open);
      setData(fromPage(page, mine, open, recordsRef.current, jump.entry));
      setFlash(jump.entry);
      window.setTimeout(() => setFlash(null), FLASH_MS);
    });
  }, [jump, id]);

  // Live: update entries already shown, append new ones when the list is at the tail.
  useEffect(
    () =>
      store.onEntries((event) => {
        if (event.session !== id) return;
        if (event.reset) {
          void loadTail();
          return;
        }
        setData((current) => {
          if (!current) return current;
          const entries = [...current.entries];
          const index = new Map(entries.map((e, i) => [e.id, i]));
          let { hasAfter, lastSeq } = current;
          for (const entry of event.entries) {
            const at = index.get(entry.id);
            if (at != null) entries[at] = entry;
            else if (entry.seq > lastSeq && !hasAfter) {
              lastSeq = entry.seq;
              if (entry.kind !== 'thinking') entries.push(entry);
            } else if (entry.seq > lastSeq) hasAfter = true;
          }
          return { ...current, entries, hasAfter, lastSeq };
        });
      }),
    [id, loadTail],
  );

  const older = useCallback(() => {
    if (!data?.hasBefore || busy.current) return;
    busy.current = true;
    void api
      .entries(id, { before: data.firstSeq, limit: PAGE })
      .then((page) =>
        setData((d) => {
          if (!d) return d;
          const entries = [...shown(page.entries), ...d.entries];
          // Virtuoso counts lines, not entries: move the first index by the lines this page adds.
          const count = (list: Entry[], before: boolean) =>
            withRecords(lines(list, runsRef.current), recordsRef.current, before, d.hasAfter).length;
          const added = count(entries, page.hasBefore) - count(d.entries, d.hasBefore);
          return { ...d, entries, first: d.first - added, firstSeq: page.entries[0]?.seq ?? d.firstSeq, hasBefore: page.hasBefore };
        }),
      )
      .finally(() => (busy.current = false));
  }, [data, id]);

  const newer = useCallback(() => {
    if (!data?.hasAfter || busy.current) return;
    busy.current = true;
    void api
      .entries(id, { after: data.lastSeq, limit: PAGE })
      .then((page) =>
        setData((d) =>
          d ? { ...d, entries: [...d.entries, ...shown(page.entries)], lastSeq: page.entries.at(-1)?.seq ?? d.lastSeq, hasAfter: page.hasAfter } : d,
        ),
      )
      .finally(() => (busy.current = false));
  }, [data, id]);

  const toggle = (entry: Entry) => {
    if (opened[entry.id]) {
      setOpened(({ [entry.id]: _closed, ...rest }) => rest);
      return;
    }
    setOpened((o) => ({ ...o, [entry.id]: 'loading' }));
    api.content(id, entry.id).then(
      (content) => setOpened((o) => ({ ...o, [entry.id]: content })),
      () => setOpened((o) => ({ ...o, [entry.id]: 'error' })),
    );
  };

  const drawn = useMemo(
    () => (data ? withRecords(lines(data.entries, runs), found, data.hasBefore, data.hasAfter) : []),
    [data, runs, found],
  );

  // Virtuoso needs a components object every render: swapping it for undefined crashes the list.
  const managed = session?.kind === 'managed';
  const step =
    session?.activity === 'compacting'
      ? `compacting${glyph('misc', 'ellipsis')}`
      : session?.status === 'working' && !data?.hasAfter
        ? (session.step ?? 'working')
        : null;
  const components = useMemo(
    () => (step ? { Footer: () => <Activity step={step} session={managed ? session : null} /> } : {}),
    [step, managed, session?.id],
  );

  if (!session) {
    return <div className="conv-empty cn-dim">starting{glyph('misc', 'ellipsis')}</div>;
  }
  const classes = ['cn-pane', 'pane'];
  if (pane.focused) classes.push('cn-pane--focused');
  if (pane.focused && zoomed) classes.push('cn-pane--zoomed');
  if (session.kind === 'external') classes.push('cn-pane--external');
  if (session.mode === 'bypassPermissions') classes.push('cn-pane--bypass');
  if (session.status === 'waiting') classes.push('cn-pane--waiting');

  return (
    <section ref={section} className={classes.join(' ')} aria-label={`pane ${n}: ${session.name}`}>
      <header className="cn-pane__head">
        <span className="cn-pane__index">{n}</span>
        <Name session={session} />
        <KindMark kind={session.kind} />
        <span className="cn-dim cn-ellipsis">{session.project}</span>
        <span className="cn-fill" />
        {scrolling ? (
          <>
            <span className="cn-chip cn-chip--brand">scroll</span>
            <KeyHints keys={[['j k', 'line'], ['d u', 'half'], ['g G', 'ends'], ['/', 'find'], ['q', 'done']]} />
          </>
        ) : null}
        <StatusBadge status={session.status} age={ago(session.lastActivityAt, now)} />
        {managed ? (
          <HeadButton text={`${glyph('status', 'stopped')} stop`} label="stop this session" chord="C-Space &" onClick={() => store.set({ dialog: { kind: 'stop', session: session.id } })} />
        ) : (
          <HeadButton text={`${glyph('kind', 'managed')} adopt`} label="adopt this session: resume it here" chord="A" onClick={() => store.set({ dialog: { kind: 'adopt', session: session.id } })} />
        )}
        <HideButton label={closeLabel()} chord="C-Space x" onClick={() => closePane(pane.id)} />
      </header>
      <div className="cn-pane__conv conv" role="log" onWheel={unsettle} onPointerDown={unsettle} onKeyDown={unsettle}>
        {!session.transcriptExists ? (
          <div className="conv-empty cn-dim">no prompt yet</div>
        ) : data ? (
          <Virtuoso
            key={data.generation}
            ref={list}
            data={drawn}
            totalListHeightChanged={() => {
              if (Date.now() < settleUntil.current) list.current?.scrollToIndex({ index: 'LAST', align: 'end' });
            }}
            firstItemIndex={data.first}
            initialTopMostItemIndex={data.start}
            computeItemKey={(_, line) => (line.kind === 'entry' ? line.entry.id : `${line.kind}:${line.id}`)}
            startReached={older}
            endReached={newer}
            followOutput={(atBottom) => (atBottom && !data.hasAfter ? 'auto' : false)}
            components={components}
            itemContent={(_, line) =>
              line.kind === 'record' ? (
                <div
                  className={`conv-row conv-row--record${line.session ? '' : ' conv-row--still'}`}
                  onClick={line.session ? () => store.focus(line.session!) : undefined}
                  title={line.session ? 'open it' : undefined}
                >
                  <MessageRow type="slash" text={line.text} detail={line.detail} />
                </div>
              ) : line.kind === 'rewound' ? (
                <Rule
                  label={
                    <>
                      rewound · {line.turns} turn{line.turns === 1 ? '' : 's'} left behind{' '}
                      <span className="cn-dim">{line.open ? 'hide' : 'show'}</span>
                    </>
                  }
                  onClick={() => setRuns((all) => {
                    const next = new Set(all);
                    if (next.has(line.id)) next.delete(line.id);
                    else next.add(line.id);
                    return next;
                  })}
                />
              ) : (
                <>
                  {line.cleared ? <Rule label="cleared" /> : null}
                  <Row sessionKey={id} entry={line.entry} opened={opened[line.entry.id]} flash={flash === line.entry.id} abandoned={line.abandoned} onToggle={() => toggle(line.entry)} />
                </>
              )
            }
          />
        ) : (
          <div className="conv-empty cn-dim">loading{glyph('misc', 'ellipsis')}</div>
        )}
      </div>
      {session.status === 'waiting' || session.pending.length || session.error || session.queued.length || session.tasks.length ? (
        <div className="cn-pane__dock">
          {session.pending.length ? <AnswerCard session={session} /> : null}
          {session.status === 'waiting' && (!session.pending.length || (session.kind === 'external' && session.tmux)) ? <Waiting session={session} /> : null}
          {session.error ? (
            <div className="cn-status--error">
              {glyph('status', 'error')} {session.error}
            </div>
          ) : null}
          {session.queued.length ? <Queue session={session} /> : null}
          {session.tasks.length ? <Tasks session={session} /> : null}
        </div>
      ) : null}
      {managed || session.inbox ? (
        <PromptInput key={session.id} session={session} />
      ) : (
        <div className="cn-prompt cn-prompt--external cn-prompt--disabled">
          <div className="cn-prompt__line">
            <span className="cn-prompt__marker">{glyph('message', 'prompt')}</span>
            <span className="cn-prompt__ph">watching only · it has no inbox Constellation can use</span>
          </div>
        </div>
      )}
      <Status session={session} />
    </section>
  );
}
