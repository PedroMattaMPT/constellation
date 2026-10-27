import { React } from './react';
import { Level, cx, glyph } from './atoms';

export const levelFor = (pct: number, warn = 80, crit = 95): Level => (pct >= crit ? 'critical' : pct >= warn ? 'warning' : 'normal');

export interface ContextSlice { label: string; tokens: number; tone: 'system' | 'tools' | 'mcp' | 'memory' | 'messages' }

/**
 * Context-window fill. 8 cells wide like the TUI bar (▕█████··▏ 64%), a tick at the auto-compact threshold,
 * △ from 80 %, ▲ from 95 %. With `slices` it becomes the /context breakdown.
 */
export function ContextBar({
  value, max = 200000, compactAt = 0.8, slices, showLabel = true, cells = 8,
}: { value: number; max?: number; compactAt?: number; slices?: ContextSlice[]; showLabel?: boolean; cells?: number }) {
  const level = levelFor(value);
  const used = Math.round((value / 100) * max);
  if (slices) {
    const total = slices.reduce((a, s) => a + s.tokens, 0);
    const free = Math.max(0, max - total);
    return (
      <div className="cn-ctx-detail">
        <div className="cn-ctx-detail__head">
          <span className="cn-dim">context</span>{' '}
          <span className={`cn-level--${level}`}>{Math.round((total / max) * 100)}%</span>{' '}
          <span className="cn-dim">{fmt(total)} of {fmt(max)} · compacts at {Math.round(compactAt * 100)}%</span>
        </div>
        <div className="cn-ctx-detail__bar" role="img" aria-label={`context ${Math.round((total / max) * 100)} percent`}>
          {slices.map((s) => (
            <span key={s.label} className={`cn-ctx-seg cn-ctx-seg--${s.tone}`} style={{ width: `${(s.tokens / max) * 100}%` }} />
          ))}
          <span className="cn-ctx-tick" style={{ left: `${compactAt * 100}%` }} />
        </div>
        <ul className="cn-ctx-legend">
          {slices.map((s) => (
            <li key={s.label}><span className={`cn-ctx-key cn-ctx-seg--${s.tone}`}>■</span> {s.label} <span className="cn-dim">{fmt(s.tokens)}</span></li>
          ))}
          <li><span className="cn-ctx-key cn-ctx-seg--free">□</span> free <span className="cn-dim">{fmt(free)}</span></li>
        </ul>
      </div>
    );
  }
  return (
    <span className={cx('cn-ctx', `cn-ctx--${level}`)} title={`context ${value}% · ${fmt(used)} of ${fmt(max)} tokens`}>
      {showLabel ? <span className="cn-dim">ctx </span> : null}
      <span className="cn-ctx__track" style={{ width: `${cells}ch` }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="context window">
        <span className="cn-ctx__fill" style={{ width: `${Math.min(100, value)}%` }} />
        <span className="cn-ctx-tick" style={{ left: `${compactAt * 100}%` }} />
      </span>
      <span className="cn-ctx__pct"> {value}%</span>
      {level !== 'normal' ? <span className="cn-ctx__flag"> {glyph('alert', level)}</span> : null}
    </span>
  );
}

/**
 * 30 minutes of history, one cell per minute. Bars, not a line, so the web matches ▁▂▃▄▅▆▇█.
 * Bars over `warn` turn amber, over `crit` vermillion; the latest value is printed after.
 */
export function Sparkline({
  values, label, current, warn, crit, max, unit = '',
}: { values: number[]; label: string; current?: string; warn?: number; crit?: number; max?: number; unit?: string }) {
  const top = max ?? Math.max(1, ...values);
  const cell = 8;
  const h = 16;
  const last = values[values.length - 1] ?? 0;
  const lvl: Level = crit != null && last >= crit ? 'critical' : warn != null && last >= warn ? 'warning' : 'normal';
  return (
    <span className={cx('cn-spark', `cn-spark--${lvl}`)}>
      <span className="cn-dim cn-spark__label">{label}</span>
      <svg className="cn-spark__svg" width={values.length * cell} height={h} viewBox={`0 0 ${values.length * cell} ${h}`} role="img"
        aria-label={`${label} over the last ${values.length} minutes, now ${current ?? last + unit}`}>
        {warn != null ? <line className="cn-spark__threshold" x1={0} x2={values.length * cell} y1={h - (warn / top) * h} y2={h - (warn / top) * h} /> : null}
        {values.map((v, i) => {
          const bh = Math.max(2, (Math.min(v, top) / top) * h);
          const l: Level = crit != null && v >= crit ? 'critical' : warn != null && v >= warn ? 'warning' : 'normal';
          return <rect key={i} className={`cn-spark__bar cn-spark__bar--${l}`} x={i * cell + 1} y={h - bh} width={cell - 2} height={bh} />;
        })}
      </svg>
      <span className={cx('cn-spark__now', `cn-level--${lvl}`)}>{current ?? `${last}${unit}`}</span>
      {lvl !== 'normal' ? <span className={`cn-level--${lvl}`}> {glyph('alert', lvl)}</span> : null}
    </span>
  );
}

/** The same sparkline as TUI text: ▁▂▃▄▅▆▇█. */
export function sparkText(values: number[], max?: number): string {
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const top = max ?? Math.max(1, ...values);
  return values.map((v) => blocks[Math.min(7, Math.max(0, Math.round((v / top) * 7)))]).join('');
}

export function fmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
