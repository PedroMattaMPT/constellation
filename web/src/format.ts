import type { Entry, Session } from './protocol';

/** "4s", "12m", "3h", "2d" (design system: relative, short). */
export function ago(ms: number | null | undefined, now: number): string {
  if (!ms) return '';
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function task(session: Session): string {
  return session.title || session.firstPrompt || session.lastPrompt || 'no prompt yet';
}

/** Model ids as the design system writes them: "claude-opus-5-5" → "opus-5.5". */
export function shortModel(id: string): string {
  return id.replace(/^claude-/, '').replace(/(\d+)-(\d+)/, '$1.$2');
}

export function model(session: Session): string {
  const id = session.model ?? session.context?.model;
  return id ? shortModel(id) : '';
}

/** Tokens in thousands (design system: `182k → 41k`), millions past that. */
export function count(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

/** Memory as the design system writes limits: "1.2 GB", "21.4/20 GB". */
export function gb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, '')} GB`;
}

export function cost(usd: number | null | undefined): string | undefined {
  return usd == null ? undefined : `$${usd.toFixed(2)}`;
}

/** Design-system message type for an entry kind: conversation-only kinds borrow the closest glyph. */
export type MsgType =
  | 'prompt' | 'slash' | 'tool' | 'question' | 'answer' | 'denied'
  | 'sent' | 'received' | 'subagent_started' | 'subagent_reported' | 'reply';

export function msgType(kind: Entry['kind']): MsgType {
  switch (kind) {
    case 'thinking':
    case 'notice':
      return 'reply';
    case 'interrupt':
      return 'denied';
    case 'compact':
    case 'mode': // a mode change: an inline record, like /compact
      return 'slash';
    default:
      return kind;
  }
}
