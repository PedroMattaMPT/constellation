import {
  type Edge as FlowEdge,
  type EdgeProps,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { KindMark, MessageEdge, ProjectGroup, SessionNode, glyph } from '@ds';
import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, reason } from './api';
import type { Edge, Session, Subagent } from './protocol';
import {
  type EndpointData,
  EndpointStar,
  FigureEdge,
  type FigureEdgeType,
  MiniStar,
  type NodeData,
  STAR,
  STAR_NODE,
  StarField,
  StarNode,
  endpointRadius,
  sessionNodeProps,
  starRadius,
  trim,
} from './Star';
import { numbered, store, useStore } from './store';

// Cells: 1ch of JetBrains Mono at 13px is 7.8px; a row is 20px.
const NODE_W = 312; // the card's 40ch
const COMPACT_H = 22; // a compact card: one row
const GROUP_PAD = { top: 28, side: 16, bottom: 12 };
const GAP = 16;
const COMPACT_GAP = 8;
const GROUP_GAP = 48;
const GROUPS_PER_ROW = 4;
const ENDPOINT_W = 200;
// Stars: a project's stars zigzag down a column, joined by faint lines; columns drift so rows don't line up.
const STAR_STEP = 88;
const COMPACT_STAR_STEP = 48;
const STAR_JITTER = [0, 56, 20, 72, 36, 64, 8];
const STAR_PAD = { top: 40, side: 24, bottom: 20 };
const STAR_GROUP_W = 72 + STAR_NODE.w + 2 * STAR_PAD.side;
const COLUMN_DRIFT = [0, 48, 16, 64];
const FIT = { padding: 0.08, duration: 200 };
const VIEW_KEY = 'constellation.map';
const COMPACT_KEY = 'constellation.compact';
const LIVE_MS = 1700; // MessageEdge's dash runs twice (2 × 0.8 s), then the line is solid again
// The minimap sets fill inline, so it takes token values, not classes.
const MINIMAP_COLOR: Record<Session['status'], string> = {
  working: 'var(--status-working)',
  waiting: 'var(--status-waiting-fill)',
  error: 'var(--status-error)',
  idle: 'var(--fg-faint)',
  stale: 'var(--status-stale)',
  stopped: 'var(--fg-faint)',
};
const STATUS_ORDER: Record<Session['status'], number> = { waiting: 0, working: 1, error: 2, idle: 3, stale: 4, stopped: 5 };

type View = 'stars' | 'cards';
type ProjectData = { name: string; count: number; waiting: number; width: number; height: number };
type MapNode =
  | Node<NodeData, 'session'>
  | Node<NodeData, 'star'>
  | Node<ProjectData, 'project'>
  | Node<EndpointData, 'endpoint'>
  | Node<EndpointData, 'endpointStar'>;
type MessageEdgeType = FlowEdge<{ count: number; live: boolean; rs?: number; rt?: number }, 'message'>;
type MapEdge = MessageEdgeType | FigureEdgeType;
type Group = Array<{ n: number; session: Session }>;

function load(key: string, on: string): boolean {
  try {
    return localStorage.getItem(key) === on;
  } catch {
    return false;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered, still works
  }
}

const SIDES = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
] as const;

/** Edges pick a side per pair (see `handles`), so every card has a source and a target on each side. */
function Handles() {
  return (
    <>
      {SIDES.map(([side, position]) => (
        <span key={side}>
          <Handle id={`s-${side}`} type="source" position={position} className="map-handle" isConnectable={false} />
          <Handle id={`t-${side}`} type="target" position={position} className="map-handle" isConnectable={false} />
        </span>
      ))}
    </>
  );
}

function nodeHeight(data: NodeData): number {
  if (data.compact) return COMPACT_H;
  const rows = 4 + (data.session.context?.percent != null ? 1 : 0) + (data.summary ? 1 : 0);
  return 11 + rows * 20 + data.subagents.length * 20;
}

function SessionNodeView({ data }: NodeProps<Node<NodeData, 'session'>>) {
  return (
    <>
      <Handles />
      <SessionNode {...sessionNodeProps(data)} />
    </>
  );
}

function ProjectView({ data }: NodeProps<Node<ProjectData, 'project'>>) {
  return (
    <ProjectGroup
      name={data.name}
      count={data.count}
      waiting={data.waiting}
      style={{ width: data.width, height: data.height }}
    />
  );
}

function EndpointView({ data }: NodeProps<Node<EndpointData, 'endpoint'>>) {
  return (
    <>
      <Handles />
      <div className="map-endpoint" title="not a running session: it exited, or isn't Claude Code">
        <KindMark kind="external" /> {data.name} <span className="cn-dim">not running</span>
      </div>
    </>
  );
}

function MessageEdgeView({ id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps<MessageEdgeType>) {
  // Between stars the line stops at each star's edge, so the arrowhead stays visible.
  const p = trim(sourceX, sourceY, targetX, targetY, data?.rs ?? 0, data?.rt ?? 0);
  return (
    <MessageEdge
      id={id}
      sourceX={p.sx}
      sourceY={p.sy}
      targetX={p.tx}
      targetY={p.ty}
      count={data?.count ?? 1}
      selected={selected}
      live={data?.live}
    />
  );
}

const nodeTypes = { session: SessionNodeView, star: StarNode, project: ProjectView, endpoint: EndpointView, endpointStar: EndpointStar };
const edgeTypes = { message: MessageEdgeView, figure: FigureEdge };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Side by side: leave right, enter left (or the reverse). Stacked in one column: top and bottom. */
function handles(a: Box, b: Box): { sourceHandle: string; targetHandle: string } {
  const sameColumn = Math.abs(a.x - b.x) < a.w / 2;
  if (sameColumn) return b.y > a.y ? { sourceHandle: 's-bottom', targetHandle: 't-top' } : { sourceHandle: 's-top', targetHandle: 't-bottom' };
  return b.x > a.x ? { sourceHandle: 's-right', targetHandle: 't-left' } : { sourceHandle: 's-left', targetHandle: 't-right' };
}

interface Layout {
  nodes: MapNode[];
  figures: FigureEdgeType[];
  boxes: Map<string, Box>;
  /** Star radius per node, so lines stop at the star's edge. */
  radius: Map<string, number>;
  /** Where the column of peers that aren't sessions starts. */
  right: number;
}

type Place = (groups: Group[], data: (n: number, session: Session) => NodeData, compact: boolean) => Layout;

const projectNode = (id: string, group: Group, x: number, y: number, width: number, height: number): MapNode => ({
  id,
  type: 'project',
  position: { x, y },
  data: {
    name: group[0].session.project,
    count: group.length,
    waiting: group.filter((g) => g.session.status === 'waiting').length,
    width,
    height,
  },
  style: { width, height },
  draggable: false,
  selectable: false,
});

/** Design-system cards: project frames in rows, waiting sessions first. */
const placeCards: Place = (groups, data, compact) => {
  const ordered = [...groups].sort((a, b) => {
    const waiting = (g: Group) => g.filter((x) => x.session.status === 'waiting').length;
    return waiting(b) - waiting(a) || b.length - a.length || a[0].session.project.localeCompare(b[0].session.project);
  });
  const nodes: MapNode[] = [];
  const boxes = new Map<string, Box>();
  const gap = compact ? COMPACT_GAP : GAP;
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  ordered.forEach((group, i) => {
    if (i > 0 && i % GROUPS_PER_ROW === 0) {
      x = 0;
      y += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }
    const sorted = [...group].sort((a, b) => STATUS_ORDER[a.session.status] - STATUS_ORDER[b.session.status] || a.n - b.n);
    const groupId = `project:${group[0].session.cwd}`;
    let inner = GROUP_PAD.top;
    const children: MapNode[] = sorted.map(({ n, session }) => {
      const d = data(n, session);
      const h = nodeHeight(d);
      boxes.set(session.id, { x: x + GROUP_PAD.side, y: y + inner, w: NODE_W, h });
      const node: MapNode = {
        id: session.id,
        type: 'session',
        parentId: groupId,
        position: { x: GROUP_PAD.side, y: inner },
        data: d,
        draggable: false,
        initialWidth: NODE_W,
        initialHeight: h,
      };
      inner += h + gap;
      return node;
    });
    const width = NODE_W + 2 * GROUP_PAD.side;
    const height = inner - gap + GROUP_PAD.bottom;
    nodes.push(projectNode(groupId, group, x, y, width, height), ...children);
    x += width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, height);
  });
  return { nodes, figures: [], boxes, radius: new Map(), right: x };
};

/**
 * Stars: each project is a constellation, its stars in session order so they never jump when a status changes;
 * color carries who needs you. Projects keep their place too: largest first, then by name.
 */
const placeStars: Place = (groups, data, compact) => {
  const ordered = [...groups].sort((a, b) => b.length - a.length || a[0].session.project.localeCompare(b[0].session.project));
  const nodes: MapNode[] = [];
  const figures: FigureEdgeType[] = [];
  const boxes = new Map<string, Box>();
  const radius = new Map<string, number>();
  const stepY = compact ? COMPACT_STAR_STEP : STAR_STEP;
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  ordered.forEach((group, i) => {
    const column = i % GROUPS_PER_ROW;
    if (i > 0 && column === 0) {
      x = 0;
      y += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }
    const top = y + COLUMN_DRIFT[column];
    const groupId = `project:${group[0].session.cwd}`;
    const children: MapNode[] = group.map(({ n, session }, k) => {
      const position = { x: STAR_PAD.side + STAR_JITTER[k % STAR_JITTER.length], y: STAR_PAD.top + k * stepY };
      boxes.set(session.id, { x: x + position.x, y: top + position.y, w: STAR_NODE.w, h: STAR_NODE.h });
      radius.set(session.id, starRadius(session) + 6);
      return {
        id: session.id,
        type: 'star',
        parentId: groupId,
        position,
        data: data(n, session),
        draggable: false,
        initialWidth: STAR_NODE.w,
        initialHeight: STAR_NODE.h,
      };
    });
    for (let k = 1; k < group.length; k++) {
      const [a, b] = [group[k - 1].session.id, group[k].session.id];
      figures.push({
        id: `figure:${a}:${b}`,
        source: a,
        target: b,
        type: 'figure',
        sourceHandle: 's',
        targetHandle: 't',
        selectable: false,
        focusable: false,
        data: { rs: radius.get(a)!, rt: radius.get(b)! },
      });
    }
    const height = STAR_PAD.top + (group.length - 1) * stepY + STAR_NODE.h + STAR_PAD.bottom;
    nodes.push(projectNode(groupId, group, x, top, STAR_GROUP_W, height), ...children);
    x += STAR_GROUP_W + GROUP_GAP;
    rowHeight = Math.max(rowHeight, COLUMN_DRIFT[column] + height);
  });
  return { nodes, figures, boxes, radius, right: x };
};

/** Edges whose count just went up run their dashes (design system: a message in flight). */
function useLive(edges: Edge[]): Set<string> {
  const counts = useRef<Map<string, number> | null>(null);
  const [live, setLive] = useState<Map<string, number>>(() => new Map());
  useEffect(() => {
    const before = counts.current;
    counts.current = new Map(edges.map((e) => [e.id, e.count]));
    if (!before) return; // the first graph is history, not news
    const until = Date.now() + LIVE_MS;
    const fresh = edges.filter((e) => e.count > (before.get(e.id) ?? 0));
    if (fresh.length) setLive((current) => new Map([...current, ...fresh.map((e) => [e.id, until] as const)]));
  }, [edges]);
  // Each edge goes solid again when its time is up, whatever else changes meanwhile.
  useEffect(() => {
    if (!live.size) return;
    const next = Math.min(...live.values());
    const timer = window.setTimeout(
      () => setLive((current) => new Map([...current].filter(([, until]) => until > Date.now()))),
      Math.max(0, next - Date.now()) + 20,
    );
    return () => window.clearTimeout(timer);
  }, [live]);
  return useMemo(() => new Set(live.keys()), [live]);
}

interface Graph {
  nodes: MapNode[];
  edges: MapEdge[];
  boxes: Map<string, Box>;
}

interface Marks {
  cursor: string | null;
  edge: string | null;
  summarizing: Set<string>;
}

function useGraph(view: View, compact: boolean, marks: Marks): Graph {
  const sessions = useStore((s) => s.sessions);
  const edges = useStore((s) => s.edges);
  const endpoints = useStore((s) => s.endpoints);
  const subagents = useStore((s) => s.subagents);
  const selected = useStore((s) => s.selected);
  const now = useStore((s) => s.now);
  const live = useLive(edges);

  return useMemo(() => {
    const byParent = new Map<string, Subagent[]>();
    for (const a of subagents) byParent.set(a.parent, [...(byParent.get(a.parent) ?? []), a]);
    // Working subagents, then the latest few that reported back.
    const shown = (id: string) => {
      const all = byParent.get(id) ?? [];
      return [...all.filter((a) => a.status === 'working'), ...all.filter((a) => a.status !== 'working').slice(-2)].slice(0, 4);
    };
    const data = (n: number, session: Session): NodeData => ({
      session,
      n,
      subagents: compact ? [] : shown(session.id),
      focused: session.id === marks.cursor,
      selected: selected.includes(session.id),
      compact,
      summary: marks.summarizing.has(session.id) ? `summarizing${glyph('misc', 'ellipsis')}` : (session.summary ?? null),
      now,
    });

    const groups = new Map<string, Group>();
    for (const item of numbered(sessions)) groups.set(item.session.cwd, [...(groups.get(item.session.cwd) ?? []), item]);
    const stars = view === 'stars';
    const { nodes, figures, boxes, radius, right } = (stars ? placeStars : placeCards)([...groups.values()], data, compact);

    // Peers that aren't running sessions sit in their own column, to the right.
    const used = new Set(edges.flatMap((e) => [e.source, e.target]));
    endpoints
      .filter((e) => used.has(e.id))
      .forEach((endpoint, i) => {
        const box = stars ? { x: right, y: STAR_PAD.top + i * 56, w: ENDPOINT_W, h: 20 } : { x: right, y: i * 48, w: ENDPOINT_W, h: 28 };
        boxes.set(endpoint.id, box);
        radius.set(endpoint.id, endpointRadius() + 6);
        nodes.push({
          id: endpoint.id,
          type: stars ? 'endpointStar' : 'endpoint',
          position: { x: box.x, y: box.y },
          data: { name: endpoint.name },
          draggable: false,
          initialWidth: box.w,
          initialHeight: box.h,
        });
      });

    const messages: MessageEdgeType[] = edges
      .filter((e) => boxes.has(e.source) && boxes.has(e.target) && e.source !== e.target)
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'message',
        selected: e.id === marks.edge,
        ...(stars
          ? { sourceHandle: 's', targetHandle: 't', data: { count: e.count, live: live.has(e.id), rs: radius.get(e.source), rt: radius.get(e.target) } }
          : { ...handles(boxes.get(e.source)!, boxes.get(e.target)!), data: { count: e.count, live: live.has(e.id) } }),
      }));
    return { nodes, edges: [...figures, ...messages], boxes };
  }, [sessions, edges, endpoints, subagents, selected, now, view, compact, marks.cursor, marks.edge, marks.summarizing, live]);
}

const DIRECTION: Record<string, [number, number]> = {
  h: [-1, 0],
  ArrowLeft: [-1, 0],
  l: [1, 0],
  ArrowRight: [1, 0],
  k: [0, -1],
  ArrowUp: [0, -1],
  j: [0, 1],
  ArrowDown: [0, 1],
};

/** The nearest box from `from` in a direction: mostly along it, a little across it. */
function nearest(boxes: Map<string, Box>, ids: string[], from: string, [dx, dy]: [number, number], stars: boolean): string | null {
  const a = boxes.get(from);
  if (!a) return null;
  const center = (b: Box) => ({ x: b.x + (stars ? STAR.x : b.w / 2), y: b.y + (stars ? STAR.y : b.h / 2) });
  const origin = center(a);
  let best: string | null = null;
  let score = Infinity;
  for (const id of ids) {
    const b = boxes.get(id);
    if (!b || id === from) continue;
    const c = center(b);
    const along = (c.x - origin.x) * dx + (c.y - origin.y) * dy;
    const across = Math.abs((c.x - origin.x) * dy) + Math.abs((c.y - origin.y) * dx);
    if (along <= 4) continue;
    const s = along + 2 * across;
    if (s < score) {
      score = s;
      best = id;
    }
  }
  return best;
}

/** Map controls, shown as key hints that also take a click. While the map has the keys, its own keys show too. */
function MapKeys({ view, compact, active, note, onFit, onView, onCompact }: {
  view: View;
  compact: boolean;
  active: boolean;
  note: string | null;
  onFit: () => void;
  onView: () => void;
  onCompact: () => void;
}) {
  return (
    <Panel position="top-right" className="map-keys">
      {note ? <span className="map-keys__note cn-ellipsis">{note}</span> : null}
      {active ? (
        <span className="map-keys__keys">
          <span className="cn-keys__key">hjkl</span> <span className="cn-keys__label">move</span>
          <span className="cn-keys__key">enter</span> <span className="cn-keys__label">open</span>
          <span className="cn-keys__key">space</span> <span className="cn-keys__label">select</span>
          <span className="cn-keys__key">e</span> <span className="cn-keys__label">links</span>
          <span className="cn-keys__key">s</span> <span className="cn-keys__label">summary</span>
        </span>
      ) : null}
      <button type="button" onClick={() => store.set({ dialog: { kind: 'launcher' } })} title="start a managed session">
        <span className="cn-keys__key">C-Space c</span> <span className="cn-keys__label">new</span>
      </button>
      <button type="button" onClick={onFit}>
        <span className="cn-keys__key">f</span> <span className="cn-keys__label">fit</span>
      </button>
      <button type="button" onClick={onCompact}>
        <span className="cn-keys__key">c</span> <span className="cn-keys__label">{compact ? 'full' : 'compact'}</span>
      </button>
      <button type="button" onClick={onView}>
        <span className="cn-keys__key">v</span> <span className="cn-keys__label">{view === 'stars' ? 'cards' : 'stars'}</span>
      </button>
    </Panel>
  );
}

function Flow() {
  const [view, setView] = useState<View>(() => (load(VIEW_KEY, 'cards') ? 'cards' : 'stars'));
  const [compact, setCompact] = useState(() => load(COMPACT_KEY, 'on'));
  const focused = useStore((s) => s.focused);
  const sessions = useStore((s) => s.sessions);
  const mapFocus = useStore((s) => s.mapFocus);
  const hidden = useStore((s) => s.hidden);
  const [cursor, setCursor] = useState<string | null>(focused);
  const [edge, setEdge] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const scope = useRef<HTMLDivElement>(null);
  const marks = useMemo(() => ({ cursor, edge, summarizing }), [cursor, edge, summarizing]);
  const { nodes, edges, boxes } = useGraph(view, compact, marks);
  const flow = useReactFlow();
  const sessionCount = nodes.filter((n) => n.type === 'session' || n.type === 'star').length;

  // The cursor follows the session you open from anywhere else (the tree, the status bar, C-Space a).
  useEffect(() => setCursor(focused), [focused]);
  useEffect(() => {
    if (cursor && !sessions[cursor]) setCursor(focused);
  }, [sessions]);
  useEffect(() => {
    if (mapFocus) scope.current?.focus();
  }, [mapFocus]);
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 6000);
    return () => window.clearTimeout(timer);
  }, [note]);

  const toggleView = () =>
    setView((current) => {
      const next = current === 'stars' ? 'cards' : 'stars';
      save(VIEW_KEY, next);
      return next;
    });
  const toggleCompact = () =>
    setCompact((current) => {
      save(COMPACT_KEY, current ? 'off' : 'on');
      return !current;
    });

  // Fit again when sessions come or go, the view changes, or the map grows because the tree or pane was hidden
  // (the first fit is the fitView prop, after nodes are measured).
  useEffect(() => {
    if (!sessionCount) return;
    const timer = window.setTimeout(() => void flow.fitView(FIT), 50);
    return () => window.clearTimeout(timer);
  }, [sessionCount, flow, view, compact, hidden]);

  // Before anything has focus, the map's view keys work from anywhere (as they did before the map took focus).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || document.activeElement !== document.body) return;
      if (event.key === 'f') void flow.fitView(FIT);
      else if (event.key === 'v') toggleView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flow]);

  /** Keeps the cursor in sight: pans to it, at the same zoom, when it's off screen. */
  const reveal = (id: string) => {
    const box = boxes.get(id);
    const area = scope.current?.getBoundingClientRect();
    if (!box || !area) return;
    const center = view === 'stars' ? { x: box.x + STAR.x, y: box.y + STAR.y } : { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const at = flow.flowToScreenPosition(center);
    const margin = 40;
    if (at.x < area.left + margin || at.x > area.right - margin || at.y < area.top + margin || at.y > area.bottom - margin) {
      void flow.setCenter(center.x, center.y, { zoom: flow.getZoom(), duration: 120 });
    }
  };

  const linksOf = (id: string | null) => edges.filter((e): e is MessageEdgeType => e.type === 'message' && !!id && (e.source === id || e.target === id));

  const summarize = (id: string) => {
    if (summarizing.has(id)) return;
    setSummarizing((all) => new Set(all).add(id));
    api
      .summary(id)
      .catch((failure: unknown) => setNote(`${glyph('status', 'error')} ${reason(failure)}`))
      .finally(() =>
        setSummarizing((all) => {
          const next = new Set(all);
          next.delete(id);
          return next;
        }),
      );
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea')) return;
    const ids = nodes.filter((n) => n.type === 'session' || n.type === 'star').map((n) => n.id);
    const here = cursor && ids.includes(cursor) ? cursor : (ids[0] ?? null);
    const managed = here ? sessions[here]?.kind === 'managed' : false;
    const direction = DIRECTION[event.key];
    if (direction) {
      const next = here && cursor ? nearest(boxes, ids, here, direction, view === 'stars') : here;
      if (next) {
        setCursor(next);
        setEdge(null);
        reveal(next);
      }
    } else if (event.key === 'Enter') {
      const link = edges.find((e) => e.id === edge);
      if (link) store.openLink(link.source, link.target);
      else if (here) store.focus(here);
    } else if (event.key === ' ' && here) store.select(here);
    else if (event.key === 'e') {
      const links = linksOf(here);
      const at = links.findIndex((e) => e.id === edge);
      setEdge(links.length && at < links.length - 1 ? links[at + 1].id : null);
    } else if (event.key === 's' && here) summarize(here);
    else if (event.key === ',' && here && managed) {
      store.focus(here);
      store.set({ renaming: here });
    } else if (event.key === '&' && here && managed) store.set({ dialog: { kind: 'stop', session: here } });
    else if (event.key === 'Escape' && edge) setEdge(null);
    else if (event.key === 'f') void flow.fitView(FIT);
    else if (event.key === '+' || event.key === '=') void flow.zoomIn({ duration: 120 });
    else if (event.key === '-') void flow.zoomOut({ duration: 120 });
    else if (event.key === 'v') toggleView();
    else if (event.key === 'c') toggleCompact();
    else return;
    event.preventDefault();
  };

  // A click on the canvas gives the map the keys (nodes and edges handle their own clicks).
  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as Element).closest('button, a, input, textarea, .react-flow__minimap')) scope.current?.focus({ preventScroll: true });
  };

  const stars = view === 'stars';
  return (
    <div
      className={`map-scope${active ? ' map-scope--active' : ''}`}
      ref={scope}
      tabIndex={0}
      aria-label="session map: h j k l move, enter opens, space selects, e cycles links, s asks for a summary"
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onFocus={() => setActive(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setActive(false)}
    >
      <ReactFlow
        className={`map--${view}${compact ? ' map--compact' : ''}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => {
          if (node.type !== 'session' && node.type !== 'star') return;
          setCursor(node.id);
          setEdge(null);
          store.focus(node.id);
        }}
        onEdgeClick={(_, clicked) => {
          if (clicked.type !== 'message') return;
          setEdge(clicked.id);
          store.openLink(clicked.source, clicked.target);
        }}
        onPaneClick={() => setEdge(null)}
        fitView
        fitViewOptions={FIT}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        minZoom={0.2}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <StarField />
        <MapKeys view={view} compact={compact} active={active} note={note} onFit={() => void flow.fitView(FIT)} onView={toggleView} onCompact={toggleCompact} />
        <MiniMap
          style={{ width: 180, height: 120 }}
          pannable
          zoomable
          nodeComponent={stars ? MiniStar : undefined}
          nodeColor={(node) =>
            node.type === 'session' || node.type === 'star'
              ? MINIMAP_COLOR[(node.data as NodeData).session.status]
              : node.type === 'endpoint' || node.type === 'endpointStar'
                ? 'var(--kind-external)'
                : 'transparent'
          }
        />
      </ReactFlow>
    </div>
  );
}

export function SessionMap() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
