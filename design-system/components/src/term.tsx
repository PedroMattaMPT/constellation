import { React } from './react';
import { cx } from './atoms';

/**
 * Renders a terminal snippet on the web: what a component looks like in the Textual UI.
 * Lines use Textual-style content markup with token names:
 *   [b] bold  [d] dim  [i] italic  [u] underline  [r] reverse
 *   [status-working] a color token   [on:panel] a background token   [chip:status-waiting-fill] a fill + its on-color
 *   "\[" is a literal bracket. Tags do not nest; [/] closes the open one.
 */
type Seg = { text: string; style: React.CSSProperties };

const FILL_ON: Record<string, string> = {
  'status-waiting-fill': 'on-status-waiting-fill',
  'mode-auto': 'on-mode-auto',
  'mode-bypass': 'on-mode-bypass',
  'res-critical-fill': 'on-res-critical-fill',
  'fill-brand': 'on-fill-brand',
};

function styleFor(tag: string): React.CSSProperties {
  const s: React.CSSProperties = {};
  let color: string | undefined;
  let reverse = false;
  for (const part of tag.trim().split(/\s+/)) {
    if (!part) continue;
    if (part === 'b') s.fontWeight = 700;
    else if (part === 'i') s.fontStyle = 'italic';
    else if (part === 'u') s.textDecoration = 'underline';
    else if (part === 'd') {
      // dim: muted when no color is given, otherwise the color at reduced intensity
      if (color) s.opacity = 0.75;
      else color = 'var(--fg-muted)';
    } else if (part === 'r') reverse = true;
    else if (part.startsWith('on:')) s.background = `var(--${part.slice(3)})`;
    else if (part.startsWith('chip:')) {
      const fill = part.slice(5);
      s.background = `var(--${fill})`;
      color = `var(--${FILL_ON[fill] ?? 'bg'})`;
      s.fontWeight = 700;
    } else color = `var(--${part})`;
  }
  if (reverse) {
    s.background = color ?? 'var(--fg)';
    s.color = 'var(--bg)';
  } else if (color) s.color = color;
  return s;
}

export function parseMarkup(line: string): Seg[] {
  const out: Seg[] = [];
  let style: React.CSSProperties = {};
  let buf = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '[') {
      buf += '[';
      i++;
      continue;
    }
    if (ch === '[') {
      const end = line.indexOf(']', i);
      if (end > i) {
        const tag = line.slice(i + 1, end);
        if (buf) out.push({ text: buf, style });
        buf = '';
        style = tag === '/' ? {} : styleFor(tag);
        i = end;
        continue;
      }
    }
    buf += ch;
  }
  if (buf) out.push({ text: buf, style });
  return out;
}

export function TuiFrame({ lines, title, cols, className }: { lines: string[]; title?: string; cols?: number; className?: string }) {
  return (
    <figure className={cx('cn-tui', className)} aria-label={title ? `Terminal: ${title}` : 'Terminal view'}>
      {title ? <figcaption className="cn-tui__title">{title}</figcaption> : null}
      <pre className="cn-tui__screen" style={cols ? { width: `${cols}ch` } : undefined}>
        {lines.map((line, i) => (
          <div className="cn-tui__line" key={i}>
            {parseMarkup(line).map((seg, j) => (
              <span key={j} style={seg.style}>{seg.text}</span>
            ))}
            {line.length === 0 ? ' ' : null}
          </div>
        ))}
      </pre>
    </figure>
  );
}

/** Visible width of a markup line (tags removed, \[ counted once). Every glyph in the set is one cell. */
export function vlen(markup: string): number {
  return parseMarkup(markup).reduce((n, s) => n + Array.from(s.text).length, 0);
}

/** Pad a markup line with spaces to `width` cells. */
export function pad(markup: string, width: number): string {
  return markup + ' '.repeat(Math.max(0, width - vlen(markup)));
}

/** Lay out columns: cols([['[b]name[/]', 15], ['● working', 12]]) — each cell padded to its width. */
export function cols(cells: Array<[string, number]>): string {
  return cells.map(([m, w]) => pad(m, w)).join('');
}

const BORDERS = {
  solid: ['┌', '─', '┐', '│', '└', '┘'],
  heavy: ['┏', '━', '┓', '┃', '┗', '┛'],
  round: ['╭', '─', '╮', '│', '╰', '╯'],
  dashed: ['┏', '╍', '┓', '╏', '┗', '┛'],
  double: ['╔', '═', '╗', '║', '╚', '╝'],
} as const;

/**
 * A Textual-style bordered box as markup lines: title in the top border, subtitle in the bottom border,
 * exactly `width` cells wide. Matches Textual's solid / heavy / round / dashed / double borders.
 */
export function box(o: {
  width: number; lines: string[]; title?: string; footer?: string; footerAlign?: 'left' | 'right';
  border?: string; kind?: keyof typeof BORDERS; pad?: number;
}): string[] {
  const [tl, h, tr, v, bl, br] = BORDERS[o.kind ?? 'round'];
  const tok = o.border ?? 'line-strong';
  const b = (s: string) => (s ? `[${tok}]${s}[/]` : '');
  const inner = o.width - 2;
  const padX = o.pad ?? 1;
  const edge = (left: string, right: string, label?: string, align: 'left' | 'right' = 'left') => {
    if (!label) return b(left + h.repeat(inner) + right);
    const lab = ` ${label} `;
    const rest = Math.max(0, inner - 1 - vlen(lab));
    return align === 'left' ? b(left + h) + lab + b(h.repeat(rest) + right) : b(left + h.repeat(rest)) + lab + b(h + right);
  };
  const body = o.lines.map((l) => b(v) + ' '.repeat(padX) + pad(l, inner - 2 * padX) + ' '.repeat(padX) + b(v));
  return [edge(tl, tr, o.title), ...body, edge(bl, br, o.footer, o.footerAlign ?? 'left')];
}

export const tui = { vlen, pad, cols, box };
