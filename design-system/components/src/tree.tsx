import { React } from './react';
import { KindMark, Kind, MsgGlyph, MsgType, Status, StatusBadge, cx, glyph } from './atoms';

export type RowKind = 'project' | 'session' | MsgType;

export interface TreeRowProps {
  kind: RowKind;
  label: React.ReactNode;
  /** Right-aligned, muted: a time, a count, "182k→41k". */
  meta?: React.ReactNode;
  /** Guides for each ancestor level: true = draw │, false = blank. */
  guides?: boolean[];
  /** Last child at its level (└ instead of ├). */
  last?: boolean;
  depth?: number;
  expanded?: boolean;
  hasChildren?: boolean;
  /** Turn number for prompt rows. */
  turn?: number;
  /** Session rows. */
  status?: Status;
  sessionKind?: Kind;
  cursor?: boolean;
  /** Matches the open search; bold label. */
  match?: boolean;
  /** Filtered out but kept for context: faint. */
  dimmed?: boolean;
  /** An unanswered question or permission: amber, and it bubbles up to its session. */
  attention?: boolean;
  onActivate?: () => void;
}

/** One row of the NERDTree-style message tree: guides, disclosure, glyph, label, meta. One line tall. */
export function TreeRow(p: TreeRowProps) {
  const depth = p.depth ?? 0;
  const guides = p.guides ?? Array.from({ length: Math.max(0, depth - 1) }, () => true);
  const disclosure = p.hasChildren ? (p.expanded ? glyph('tree', 'expanded') : glyph('tree', 'collapsed')) : ' ';
  return (
    <div
      className={cx('cn-row', `cn-row--${p.kind}`, p.cursor && 'cn-row--cursor', p.match && 'cn-row--match', p.dimmed && 'cn-row--dimmed', p.attention && 'cn-row--attention')}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={p.hasChildren ? !!p.expanded : undefined}
      aria-selected={!!p.cursor}
      tabIndex={p.cursor ? 0 : -1}
      onDoubleClick={p.onActivate}
    >
      <span className="cn-row__bar" aria-hidden="true">{p.cursor ? glyph('tree', 'cursor') : ' '}</span>
      <span className="cn-row__guides" aria-hidden="true">
        {guides.map((g, i) => <span key={i}>{g ? '│ ' : '  '}</span>)}
        {depth > 0 ? <span>{p.last ? '└ ' : '├ '}</span> : null}
      </span>
      <span className="cn-row__disc" aria-hidden="true">{disclosure}</span>
      {p.kind === 'project' ? <span className="cn-dim cn-row__glyph">{glyph('message', 'project')}</span> : null}
      {p.kind === 'session' ? <KindMark kind={p.sessionKind ?? 'managed'} /> : null}
      {p.kind !== 'project' && p.kind !== 'session' ? <MsgGlyph type={p.kind as MsgType} /> : null}
      {p.turn != null ? <span className="cn-msg--prompt cn-row__turn">{p.turn}</span> : null}
      <span className="cn-row__label">{p.label}</span>
      {p.kind === 'session' && p.status ? <StatusBadge status={p.status} compact /> : null}
      <span className="cn-fill" />
      {p.meta != null ? <span className="cn-row__meta">{p.meta}</span> : null}
    </div>
  );
}

export interface FilterChip { type: MsgType | 'peer' | 'subagent'; count: number; on: boolean }

const FILTER_GLYPH: Record<string, string> = { peer: '→←', subagent: '◦↑' };

/** Type filter for the tree (f). Each chip is glyph + count; off chips go dashed and muted, never hidden. */
export function TreeFilter({ chips, query }: { chips: FilterChip[]; query?: string }) {
  return (
    <div className="cn-filter" role="toolbar" aria-label="filter by type">
      <span className="cn-label">tree</span>
      {chips.map((c, i) => (
        <button key={c.type} className={cx('cn-filter__chip', c.on ? 'cn-filter__chip--on' : 'cn-filter__chip--off')} aria-pressed={c.on} title={`${i + 1}: ${c.type}`}>
          <span className={`cn-msg--${c.type === 'peer' ? 'sent' : c.type === 'subagent' ? 'subagent_started' : c.type}`}>
            {FILTER_GLYPH[c.type] ?? glyph('message', c.type)}
          </span>
          <span className="cn-dim">{c.count}</span>
        </button>
      ))}
      {query ? <span className="cn-filter__query">/{query}</span> : null}
    </div>
  );
}
