import { TreeFilter, TreeRow, glyph } from '@ds';
import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { api } from './api';
import { ago, msgType } from './format';
import type { Entry, Session, Turn } from './protocol';
import { numbered, store, useStore } from './store';

/** Filter chips (keys 1–7) and the entry kinds each one covers. Thinking never shows in the tree. */
const CHIPS = [
  { type: 'prompt', kinds: ['prompt', 'interrupt'] },
  { type: 'slash', kinds: ['slash', 'compact'] },
  { type: 'tool', kinds: ['tool', 'denied'] },
  { type: 'question', kinds: ['question', 'answer'] },
  { type: 'peer', kinds: ['sent', 'received'] },
  { type: 'subagent', kinds: ['subagent_started', 'subagent_reported'] },
  { type: 'reply', kinds: ['reply', 'notice'] },
] as const;
type ChipType = (typeof CHIPS)[number]['type'];
const CHIP_OF = new Map<string, ChipType>(CHIPS.flatMap((c) => c.kinds.map((k) => [k, c.type] as const)));

type Row =
  | { key: string; depth: 0; type: 'project'; cwd: string; name: string; count: number }
  | { key: string; depth: 1; type: 'session'; session: Session; n: number }
  | { key: string; depth: 2; type: 'turn'; session: string; turn: Turn }
  | { key: string; depth: 3; type: 'entry'; session: string; entry: Entry }
  | { key: string; depth: 2 | 3; type: 'loading' };
type Placed = Row & { guides: boolean[]; last: boolean; hasChildren: boolean };

const turnKey = (session: string, turn: number) => `t:${session}:${turn}`;

export function MessageTree() {
  const sessions = useStore((s) => s.sessions);
  const now = useStore((s) => s.now);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => new Set());
  const [turns, setTurns] = useState<Record<string, Turn[]>>({});
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [off, setOff] = useState<Set<ChipType>>(() => new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useRef<VirtuosoHandle>(null);

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

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = rows[cursorIndex];
    const digit = Number(event.key);
    if (digit >= 1 && digit <= CHIPS.length) setOff((set) => flip(set, CHIPS[digit - 1].type));
    else if (event.key === 'ArrowDown' || event.key === 'j') moveTo(cursorIndex + 1);
    else if (event.key === 'ArrowUp' || event.key === 'k') moveTo(cursorIndex - 1);
    else if (!row) return;
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
      void api.turns(id).then((list) => {
        setTurns((all) => ({ ...all, [id]: list }));
        setExpanded((set) => new Set([...set, `s:${id}`, ...list.map((t) => turnKey(id, t.turn))]));
        for (const t of list) void loadTurn(id, t.turn);
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

  // TreeFilter draws the chips; clicks are read from the button's position.
  const onFilterClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button');
    const index = button ? [...button.parentElement!.querySelectorAll('button')].indexOf(button) : -1;
    if (index >= 0) setOff((set) => flip(set, CHIPS[index].type));
  };

  return (
    <div className="tree">
      <div onClick={onFilterClick}>
        <TreeFilter chips={CHIPS.map((c) => ({ type: c.type, count: counts.get(c.type) ?? 0, on: !off.has(c.type) }))} />
      </div>
      <div className="cn-tree tree__rows" role="tree" tabIndex={0} onKeyDown={onKey} aria-label="message tree">
        <Virtuoso
          ref={list}
          data={rows}
          fixedItemHeight={20}
          computeItemKey={(_, row) => row.key}
          itemContent={(_, row) => (
            <div
              onClick={() => {
                setCursor(row.key);
                if (row.hasChildren) toggle(row.key);
              }}
            >
              <TreeRowFor row={row} expanded={isOpen(row)} cursor={row.key === cursor} off={off} now={now} onActivate={() => activate(row)} />
            </div>
          )}
        />
      </div>
    </div>
  );
}

function TreeRowFor({ row, expanded, cursor, off, now, onActivate }: { row: Placed; expanded: boolean; cursor: boolean; off: Set<ChipType>; now: number; onActivate: () => void }) {
  const common = { depth: row.depth, guides: row.guides, last: row.last, hasChildren: row.hasChildren, expanded, cursor, onActivate };
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
      const entry = row.turn.entry;
      return (
        <TreeRow {...common} kind={msgType(entry.kind)} turn={row.turn.turn} label={entry.text} meta={ago(Date.parse(entry.at ?? ''), now)}
          attention={row.turn.attention} dimmed={off.has(CHIP_OF.get(entry.kind) ?? 'reply')} />
      );
    }
    case 'entry': {
      const entry = row.entry;
      const label = entry.kind === 'tool' ? `${entry.tool ?? ''} ${entry.detail ?? ''}` : entry.text;
      return (
        <TreeRow {...common} kind={msgType(entry.kind)} label={label} meta={ago(Date.parse(entry.at ?? ''), now)}
          attention={entry.kind === 'question' && entry.resultPreview == null}
          dimmed={off.has(CHIP_OF.get(entry.kind) ?? 'reply')} />
      );
    }
    default:
      return <TreeRow {...common} kind="reply" label={<span className="cn-dim">loading{glyph('misc', 'ellipsis')}</span>} />;
  }
}

/** Adds the tree guides: for each ancestor, whether a later sibling follows (draw │), and whether this row is last. */
function place(rows: Row[], hasChildren: (row: Row) => boolean): Placed[] {
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
