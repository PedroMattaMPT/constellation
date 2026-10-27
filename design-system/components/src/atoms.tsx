import { React } from './react';
import { GLYPHS } from './glyphs';

export type Status = 'working' | 'waiting' | 'idle' | 'stale' | 'error' | 'stopped';
export type Mode = 'default' | 'plan' | 'acceptEdits' | 'auto' | 'bypassPermissions' | 'dontAsk';
export type Kind = 'managed' | 'external';
export type Level = 'normal' | 'warning' | 'critical';
export type MsgType =
  | 'prompt' | 'slash' | 'tool' | 'question' | 'answer' | 'denied'
  | 'sent' | 'received' | 'subagent_started' | 'subagent_reported' | 'reply';

const G = GLYPHS as any;
export const glyph = (cat: string, name: string): string => G[cat]?.[name]?.unicode ?? '?';
export const label = (cat: string, name: string): string => G[cat]?.[name]?.label ?? name;

export const MODE_CLASS: Record<Mode, string> = {
  default: 'default', plan: 'plan', acceptEdits: 'edits', auto: 'auto', bypassPermissions: 'bypass', dontAsk: 'dontask',
};

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/** ● working, ? needs you (the amber chip), ○ idle, ◌ stale, × error, ■ stopped. Glyph + word + color, always. */
export function StatusBadge({ status, compact = false, age }: { status: Status; compact?: boolean; age?: string }) {
  const word = status === 'stale' && age ? `stale ${age}` : label('status', status);
  if (status === 'waiting') {
    return (
      <span className="cn-chip cn-chip--waiting" title="needs you">
        {glyph('status', 'waiting')}{compact ? null : ` ${word}`}
      </span>
    );
  }
  return (
    <span className={cx('cn-status', `cn-status--${status}`)} title={compact ? word : undefined}>
      <span className="cn-glyph" aria-hidden="true">{glyph('status', status)}</span>
      {compact ? <span className="cn-sr">{word}</span> : <span> {word}</span>}
    </span>
  );
}

/** Mode is always on screen. Auto and bypass are filled chips: they run commands without you. */
export function ModeBadge({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  const cls = MODE_CLASS[mode];
  const text = `${glyph('mode', mode)}${compact ? '' : ' ' + label('mode', mode)}`;
  const filled = mode === 'auto' || mode === 'bypassPermissions';
  return (
    <span className={cx(filled ? 'cn-chip' : 'cn-mode', `cn-${filled ? 'chip' : 'mode'}--${cls}`)} title={`mode: ${label('mode', mode)}`}>
      {text}
    </span>
  );
}

/** ◆ managed (yours), ◇ external (watched). */
export function KindMark({ kind }: { kind: Kind }) {
  return (
    <span className={cx('cn-kind', `cn-kind--${kind}`)} title={kind === 'managed' ? 'managed: started here' : 'external: started elsewhere, watched'}>
      {glyph('kind', kind)}
    </span>
  );
}

/** One key or chord, in tmux notation: C-Space, S-Tab, M-Enter. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="cn-kbd">{children}</kbd>;
}

/** Key hints as they appear in footers and card borders: key in starlight bold, action muted. */
export function KeyHints({ keys, prefix }: { keys: Array<[string, string]>; prefix?: string }) {
  return (
    <span className="cn-keys">
      {prefix ? <span className="cn-keys__prefix"><Kbd>{prefix}</Kbd></span> : null}
      {keys.map(([k, l]) => (
        <span className="cn-keys__item" key={k + l}>
          <span className="cn-keys__key">{k}</span> <span className="cn-keys__label">{l}</span>
        </span>
      ))}
    </span>
  );
}

/** The activity spinner: ▖▘▝▗ at 120 ms; holds still for prefers-reduced-motion. */
export function Spinner() {
  const frames: string[] = (GLYPHS as any).spinner.unicode;
  const [i, setI] = React.useState(1);
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % frames.length), (GLYPHS as any).spinner.interval_ms);
    return () => clearInterval(t);
  }, []);
  return <span className="cn-spinner" aria-hidden="true">{frames[i]}</span>;
}

/** Glyph for a message type, in its color. */
export function MsgGlyph({ type }: { type: MsgType }) {
  return <span className={cx('cn-msg-glyph', `cn-msg--${type}`)} aria-hidden="true">{glyph('message', type)}</span>;
}

/** Alert flag: △ warning (text), ▲ critical (filled chip). */
export function AlertFlag({ level, label: text }: { level: Level; label: string }) {
  if (level === 'normal') return null;
  if (level === 'critical') return <span className="cn-chip cn-chip--critical">{glyph('alert', 'critical')} {text}</span>;
  return <span className="cn-alert cn-alert--warning">{glyph('alert', 'warning')} {text}</span>;
}

/** After the prefix key: the bindings it unlocks, grouped, shown after 600 ms (tmux list-keys meets which-key). */
export function WhichKey({ prefix = 'C-Space', groups }: { prefix?: string; groups: Array<{ title: string; keys: Array<[string, string]> }> }) {
  return (
    <div className="cn-which" role="dialog" aria-label={`${prefix} bindings`}>
      <div className="cn-which__head"><span className="cn-chip cn-chip--brand">{prefix}</span><span className="cn-dim">then</span><span className="cn-fill" /><span className="cn-dim">? all keys · esc cancel</span></div>
      <div className="cn-which__grid">
        {groups.map((g) => (
          <div key={g.title} className="cn-which__group">
            <div className="cn-label">{g.title}</div>
            {g.keys.map(([k, l]) => (
              <div key={k} className="cn-which__row"><span className="cn-which__key">{k}</span><span className="cn-which__label">{l}</span></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
