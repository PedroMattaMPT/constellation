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
import { KindMark, MessageEdge, ProjectGroup, SessionNode } from '@ds';
import { useEffect, useMemo, useState } from 'react';
import type { Session, Subagent } from './protocol';
import {
  type EndpointData,
  EndpointStar,
  FigureEdge,
  type FigureEdgeType,
  MiniStar,
  type NodeData,
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
const GROUP_PAD = { top: 28, side: 16, bottom: 12 };
const GAP = 16;
const GROUP_GAP = 48;
const GROUPS_PER_ROW = 4;
const ENDPOINT_W = 200;
// Stars: a project's stars zigzag down a column, joined by faint lines; columns drift so rows don't line up.
const STAR_STEP = 88;
const STAR_JITTER = [0, 56, 20, 72, 36, 64, 8];
const STAR_PAD = { top: 40, side: 24, bottom: 20 };
const STAR_GROUP_W = 72 + STAR_NODE.w + 2 * STAR_PAD.side;
const COLUMN_DRIFT = [0, 48, 16, 64];
const FIT = { padding: 0.08, duration: 200 };
const VIEW_KEY = 'constellation.map';
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
type MessageEdgeType = FlowEdge<{ count: number; rs?: number; rt?: number }, 'message'>;
type MapEdge = MessageEdgeType | FigureEdgeType;
type Group = Array<{ n: number; session: Session }>;

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'stars';
  } catch {
    return 'stars';
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

function nodeHeight(session: Session, subagents: number): number {
  const rows = 4 + (session.context?.percent != null ? 1 : 0);
  return 11 + rows * 20 + subagents * 20;
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

type Place = (groups: Group[], subagents: (id: string) => Subagent[], focused: string | null, now: number) => Layout;

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
const placeCards: Place = (groups, subagents, focused, now) => {
  const ordered = [...groups].sort((a, b) => {
    const waiting = (g: Group) => g.filter((x) => x.session.status === 'waiting').length;
    return waiting(b) - waiting(a) || b.length - a.length || a[0].session.project.localeCompare(b[0].session.project);
  });
  const nodes: MapNode[] = [];
  const boxes = new Map<string, Box>();
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
      const subs = subagents(session.id);
      const h = nodeHeight(session, subs.length);
      boxes.set(session.id, { x: x + GROUP_PAD.side, y: y + inner, w: NODE_W, h });
      const node: MapNode = {
        id: session.id,
        type: 'session',
        parentId: groupId,
        position: { x: GROUP_PAD.side, y: inner },
        data: { session, n, subagents: subs, focused: session.id === focused, now },
        draggable: false,
        initialWidth: NODE_W,
        initialHeight: h,
      };
      inner += h + GAP;
      return node;
    });
    const width = NODE_W + 2 * GROUP_PAD.side;
    const height = inner - GAP + GROUP_PAD.bottom;
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
const placeStars: Place = (groups, subagents, focused, now) => {
  const ordered = [...groups].sort((a, b) => b.length - a.length || a[0].session.project.localeCompare(b[0].session.project));
  const nodes: MapNode[] = [];
  const figures: FigureEdgeType[] = [];
  const boxes = new Map<string, Box>();
  const radius = new Map<string, number>();
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
      const position = { x: STAR_PAD.side + STAR_JITTER[k % STAR_JITTER.length], y: STAR_PAD.top + k * STAR_STEP };
      boxes.set(session.id, { x: x + position.x, y: top + position.y, w: STAR_NODE.w, h: STAR_NODE.h });
      radius.set(session.id, starRadius(session) + 6);
      return {
        id: session.id,
        type: 'star',
        parentId: groupId,
        position,
        data: { session, n, subagents: subagents(session.id), focused: session.id === focused, now },
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
    const height = STAR_PAD.top + (group.length - 1) * STAR_STEP + STAR_NODE.h + STAR_PAD.bottom;
    nodes.push(projectNode(groupId, group, x, top, STAR_GROUP_W, height), ...children);
    x += STAR_GROUP_W + GROUP_GAP;
    rowHeight = Math.max(rowHeight, COLUMN_DRIFT[column] + height);
  });
  return { nodes, figures, boxes, radius, right: x };
};

function useGraph(view: View): { nodes: MapNode[]; edges: MapEdge[] } {
  const sessions = useStore((s) => s.sessions);
  const edges = useStore((s) => s.edges);
  const endpoints = useStore((s) => s.endpoints);
  const subagents = useStore((s) => s.subagents);
  const focused = useStore((s) => s.focused);
  const now = useStore((s) => s.now);

  return useMemo(() => {
    const byParent = new Map<string, Subagent[]>();
    for (const a of subagents) byParent.set(a.parent, [...(byParent.get(a.parent) ?? []), a]);
    // Working subagents, then the latest few that reported back.
    const shown = (id: string) => {
      const all = byParent.get(id) ?? [];
      return [...all.filter((a) => a.status === 'working'), ...all.filter((a) => a.status !== 'working').slice(-2)].slice(0, 4);
    };

    const groups = new Map<string, Group>();
    for (const item of numbered(sessions)) groups.set(item.session.cwd, [...(groups.get(item.session.cwd) ?? []), item]);
    const stars = view === 'stars';
    const { nodes, figures, boxes, radius, right } = (stars ? placeStars : placeCards)([...groups.values()], shown, focused, now);

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
        ...(stars
          ? { sourceHandle: 's', targetHandle: 't', data: { count: e.count, rs: radius.get(e.source), rt: radius.get(e.target) } }
          : { ...handles(boxes.get(e.source)!, boxes.get(e.target)!), data: { count: e.count } }),
      }));
    return { nodes, edges: [...figures, ...messages] };
  }, [sessions, edges, endpoints, subagents, focused, now, view]);
}

/** Map controls, shown as key hints that also take a click. */
function MapKeys({ view, onFit, onView }: { view: View; onFit: () => void; onView: () => void }) {
  return (
    <Panel position="top-right" className="map-keys">
      <button type="button" onClick={() => store.set({ dialog: { kind: 'launcher' } })} title="start a managed session">
        <span className="cn-keys__key">C-Space c</span> <span className="cn-keys__label">new</span>
      </button>
      <button type="button" onClick={onFit}>
        <span className="cn-keys__key">f</span> <span className="cn-keys__label">fit</span>
      </button>
      <button type="button" onClick={onView}>
        <span className="cn-keys__key">v</span> <span className="cn-keys__label">{view === 'stars' ? 'cards' : 'stars'}</span>
      </button>
    </Panel>
  );
}

function Flow() {
  const [view, setView] = useState(loadView);
  const { nodes, edges } = useGraph(view);
  const flow = useReactFlow();
  const hidden = useStore((s) => s.hidden);
  const sessionCount = nodes.filter((n) => n.type === 'session' || n.type === 'star').length;

  const toggleView = () =>
    setView((current) => {
      const next = current === 'stars' ? 'cards' : 'stars';
      try {
        localStorage.setItem(VIEW_KEY, next);
      } catch {
        // not remembered, still works
      }
      return next;
    });

  // Fit again when sessions come or go, the view changes, or the map grows because the tree or pane was hidden
  // (the first fit is the fitView prop, after nodes are measured).
  useEffect(() => {
    if (!sessionCount) return;
    const timer = window.setTimeout(() => void flow.fitView(FIT), 50);
    return () => window.clearTimeout(timer);
  }, [sessionCount, flow, view, hidden]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (target?.closest('input, textarea, [role="tree"], [role="dialog"], [role="alertdialog"], .stop-dialog, .answer-card')) return;
      // Map controls (design system): f fits, + and - zoom; there is no zoom slider. v (web only) swaps stars and cards.
      if (event.key === 'f') void flow.fitView(FIT);
      else if (event.key === '+' || event.key === '=') void flow.zoomIn({ duration: 120 });
      else if (event.key === '-') void flow.zoomOut({ duration: 120 });
      else if (event.key === 'v') toggleView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flow]);

  const stars = view === 'stars';
  return (
    <ReactFlow
      className={`map--${view}`}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => (node.type === 'session' || node.type === 'star') && store.focus(node.id)}
      fitView
      fitViewOptions={FIT}
      nodesConnectable={false}
      minZoom={0.2}
      maxZoom={2}
      attributionPosition="bottom-left"
    >
      <StarField />
      <MapKeys view={view} onFit={() => void flow.fitView(FIT)} onView={toggleView} />
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
  );
}

export function SessionMap() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
