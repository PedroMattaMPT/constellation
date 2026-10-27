import { React } from './react';
import { AlertFlag, KindMark, Kind, Level, Mode, ModeBadge, Spinner, Status, StatusBadge, cx, glyph } from './atoms';
import { ContextBar, Sparkline } from './meters';

export interface Subagent { name: string; status: 'working' | 'reported'; tools?: number }

export interface SessionNodeProps {
  name: string;
  project: string;
  branch: string;
  mode: Mode;
  status: Status;
  kind?: Kind;
  /** Time since last activity: "12s", "3h". */
  ago: string;
  /** The task it was given (first prompt or its title). */
  task: string;
  /** Latest step: "Edit src/limits/route.ts", "asked: Which session store?". */
  step: string;
  /** Model-written one-liner, only after you ask for it (s). Rendered italic. */
  summary?: string;
  ctx?: number;
  cpu?: number[];
  alert?: { level: Level; label: string };
  subagents?: Subagent[];
  index?: number;
  focused?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** One line instead of four (wide maps, small screens). */
  compact?: boolean;
}

/** A session on the map: React Flow node content. Four rows of cells, 36ch wide. */
export function SessionNode(p: SessionNodeProps) {
  const kind = p.kind ?? 'managed';
  const attention = p.status === 'waiting' ? 'waiting' : p.status === 'stale' ? 'stale' : p.status === 'error' ? 'error' : null;
  const cls = cx(
    'cn-node',
    `cn-node--${kind}`,
    attention && `cn-node--${attention}`,
    p.mode === 'bypassPermissions' && 'cn-node--bypass',
    p.focused && 'cn-node--focused',
    p.selected && 'cn-node--selected',
    p.disabled && 'cn-node--disabled',
    p.compact && 'cn-node--compact',
  );
  const name = (
    <span className="cn-node__name">
      {p.index != null ? <span className="cn-dim">{p.index} </span> : null}
      {p.name}
    </span>
  );
  if (p.compact) {
    return (
      <div className={cls} tabIndex={p.disabled ? -1 : 0} aria-label={`${p.name}, ${p.status}, ${p.mode}`}>
        <div className="cn-node__row">
          {p.selected ? <span className="cn-node__check">[x]</span> : null}
          <KindMark kind={kind} /> {name}
          <span className="cn-fill" />
          <StatusBadge status={p.status} age={p.ago} compact />
          <ModeBadge mode={p.mode} compact />
          <span className="cn-dim cn-node__ago">{p.ago}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="cn-node-wrap">
      <div className={cls} tabIndex={p.disabled ? -1 : 0} aria-label={`${p.name}, ${p.status}, mode ${p.mode}, ${p.project}`}>
        <div className="cn-node__row cn-node__head">
          {p.selected ? <span className="cn-node__check">[x]</span> : null}
          <KindMark kind={kind} /> {name}
          {kind === 'external' ? <span className="cn-tag">ext</span> : null}
          <span className="cn-fill" />
          <StatusBadge status={p.status} age={p.ago} />
        </div>
        <div className="cn-node__row cn-node__meta">
          <span className="cn-dim cn-ellipsis">{p.project}</span>
          <span className="cn-dim cn-ellipsis">@{p.branch}</span>
          <span className="cn-fill" />
          <ModeBadge mode={p.mode} />
          <span className="cn-dim cn-node__ago">{p.ago}</span>
        </div>
        <div className="cn-node__row cn-node__task" title={p.task}>{p.task}</div>
        <div className={cx('cn-node__row', 'cn-node__step', p.status === 'error' && 'cn-status--error')}>
          {p.status === 'working' ? <Spinner /> : p.status === 'error' ? <span>{glyph('status', 'error')}</span> : <span className="cn-dim">{glyph('message', 'prompt')}</span>}
          <span className={cx('cn-ellipsis', (p.status === 'idle' || p.status === 'stale') && 'cn-dim')}>{p.step}</span>
        </div>
        {p.summary ? <div className="cn-node__row cn-node__summary" title="model-written summary">{p.summary}</div> : null}
        {p.ctx != null || p.cpu ? (
          <div className="cn-node__row cn-node__res">
            {p.ctx != null ? <ContextBar value={p.ctx} cells={6} /> : null}
            {p.cpu ? <Sparkline values={p.cpu.slice(-12)} label="cpu" warn={200} crit={400} max={400} current={`${p.cpu[p.cpu.length - 1]}%`} /> : null}
            {p.alert ? <AlertFlag level={p.alert.level} label={p.alert.label} /> : null}
          </div>
        ) : null}
      </div>
      {p.subagents?.length ? (
        <div className="cn-node__subs">
          {p.subagents.map((s) => <SubagentNode key={s.name} {...s} />)}
        </div>
      ) : null}
    </div>
  );
}

/** A subagent: a one-line child under its parent, joined by a dotted link. */
export function SubagentNode({ name, status, tools }: Subagent) {
  return (
    <div className={cx('cn-sub', `cn-sub--${status}`)}>
      <span className="cn-sub__link" aria-hidden="true">└</span>
      <span className="cn-msg--subagent_started">{status === 'working' ? glyph('message', 'subagent_started') : glyph('message', 'subagent_reported')}</span>{' '}
      <span>{name}</span>{' '}
      <span className="cn-dim">{status === 'working' ? 'working' : 'reported back'}{tools != null ? ` · ${tools} tools` : ''}</span>
    </div>
  );
}

/** Project group frame on the map: a labelled region, never a card. */
export function ProjectGroup({ name, count, waiting, children, style }: { name: string; count: number; waiting?: number; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="cn-group" style={style} aria-label={`project ${name}`}>
      <header className="cn-group__label">
        <span className="cn-dim">{glyph('message', 'project')}</span> <b>{name}</b> <span className="cn-dim">{count}</span>
        {waiting ? <span className="cn-chip cn-chip--waiting">{glyph('status', 'waiting')} {waiting}</span> : null}
      </header>
      {children}
    </section>
  );
}

export interface MessageEdgeProps {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  /** Messages sent along this edge: 1–2 light, 3–9 heavy, 10+ double weight. */
  count: number;
  kind?: 'peer' | 'subagent';
  selected?: boolean;
  /** A message is in flight right now: the line runs a dash once. */
  live?: boolean;
  id?: string;
}

export const edgeTier = (count: number) => (count >= 10 ? 3 : count >= 3 ? 2 : 1);

/** A directed message edge (React Flow custom edge). Weight shows volume; the count chip shows on hover/selection. */
export function MessageEdge({ sourceX, sourceY, targetX, targetY, count, kind = 'peer', selected, live, id }: MessageEdgeProps) {
  const tier = edgeTier(count);
  // Leave along the dominant axis (React Flow handles sit on the sides or on top/bottom).
  const vertical = Math.abs(targetY - sourceY) > Math.abs(targetX - sourceX);
  const span = vertical ? targetY - sourceY : targetX - sourceX;
  const k = Math.sign(span || 1) * Math.max(24, Math.abs(span) / 2);
  const d = vertical
    ? `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + k}, ${targetX} ${targetY - k}, ${targetX} ${targetY}`
    : `M ${sourceX} ${sourceY} C ${sourceX + k} ${sourceY}, ${targetX - k} ${targetY}, ${targetX} ${targetY}`;
  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;
  const marker = `cn-arrow-${kind}-${selected ? 'sel' : 'rest'}-${tier}`;
  return (
    <g className={cx('cn-edge', `cn-edge--${kind}`, `cn-edge--t${tier}`, selected && 'cn-edge--selected', live && 'cn-edge--live')} data-id={id}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth={tier === 3 ? 3 : tier === 2 ? 4 : 6} markerHeight={tier === 3 ? 3 : tier === 2 ? 4 : 6} orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 z" className="cn-edge__head" />
        </marker>
      </defs>
      <path d={d} className="cn-edge__hit" />
      {tier === 3 ? <path d={d} className="cn-edge__line cn-edge__line--outer" /> : null}
      <path d={d} className="cn-edge__line" markerEnd={`url(#${marker})`} />
      {tier === 3 ? <path d={d} className="cn-edge__gap" /> : null}
      <g className="cn-edge__label" transform={`translate(${mx}, ${my})`}>
        <rect x={-22} y={-10} width={44} height={20} rx={2} />
        <text x={0} y={4} textAnchor="middle">{kind === 'subagent' ? '↑ ' : '→ '}{count}</text>
      </g>
    </g>
  );
}
