// The star view of the map. Web only: the design system's map is a table in the terminal and cards on the web,
// and these shapes, glows and the starfield can't be drawn in Textual (see ROADMAP.md, "Web only").
import { AlertFlag, ContextBar, KindMark, ModeBadge, SessionNode, Spinner, StatusBadge, glyph } from '@ds';
import {
  type Edge as FlowEdge,
  type EdgeProps,
  Handle,
  type MiniMapNode,
  type Node,
  type NodeProps,
  Position,
  useViewport,
} from '@xyflow/react';
import type { ComponentProps } from 'react';
import { ago, task } from './format';
import type { Session, Subagent } from './protocol';

export type NodeData = {
  session: Session;
  n: number;
  subagents: Subagent[];
  /** The map's cursor is on it. */
  focused: boolean;
  /** Picked with space, for sending one prompt to several. */
  selected: boolean;
  compact: boolean;
  /** Model-written, only after you asked (s). */
  summary: string | null;
  now: number;
};
export type EndpointData = { name: string };

/** The star's center inside its node: left of the label, level with the name row. */
export const STAR = { x: 16, y: 10 };
/** Star, gap and a 39ch label; three 20 px rows. */
export const STAR_NODE = { w: 340, h: 60 };
const ENDPOINT_R = 5;

/** A star grows with the share of its context window the session has used. */
export function starRadius(session: Session): number {
  const pct = session.context?.percent;
  return pct == null ? 10 : 9 + Math.round((7 * Math.min(100, pct)) / 100);
}
export const endpointRadius = () => ENDPOINT_R;

/** A four-point sparkle centred on 0,0. */
function sparkle(r: number): string {
  return `M 0 ${-r} Q 0 0 ${r} 0 Q 0 0 0 ${r} Q 0 0 ${-r} 0 Q 0 0 0 ${-r} Z`;
}

/** Moves both ends of a line in along it, so lines meet a star's edge instead of its center. */
export function trim(sx: number, sy: number, tx: number, ty: number, rs: number, rt: number) {
  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.hypot(dx, dy);
  if (length <= rs + rt) return { sx, sy, tx, ty };
  return { sx: sx + (dx / length) * rs, sy: sy + (dy / length) * rs, tx: tx - (dx / length) * rt, ty: ty - (dy / length) * rt };
}

export const step = (s: Session) => (s.status === 'waiting' && s.waitingFor ? `waiting: ${s.waitingFor}` : (s.step ?? ''));

/** What the design system's SessionNode card takes, from a session. */
export function sessionNodeProps({ session: s, n, subagents, focused, selected, compact, summary, now }: NodeData) {
  return {
    selected,
    compact,
    summary: summary ?? undefined,
    index: n,
    name: s.name,
    project: s.project,
    branch: s.branch ?? '—',
    mode: s.mode ?? 'default',
    status: s.status,
    kind: s.kind,
    ago: ago(s.lastActivityAt, now),
    task: task(s),
    step: step(s),
    ctx: s.context?.percent ?? undefined,
    // The resource row (design system: SessionNode): its CPU minutes and the most severe alert.
    cpu: s.resources?.cpuHistory.length ? s.resources.cpuHistory.map(Math.round) : undefined,
    alert: s.alerts[0] ? { level: s.alerts[0].level, label: s.alerts[0].kind } : undefined,
    subagents: subagents.map((a) => ({ name: a.description ?? a.type, status: a.status })),
    focused,
  };
}

/** Lines start and end at the star: one source and one target handle on its center. */
export function StarHandles() {
  const style = { left: STAR.x, top: STAR.y };
  return (
    <>
      <Handle id="s" type="source" position={Position.Right} className="map-handle" style={style} isConnectable={false} />
      <Handle id="t" type="target" position={Position.Left} className="map-handle" style={style} isConnectable={false} />
    </>
  );
}

const MOON_ANGLES = [-35, 35, 145, 215];

function StarMark({ session, moons, focused }: { session: Session; moons: Subagent[]; focused: boolean }) {
  const r = starRadius(session);
  const external = session.kind === 'external';
  return (
    <svg className={`star__mark star--${session.status}${external ? ' star--hollow' : ''}`} width={64} height={64} viewBox="-32 -32 64 64" aria-hidden="true">
      <circle className="star__halo" r={r * 1.7} />
      <circle className="star__ring star__ring--hover" r={r + 9} />
      {focused ? <circle className="star__ring star__ring--focus" r={r + 9} /> : null}
      {session.status === 'waiting' ? <circle className="star__ring star__ring--waiting" r={r + 5} /> : null}
      {session.mode === 'bypassPermissions' ? <circle className="star__ring star__ring--bypass" r={r + 3} /> : null}
      <path className="star__glint" d={sparkle(r * 0.6)} transform="rotate(45)" />
      <path className="star__body" d={sparkle(r)} />
      {external ? null : <circle className="star__core" r={Math.max(1.5, r * 0.2)} />}
      {moons.map((moon, i) => {
        const angle = (MOON_ANGLES[i % MOON_ANGLES.length] * Math.PI) / 180;
        return (
          <circle
            key={moon.id}
            className={`star__moon star__moon--${moon.status}`}
            cx={Math.cos(angle) * (r + 7)}
            cy={Math.sin(angle) * (r + 7)}
            r={moon.status === 'working' ? 2 : 1.5}
          />
        );
      })}
    </svg>
  );
}

/** A session as a star: the mark, then name, status, mode, branch, context and latest step. Hover shows its card. */
export function StarNode({ data }: NodeProps<Node<NodeData, 'star'>>) {
  const { session: s, n, subagents, focused, selected, compact, summary, now } = data;
  const pct = s.context?.percent;
  const latest = step(s) || task(s);
  return (
    <div className={`star${selected ? ' star--selected' : ''}`}>
      <StarHandles />
      <StarMark session={s} moons={subagents} focused={focused} />
      <div className="star__label">
        <div className="star__row">
          {selected ? <span className="star__check">{glyph('misc', 'check_on')}</span> : null}
          <span className={focused ? 'star__index star__index--focused' : 'star__index cn-dim'}>{n}</span>
          <span className="star__name">{s.name}</span>
          <KindMark kind={s.kind} />
          {s.kind === 'external' ? <span className="cn-tag">ext</span> : null}
          <StatusBadge status={s.status} age={ago(s.lastActivityAt, now)} compact={compact} />
          {compact ? <ModeBadge mode={s.mode ?? 'default'} compact /> : null}
        </div>
        {compact ? null : (
          <>
            <div className="star__row">
              <ModeBadge mode={s.mode ?? 'default'} />
              {pct != null ? <ContextBar value={Math.round(pct)} max={s.context?.windowTokens ?? undefined} cells={6} /> : null}
              {s.alerts[0] ? <AlertFlag level={s.alerts[0].level} label={s.alerts[0].kind} /> : null}
            </div>
            <div className={`star__row${s.status === 'error' ? ' cn-status--error' : ''}`}>
              {s.status === 'working' ? (
                <Spinner />
              ) : s.status === 'error' ? (
                <span>{glyph('status', 'error')}</span>
              ) : (
                <span className="cn-dim">{glyph('message', 'prompt')}</span>
              )}
              <span className={`cn-ellipsis star__step star__step--${s.status}`} title={latest}>{latest}</span>
            </div>
            {summary ? (
              // Its age, and dimmed once the session has moved on since (roadmap 5.4).
              <div
                className="star__row star__summary"
                title={s.summarySource === 'claude' ? "Claude Code's own recap" : 'model-written summary'}
              >
                <span className="cn-dim">summary {ago(s.summaryAt, now)}</span>
                <span className={`cn-ellipsis${(s.lastActivityAt ?? 0) > (s.summaryAt ?? 0) ? ' cn-dim' : ''}`}>{summary}</span>
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="star__card">
        <SessionNode {...sessionNodeProps({ ...data, focused: false, compact: false })} />
      </div>
    </div>
  );
}

/** A peer that isn't a running session: a small hollow star. */
export function EndpointStar({ data }: NodeProps<Node<EndpointData, 'endpointStar'>>) {
  return (
    <div className="star star--endpoint" title="not a running session: it exited, or isn't Claude Code">
      <StarHandles />
      <svg className="star__mark star--hollow star--external-peer" width={64} height={64} viewBox="-32 -32 64 64" aria-hidden="true">
        <path className="star__body" d={sparkle(ENDPOINT_R)} />
      </svg>
      <div className="star__label">
        <div className="star__row">
          <KindMark kind="external" />
          <span>{data.name}</span>
          <span className="cn-dim">not running</span>
        </div>
      </div>
    </div>
  );
}

/** The faint line that joins a project's stars into one constellation. Decoration, not a message. */
export type FigureEdgeType = FlowEdge<{ rs: number; rt: number }, 'figure'>;

export function FigureEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps<FigureEdgeType>) {
  const p = trim(sourceX, sourceY, targetX, targetY, data?.rs ?? 0, data?.rt ?? 0);
  return <path className="figure" d={`M ${p.sx} ${p.sy} L ${p.tx} ${p.ty}`} />;
}

/** The minimap draws each session as a dot where its star is. */
export function MiniStar({ x, y, color }: ComponentProps<typeof MiniMapNode>) {
  return <circle cx={x + STAR.x} cy={y + STAR.y} r={22} fill={color} />;
}

// Background sky: two tiles of seeded stars that drift slower than the map when you pan (parallax). No motion of its own.
const TILE = 480;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatter(seed: number, count: number, rMin: number, rMax: number) {
  const random = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: random() * TILE,
    y: random() * TILE,
    r: rMin + random() * (rMax - rMin),
    opacity: 0.3 + random() * 0.7,
    tint: random() < 0.15,
  }));
}

const FAR = scatter(7, 120, 0.35, 0.8);
const NEAR = scatter(23, 28, 0.7, 1.3);
const GLINTS = scatter(41, 3, 3, 4.5);

const wrap = (value: number) => ((value % TILE) + TILE) % TILE;

export function StarField() {
  const { x, y } = useViewport();
  return (
    <svg className="react-flow__background starfield" aria-hidden="true">
      <defs>
        <pattern id="starfield-far" width={TILE} height={TILE} patternUnits="userSpaceOnUse" patternTransform={`translate(${wrap(x * 0.08)} ${wrap(y * 0.08)})`}>
          {FAR.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.opacity} className={s.tint ? 'starfield__tint' : 'starfield__far'} />
          ))}
        </pattern>
        <pattern id="starfield-near" width={TILE} height={TILE} patternUnits="userSpaceOnUse" patternTransform={`translate(${wrap(x * 0.25)} ${wrap(y * 0.25)})`}>
          {NEAR.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.opacity} className={s.tint ? 'starfield__tint' : 'starfield__near'} />
          ))}
          {GLINTS.map((s, i) => (
            <path key={i} d={sparkle(s.r)} transform={`translate(${s.x} ${s.y})`} opacity={0.35} className="starfield__near" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#starfield-far)" />
      <rect width="100%" height="100%" fill="url(#starfield-near)" />
    </svg>
  );
}
