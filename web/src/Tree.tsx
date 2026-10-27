import { KeyHints, TreeFilter, TreeRow, glyph, label as dsLabel } from '@ds';
import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { api } from './api';
import { ago, msgType } from './format';
import type { Entry, LinkMessage, Session, Turn } from './protocol';
import { numbered, store, useStore } from './store';

/** Filter chips (keys 1–7) and the entry kinds each one covers. Thinking never shows in the tree. */
const CHIPS = [
  { type: 'prompt', kinds: ['prompt', 'interrupt'] },
  { type: 'slash', kinds: ['slash', 'compact', 'mode'] },
  { type: 'tool', kinds: ['tool', 'denied'] },
  { type: 'question', kinds: ['question', 'answer'] },
  { type: 'peer', kinds: ['sent', 'received'] },
  { type: 'subagent', kinds: ['subagent_started', 'subagent_reported'] },
  { type: 'reply', kinds: ['reply', 'notice'] },
] as const;
type ChipType = (typeof CHIPS)[number]['type'];
const CHIP_OF = new Map<string, ChipType>(CHIPS.flatMap((c) => c.kinds.map((k) => [k, c.type] as const)));
const ALL_BUT_PEER = new Set<ChipType>(CHIPS.map((c) => c.type).filter((t) => t !== 'peer'));

export type Row =
  | { key: string; depth: 0; type: 'project'; cwd: string; name: string; count: number }
  | { key: string; depth: 1; type: 'session'; session: Session; n: number }
  | { key: string; depth: 2; type: 'turn'; session: string; turn: Turn }
  | { key: string; depth: 3; type: 'entry'; session: string; entry: Entry }
  | { key: string; depth: 2 | 3; type: 'loading' };
type Placed = Row & { guides: boolean[]; last: boolean; hasChildren: boolean };

const turnKey = (session: string, turn: number) => `t:${session}:${turn}`;

/** The glyph says slash: the label doesn't repeat it (`/compact 182k → 41k`). */
export const slashless = (entry: Entry) => ((entry.kind === 'slash' || entry.kind === 'compact') && entry.text.startsWith('/') ? entry.text.slice(1) : entry.text);

export function label(row: Row): string {
  switch (row.type) {
    case 'project':
      return row.name;
    case 'session':
      return `${row.n} ${row.session.name}`;
    case 'turn':
      return slashless(row.turn.entry);
    case 'entry':
      if (row.entry.kind === 'mode') return `mode ${dsLabel('mode', row.entry.text)}`;
      return row.entry.kind === 'tool' ? `${row.entry.tool ?? ''} ${row.entry.detail ?? ''}` : slashless(row.entry);
    default:
      return '';
  }
}

export function MessageTree() {
  const sessions = useStore((s) => s.sessions);
  const now = useStore((s) => s.now);
  const link = useStore((s) => s.link);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => new Set());
  const [turns, setTurns] = useState<Record<string, Turn[]>>({});
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [off, setOff] = useState<Set<ChipType>>(() => new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState<string | null>(null); // null: not searching
  const [linked, setLinked] = useState<LinkMessage[] | null>(null);
  const list = useRef<VirtuosoHandle>(null);
  const rowsBox = useRef<HTMLDivElement>(null);
  const filterBox = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const offBeforeLink = useRef<Set<ChipType> | null>(null);

  const loadTurns = (id: string) => api.turns(id).then((t) => setTurns((all) => ({ ...all, [id]: t })), () => {});
  const loadTurn = (id: string, turn: number) =>
    api.entries(id, { turn, limit: 2000 }).then(
      (page) => setEntries((all) => ({ ...all, [turnKey(id, turn)]: page.entries.filter((e) => !e.starter && e.kind !== 'thinking') })),
      () => {},
    );

  // Keep expanded sessions current: new turns refetch the turn list, new entries go into open turns.
  const turnCounts = useMemo(() => Object.fromEntries(Object.values(sessions).map((s) => [s.id, s.turns])), [sessions]);
  useEffect(() => {
    for (const key of expanded) {
      if (!key.startsWith('s:')) continue;
      const id = key.slice(2);
      if (turnCounts[id] != null && turns[id] && turns[id].length !== turnCounts[id]) void loadTurns(id);
    }
  }, [turnCounts]);

  useEffect(
    () =>
      store.onEntries((event) => {
        if (event.reset) return;
        // A rewind marks old turns as left behind: the turn list says so, so refetch it.
        if (event.entries.some((e) => e.starter && e.abandoned)) void loadTurns(event.session);
        setEntries((all) => {
          let next = all;
          for (const entry of event.entries) {
            const key = turnKey(event.session, entry.turn);
            if (entry.starter || entry.kind === 'thinking' || !all[key]) continue;
            const current = next[key];
            const at = current.findIndex((e) => e.id === entry.id);
            next = { ...next, [key]: at >= 0 ? current.map((e, i) => (i === at ? entry : e)) : [...current, entry] };
          }
          return next;
        });
      }),
    [],
  );

  // An edge clicked on the map: open both sessions at their messages, filtered to peer messages (design system:
  // MessageEdge). The messages between the two are underlined; esc puts the filter back.
  useEffect(() => {
    if (!link) {
      setLinked(null);
      if (offBeforeLink.current) setOff(offBeforeLink.current);
      offBeforeLink.current = null;
      return;
    }
    offBeforeLink.current ??= off;
    setOff(ALL_BUT_PEER);
    let live = true;
    void api.links(link.source, link.target).then(async (found) => {
      if (!live) return;
      setLinked(found);
      const wanted = new Map<string, Set<number>>();
      for (const m of found) wanted.set(m.session, (wanted.get(m.session) ?? new Set()).add(m.entry.turn));
      const keys = [...wanted].flatMap(([id, set]) => [`s:${id}`, ...[...set].map((t) => turnKey(id, t))]);
      setCollapsedProjects(new Set());
      setExpanded((all) => new Set([...all, ...keys]));
      await Promise.all([...wanted].flatMap(([id, set]) => [loadTurns(id), ...[...set].map((t) => loadTurn(id, t))]));
      if (live && found[0]) setCursor(`${found[0].entry.starter ? turnKey(found[0].session, found[0].entry.turn) : `e:${found[0].entry.id}`}`);
    }, () => {});
    rowsBox.current?.focus();
    return () => {
      live = false;
    };
  }, [link?.source, link?.target]);
  const linkIds = useMemo(() => new Set((linked ?? []).map((m) => m.entry.id)), [linked]);

  const toggle = (key: string) => {
    if (key.startsWith('p:')) {
      setCollapsedProjects((set) => flip(set, key));
      return;
    }
    const opening = !expanded.has(key);
    setExpanded((set) => flip(set, key));
    if (!opening) return;
    if (key.startsWith('s:')) void loadTurns(key.slice(2));
    if (key.startsWith('t:')) {
      const [, id, turn] = key.split(':');
      void loadTurn(id, Number(turn));
    }
  };

  const rows = useMemo(() => {
    const out: Row[] = [];
    const byProject = new Map<string, Array<{ n: number; session: Session }>>();
    for (const item of numbered(sessions)) byProject.set(item.session.cwd, [...(byProject.get(item.session.cwd) ?? []), item]);
    for (const [cwd, items] of byProject) {
      const projectKey = `p:${cwd}`;
      out.push({ key: projectKey, depth: 0, type: 'project', cwd, name: items[0].session.project, count: items.length });
      if (collapsedProjects.has(projectKey)) continue;
      for (const { n, session } of items) {
        const sessionKey = `s:${session.id}`;
        out.push({ key: sessionKey, depth: 1, type: 'session', session, n });
        if (!expanded.has(sessionKey)) continue;
        const sessionTurns = turns[session.id];
        if (!sessionTurns) {
          out.push({ key: `${sessionKey}:loading`, depth: 2, type: 'loading' });
          continue;
        }
        for (const turn of sessionTurns) {
          const key = turnKey(session.id, turn.turn);
          out.push({ key, depth: 2, type: 'turn', session: session.id, turn });
          if (!expanded.has(key)) continue;
          const turnEntries = entries[key];
          if (!turnEntries) out.push({ key: `${key}:loading`, depth: 3, type: 'loading' });
          else for (const entry of turnEntries) out.push({ key: `e:${entry.id}`, depth: 3, type: 'entry', session: session.id, entry });
        }
      }
    }
    return place(out, (row) => {
      if (row.type === 'project') return true;
      if (row.type === 'session') return row.session.turns > 0;
      if (row.type === 'turn') return row.turn.entries > 1;
      return false;
    });
  }, [sessions, expanded, collapsedProjects, turns, entries]);

  // / search (design system: tree keys): rows whose label has the text are underlined; n and N go through them.
  const query = search?.trim().toLowerCase() ?? '';
  const matches = useMemo(
    () => (query ? rows.map((row, i) => (label(row).toLowerCase().includes(query) ? i : -1)).filter((i) => i >= 0) : []),
    [rows, query],
  );
  const matched = useMemo(() => new Set(matches.map((i) => rows[i].key)), [matches, rows]);

  const counts = useMemo(() => {
    const total = new Map<ChipType, number>();
    for (const s of Object.values(sessions)) {
      for (const [kind, count] of Object.entries(s.counts ?? {})) {
        const chip = CHIP_OF.get(kind);
        if (chip) total.set(chip, (total.get(chip) ?? 0) + count);
      }
    }
    return total;
  }, [sessions]);

  const activate = (row: Placed) => {
    if (row.type === 'project') toggle(row.key);
    else if (row.type === 'session') store.focus(row.session.id);
    else if (row.type === 'turn') store.jumpTo(row.session, row.turn.entry.id);
    else if (row.type === 'entry') store.jumpTo(row.session, row.entry.id);
  };

  const cursorIndex = rows.findIndex((r) => r.key === cursor);
  const moveTo = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    setCursor(row.key);
    list.current?.scrollIntoView({ index: rows.indexOf(row) });
  };
  // Keep a cursor set from outside (an edge's messages) in view once its row exists.
  useEffect(() => {
    if (cursorIndex >= 0) list.current?.scrollIntoView({ index: cursorIndex });
  }, [cursor, cursorIndex >= 0]);

  const nextMatch = (step: 1 | -1) => {
    if (!matches.length) return;
    const after = step === 1 ? matches.find((i) => i > cursorIndex) ?? matches[0] : [...matches].reverse().find((i) => i < cursorIndex) ?? matches.at(-1)!;
    moveTo(after);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = rows[cursorIndex];
    const digit = Number(event.key);
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (digit >= 1 && digit <= CHIPS.length) setOff((set) => flip(set, CHIPS[digit - 1].type));
    else if (event.key === 'ArrowDown' || event.key === 'j') moveTo(cursorIndex + 1);
    else if (event.key === 'ArrowUp' || event.key === 'k') moveTo(cursorIndex - 1);
    else if (event.key === '/') {
      setSearch(search ?? '');
      requestAnimationFrame(() => searchBox.current?.focus());
    } else if (event.key === 'f') filterBox.current?.querySelector('button')?.focus();
    else if (event.key === 'n' && matches.length) nextMatch(1);
    else if (event.key === 'N' && matches.length) nextMatch(-1);
    else if (event.key === 'Escape' && (link || search !== null)) {
      if (link) store.set({ link: null });
      setSearch(null);
    } else if (!row) return;
    else if (event.key === 'ArrowRight' && row.hasChildren && !isOpen(row)) toggle(row.key);
    else if (event.key === 'ArrowLeft' && row.hasChildren && isOpen(row)) toggle(row.key);
    else if (event.key === 'ArrowLeft' || event.key === 'p') moveTo(rows.findLastIndex((r, i) => i < cursorIndex && r.depth < row.depth));
    else if (event.key === 'P') moveTo(rows.findLastIndex((r, i) => i <= cursorIndex && r.depth === 0));
    else if (event.key === 'O') expandAll(row);
    else if (event.key === 'X') collapseAll(row);
    else if (event.key === 'Enter' || event.key === 'o') activate(row);
    else return;
    event.preventDefault();
  };

  /** O: open the row and everything below it (each turn loads its own entries). */
  const expandAll = (row: Row) => {
    if (row.type === 'project') {
      setCollapsedProjects((set) => new Set([...set].filter((k) => k !== row.key)));
      const ids = Object.values(sessions).filter((s) => s.cwd === row.cwd).map((s) => s.id);
      setExpanded((set) => new Set([...set, ...ids.map((id) => `s:${id}`)]));
      for (const id of ids) void loadTurns(id);
    } else if (row.type === 'session') {
      const id = row.session.id;
      void api.turns(id).then((all) => {
        setTurns((t) => ({ ...t, [id]: all }));
        setExpanded((set) => new Set([...set, `s:${id}`, ...all.map((t) => turnKey(id, t.turn))]));
        for (const t of all) void loadTurn(id, t.turn);
      }, () => {});
    } else if (row.type === 'turn' && !expanded.has(row.key)) toggle(row.key);
  };

  /** X: close the row and everything below it. */
  const collapseAll = (row: Row) => {
    if (row.type === 'project') {
      const prefixes = Object.values(sessions).filter((s) => s.cwd === row.cwd).flatMap((s) => [`s:${s.id}`, `t:${s.id}:`]);
      setExpanded((set) => new Set([...set].filter((k) => !prefixes.some((p) => k === p || k.startsWith(p)))));
      setCollapsedProjects((set) => new Set([...set, row.key]));
    } else if (row.type === 'session') {
      const id = row.session.id;
      setExpanded((set) => new Set([...set].filter((k) => k !== `s:${id}` && !k.startsWith(`t:${id}:`))));
    } else if (row.type === 'turn') setExpanded((set) => new Set([...set].filter((k) => k !== row.key)));
  };

  const isOpen = (row: Row) => (row.type === 'project' ? !collapsedProjects.has(row.key) : expanded.has(row.key));

  // TreeFilter draws the chips as buttons; clicks are read from the button's position.
  const chipIndex = (target: EventTarget) => {
    const button = (target as HTMLElement).closest('button');
    return button ? [...button.parentElement!.querySelectorAll('button')].indexOf(button) : -1;
  };
  const onFilterClick = (event: MouseEvent<HTMLDivElement>) => {
    const index = chipIndex(event.target);
    if (index >= 0) setOff((set) => flip(set, CHIPS[index].type));
  };
  // f (design system: tree keys): the chips take the keys; ← → move, space or enter toggle, 1–7 too, esc goes back.
  const onFilterKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(filterBox.current?.querySelectorAll('button') ?? [])];
    const at = chipIndex(event.target);
    const digit = Number(event.key);
    if (event.key === 'ArrowRight' || event.key === 'l') buttons[Math.min(buttons.length - 1, at + 1)]?.focus();
    else if (event.key === 'ArrowLeft' || event.key === 'h') buttons[Math.max(0, at - 1)]?.focus();
    else if (digit >= 1 && digit <= CHIPS.length) setOff((set) => flip(set, CHIPS[digit - 1].type));
    else if (event.key === 'Escape' || event.key === 'f' || event.key === 'ArrowDown') rowsBox.current?.focus();
    else return; // space and enter click the button
    event.preventDefault();
    event.stopPropagation();
  };

  const linkNames = link ? [link.source, link.target].map((id) => sessions[id]?.name ?? id.replace(/^endpoint:/, '')) : null;
  return (
    <div className="tree">
      <div ref={filterBox} onClick={onFilterClick} onKeyDown={onFilterKey}>
        <TreeFilter chips={CHIPS.map((c) => ({ type: c.type, count: counts.get(c.type) ?? 0, on: !off.has(c.type) }))} />
      </div>
      {linkNames ? (
        <div className="tree-bar">
          <span className="cn-msg--sent">{glyph('message', 'sent')}{glyph('message', 'received')}</span>
          <span className="cn-ellipsis">
            {linkNames[0]} <span className="cn-dim">and</span> {linkNames[1]}
          </span>
          <span className="cn-dim">{linked ? `${linked.length} message${linked.length === 1 ? '' : 's'}` : glyph('misc', 'ellipsis')}</span>
          <span className="cn-fill" />
          <KeyHints keys={[['esc', 'back']]} />
        </div>
      ) : null}
      {search !== null ? (
        <div className="tree-bar">
          <span className="cn-b">/</span>
          <input
            ref={searchBox}
            className="tree-bar__input"
            value={search}
            spellCheck={false}
            aria-label="search the tree"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                nextMatch(1);
                rowsBox.current?.focus();
              } else if (event.key === 'Escape') {
                setSearch(null);
                rowsBox.current?.focus();
              } else return;
              event.preventDefault();
            }}
          />
          <span className="cn-dim">{query ? matches.length : ''}</span>
          <KeyHints keys={[['n', 'next'], ['esc', 'clear']]} />
        </div>
      ) : null}
      <div className="cn-tree tree__rows" role="tree" tabIndex={0} ref={rowsBox} onKeyDown={onKey} aria-label="message tree">
        <Virtuoso
          ref={list}
          data={rows}
          fixedItemHeight={20}
          computeItemKey={(_, row) => row.key}
          itemContent={(_, row) => (
            <div
              className={row.type === 'entry' && row.entry.kind === 'interrupt' ? 'tree-row--interrupt' : undefined}
              onClick={() => {
                setCursor(row.key);
                if (row.hasChildren) toggle(row.key);
              }}
            >
              <TreeRowFor
                row={row}
                expanded={isOpen(row)}
                cursor={row.key === cursor}
                off={off}
                match={matched.has(row.key) || (row.type === 'entry' && linkIds.has(row.entry.id)) || (row.type === 'turn' && linkIds.has(row.turn.entry.id))}
                outsideLink={!!link && (row.type === 'entry' || row.type === 'turn') && !linkIds.has(row.type === 'entry' ? row.entry.id : row.turn.entry.id)}
                now={now}
                onActivate={() => activate(row)}
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}

function TreeRowFor({ row, expanded, cursor, off, match, outsideLink, now, onActivate }: {
  row: Placed;
  expanded: boolean;
  cursor: boolean;
  off: Set<ChipType>;
  match: boolean;
  /** An edge's messages are open: rows that aren't one of them are kept for context. */
  outsideLink: boolean;
  now: number;
  onActivate: () => void;
}) {
  const common = { depth: row.depth, guides: row.guides, last: row.last, hasChildren: row.hasChildren, expanded, cursor, match, onActivate };
  switch (row.type) {
    case 'project':
      return <TreeRow {...common} kind="project" label={row.name} meta={row.count} />;
    case 'session': {
      const s = row.session;
      return (
        <TreeRow {...common} kind="session" label={`${row.n} ${s.name}`} status={s.status} sessionKind={s.kind}
          meta={ago(s.lastActivityAt, now)} attention={s.status === 'waiting'} />
      );
    }
    case 'turn': {
      const { entry, abandoned } = row.turn;
      // A turn a rewind left behind stays in time order, kept for context and marked (roadmap 2.10).
      return (
        <TreeRow {...common} kind={msgType(entry.kind)} turn={row.turn.turn} label={slashless(entry)}
          meta={abandoned ? 'rewound' : ago(Date.parse(entry.at ?? ''), now)}
          attention={row.turn.attention && !abandoned}
          dimmed={abandoned || outsideLink || off.has(CHIP_OF.get(entry.kind) ?? 'reply')} />
      );
    }
    case 'entry': {
      const entry = row.entry;
      return (
        <TreeRow {...common} kind={msgType(entry.kind)} label={label(row)} meta={ago(Date.parse(entry.at ?? ''), now)}
          attention={entry.kind === 'question' && entry.resultPreview == null && !entry.abandoned}
          dimmed={entry.abandoned || outsideLink || off.has(CHIP_OF.get(entry.kind) ?? 'reply')} />
      );
    }
    default:
      return <TreeRow {...common} kind="reply" label={<span className="cn-dim">loading{glyph('misc', 'ellipsis')}</span>} />;
  }
}

/** Adds the tree guides: for each ancestor, whether a later sibling follows (draw │), and whether this row is last. */
export function place(rows: Row[], hasChildren: (row: Row) => boolean): Placed[] {
  const placed: Placed[] = [];
  const nextSiblingAt = (i: number) => {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].depth < rows[i].depth) return false;
      if (rows[j].depth === rows[i].depth) return true;
    }
    return false;
  };
  const open: boolean[] = [];
  rows.forEach((row, i) => {
    const last = !nextSiblingAt(i);
    open[row.depth] = !last;
    placed.push({ ...row, guides: open.slice(1, row.depth), last, hasChildren: hasChildren(row) });
  });
  return placed;
}

function flip<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
