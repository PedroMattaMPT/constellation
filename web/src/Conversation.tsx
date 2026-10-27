import { KindMark, MessageRow, PromptBox, Spinner, StatusBadge, StatusLine, glyph } from '@ds';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { api } from './api';
import { AnswerCard } from './Answer';
import { ago, cost, model, msgType } from './format';
import { HeadButton, HideButton } from './Hide';
import { PromptInput } from './Prompt';
import type { Entry, EntryContent, EntryPage, Session } from './protocol';
import { numbered, store, useStore } from './store';

const PAGE = 300;
const FLASH_MS = 120; // design system: a jump flashes the row once, selection, 120 ms
const FIRST_INDEX = 1_000_000; // Virtuoso's index of the first row; it counts down as older pages are prepended

/** The design system's conversation shows prompts, tool calls, peer messages and replies: thinking stays out. */
const shown = (entries: Entry[]) => entries.filter((e) => e.kind !== 'thinking');

interface Loaded {
  entries: Entry[];
  /** Range of seq loaded, hidden entries included, for paging and live appends. */
  firstSeq: number;
  lastSeq: number;
  hasBefore: boolean;
  hasAfter: boolean;
  first: number;
  /** Where the list opens: the newest entry, or the one jumped to. */
  start: { index: number; align: 'end' | 'center' };
  /** Remounts the list when a new page set replaces the old one. */
  generation: number;
}

type Opened = EntryContent | 'loading' | 'error';

function fromPage(page: EntryPage, generation: number, focus?: string): Loaded {
  const entries = shown(page.entries);
  const at = focus ? entries.findIndex((e) => e.id === focus) : -1;
  return {
    entries,
    firstSeq: page.entries[0]?.seq ?? 0,
    lastSeq: page.entries.at(-1)?.seq ?? -1,
    hasBefore: page.hasBefore,
    hasAfter: page.hasAfter,
    first: FIRST_INDEX,
    start: at >= 0 ? { index: at, align: 'center' } : { index: Math.max(0, entries.length - 1), align: 'end' },
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

function Row({ entry, opened, flash, onToggle }: { entry: Entry; opened?: Opened; flash: boolean; onToggle: () => void }) {
  let text: ReactNode = entry.text;
  let detail: ReactNode = entry.detail;
  if (entry.kind === 'tool') text = entry.tool ?? entry.text;
  if (entry.kind === 'slash' && entry.text.startsWith('/')) text = entry.text.slice(1); // the glyph is the slash
  if (entry.kind === 'sent' || entry.kind === 'received') detail = entry.peer ? `${entry.kind === 'sent' ? 'to' : 'from'} ${entry.peer}` : null;
  let body: ReactNode = null;
  if (opened) body = <Body content={opened} />;
  else if (entry.resultPreview && (entry.kind === 'tool' || entry.kind === 'subagent_started')) {
    // Output stays collapsed to one dim line until opened; a failure keeps the denied glyph and color.
    body = entry.resultError ? (
      <span className="cn-msg--denied">{glyph('message', 'denied')} {entry.resultPreview}</span>
    ) : (
      <span className="cn-dim">{entry.resultPreview}</span>
    );
  }
  return (
    <div className={`conv-row conv-row--${entry.kind}${flash ? ' conv-row--flash' : ''}`} onClick={onToggle} title="open">
      <MessageRow type={msgType(entry.kind)} text={text} detail={detail} body={body} />
    </div>
  );
}

/** The pane's activity line while the session works. Only a managed session can be interrupted from here. */
function Activity({ step, interruptible }: { step: string; interruptible: boolean }) {
  return (
    <div className="cn-msg cn-msg--activity conv-row">
      <span className="cn-msg__gutter cn-status--working">
        <Spinner />
      </span>
      <span className="cn-msg__main">
        <span className="cn-status--working">{step}</span>
        {interruptible ? <span className="cn-dim"> · esc to interrupt</span> : null}
      </span>
    </div>
  );
}

function Waiting({ session }: { session: Session }) {
  const pane = session.tmux?.split('.').pop();
  const request = session.pending[0];
  return (
    <div className="conv-waiting">
      <StatusBadge status="waiting" />
      <span>{session.waitingFor ?? 'waiting'}</span>
      {session.kind === 'managed' ? (
        request ? <span className="cn-dim">· {request.tool}</span> : null
      ) : (
        <span className="cn-dim">· answer it in its terminal{pane ? ` (tmux ${pane})` : ''}</span>
      )}
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

export function Conversation({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const sessions = useStore((s) => s.sessions);
  const jump = useStore((s) => s.jump);
  const now = useStore((s) => s.now);
  const n = useMemo(() => numbered(sessions).find((x) => x.session.id === id)?.n ?? 0, [sessions, id]);

  const [data, setData] = useState<Loaded | null>(null);
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);

  const loadTail = useCallback(() => {
    const mine = ++generation.current;
    return api.entries(id, { limit: PAGE }).then(
      (page) => mine === generation.current && setData(fromPage(page, mine)),
      () => {}, // not known to the server yet (a session just started): the effect below asks again
    );
  }, [id]);

  useEffect(() => {
    setData(null);
    setOpened({});
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
      setData(fromPage(page, mine, jump.entry));
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
          const added = shown(page.entries);
          return { ...d, entries: [...added, ...d.entries], first: d.first - added.length,
                   firstSeq: page.entries[0]?.seq ?? d.firstSeq, hasBefore: page.hasBefore };
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

  // Virtuoso needs a components object every render: swapping it for undefined crashes the list.
  const step = session?.status === 'working' && !data?.hasAfter ? (session.step ?? 'working') : null;
  const managed = session?.kind === 'managed';
  const components = useMemo(
    () => (step ? { Footer: () => <Activity step={step} interruptible={managed} /> } : {}),
    [step, managed],
  );

  if (!session) return null;
  const classes = ['cn-pane', 'cn-pane--focused', 'pane'];
  if (session.kind === 'external') classes.push('cn-pane--external');
  if (session.mode === 'bypassPermissions') classes.push('cn-pane--bypass');
  if (session.status === 'waiting') classes.push('cn-pane--waiting');

  return (
    <section className={classes.join(' ')} aria-label={`pane ${n}: ${session.name}`}>
      <header className="cn-pane__head">
        <span className="cn-pane__index">{n}</span>
        <Name session={session} />
        <KindMark kind={session.kind} />
        <span className="cn-dim cn-ellipsis">{session.project}</span>
        <span className="cn-fill" />
        <StatusBadge status={session.status} age={ago(session.lastActivityAt, now)} />
        {managed ? (
          <HeadButton text={`${glyph('status', 'stopped')} stop`} label="stop this session" chord="C-Space &" onClick={() => store.set({ dialog: { kind: 'stop', session: session.id } })} />
        ) : null}
        <HideButton label="minimize the pane" chord="C-Space x" onClick={() => store.toggle('pane')} />
      </header>
      <div className="cn-pane__conv conv" role="log">
        {!session.transcriptExists ? (
          <div className="conv-empty cn-dim">no prompt yet</div>
        ) : data ? (
          <Virtuoso
            key={data.generation}
            data={data.entries}
            firstItemIndex={data.first}
            initialTopMostItemIndex={data.start}
            computeItemKey={(_, entry) => entry.id}
            startReached={older}
            endReached={newer}
            followOutput={(atBottom) => (atBottom && !data.hasAfter ? 'auto' : false)}
            components={components}
            itemContent={(_, entry) => (
              <Row entry={entry} opened={opened[entry.id]} flash={flash === entry.id} onToggle={() => toggle(entry)} />
            )}
          />
        ) : (
          <div className="conv-empty cn-dim">loading{glyph('misc', 'ellipsis')}</div>
        )}
      </div>
      {session.status === 'waiting' || session.pending.length || session.error || session.queued.length ? (
        <div className="cn-pane__dock">
          {session.pending.length ? <AnswerCard session={session} /> : session.status === 'waiting' ? <Waiting session={session} /> : null}
          {session.error ? (
            <div className="cn-status--error">
              {glyph('status', 'error')} {session.error}
            </div>
          ) : null}
          {session.queued.length ? <Queue session={session} /> : null}
        </div>
      ) : null}
      {managed ? (
        <PromptInput session={session.id} running={session.status === 'working'} />
      ) : (
        <PromptBox disabled placeholder="watching only" />
      )}
      <StatusLine
        model={model(session)}
        branch={session.branch ?? '—'}
        ctx={session.context?.percent ?? 0}
        mode={session.mode ?? 'default'}
        cost={cost(session.costUsd)}
      />
    </section>
  );
}
