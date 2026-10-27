// tmux-style panes (design system: panes and windows; roadmap 5.1). Each window is a tree of splits whose leaves are
// panes, and each pane shows one session. Pure functions over that tree: the store keeps the windows.

export interface Pane {
  kind: 'pane';
  id: string;
  session: string | null;
  /** The session it showed until that left the map: one that replaces it (adopted, rewound) comes back here. */
  gone?: string | null;
}

export interface Split {
  kind: 'split';
  id: string;
  /** row: side by side (C-Space %), column: one above the other (C-Space "). */
  dir: 'row' | 'column';
  /** The first side's share, 0–1. */
  ratio: number;
  a: Layout;
  b: Layout;
}

export type Layout = Pane | Split;

export interface Win {
  id: string;
  layout: Layout;
  /** The pane it had focused when you left it. */
  focus?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

const MIN_RATIO = 0.15;
let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

export function pane(session: string | null = null): Pane {
  return { kind: 'pane', id: newId('p'), session };
}

/** The panes in reading order: left before right, top before bottom. */
export function panes(layout: Layout): Pane[] {
  return layout.kind === 'pane' ? [layout] : [...panes(layout.a), ...panes(layout.b)];
}

export function find(layout: Layout, id: string): Pane | undefined {
  return panes(layout).find((p) => p.id === id);
}

/** The same tree with each pane replaced by what `fn` returns. */
export function mapPanes(layout: Layout, fn: (p: Pane) => Layout): Layout {
  if (layout.kind === 'pane') return fn(layout);
  return { ...layout, a: mapPanes(layout.a, fn), b: mapPanes(layout.b, fn) };
}

/** Splits a pane in two: the new pane goes right of it (row) or below it (column). */
export function split(layout: Layout, id: string, dir: Split['dir'], fresh: Pane): Layout {
  return mapPanes(layout, (p) => (p.id === id ? { kind: 'split', id: newId('s'), dir, ratio: 0.5, a: p, b: fresh } : p));
}

/** Takes a pane out; its sibling takes the space. Null when it was the only pane. */
export function remove(layout: Layout, id: string): Layout | null {
  if (layout.kind === 'pane') return layout.id === id ? null : layout;
  const a = remove(layout.a, id);
  const b = remove(layout.b, id);
  if (!a) return b;
  if (!b) return a;
  return a === layout.a && b === layout.b ? layout : { ...layout, a, b };
}

export function resize(layout: Layout, id: string, ratio: number): Layout {
  if (layout.kind === 'pane') return layout;
  const clamped = Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, ratio));
  if (layout.id === id) return { ...layout, ratio: clamped };
  return { ...layout, a: resize(layout.a, id, ratio), b: resize(layout.b, id, ratio) };
}

/** Where each pane sits, as shares of the window (0–1). */
export function rects(layout: Layout, at: Rect = { x: 0, y: 0, w: 1, h: 1 }, out = new Map<string, Rect>()): Map<string, Rect> {
  if (layout.kind === 'pane') {
    out.set(layout.id, at);
    return out;
  }
  if (layout.dir === 'row') {
    const w = at.w * layout.ratio;
    rects(layout.a, { ...at, w }, out);
    rects(layout.b, { ...at, x: at.x + w, w: at.w - w }, out);
  } else {
    const h = at.h * layout.ratio;
    rects(layout.a, { ...at, h }, out);
    rects(layout.b, { ...at, y: at.y + h, h: at.h - h }, out);
  }
  return out;
}

/** The pane next to `from` in that direction (C-Space h j k l): the nearest that shares an edge's span with it. */
export function neighbor(layout: Layout, from: string, direction: Direction): string | null {
  const all = rects(layout);
  const r = all.get(from);
  if (!r) return null;
  const eps = 1e-6;
  const horizontal = direction === 'left' || direction === 'right';
  let best: { id: string; gap: number; overlap: number } | null = null;
  for (const [id, c] of all) {
    if (id === from) continue;
    const gap =
      direction === 'right' ? c.x - (r.x + r.w) : direction === 'left' ? r.x - (c.x + c.w) : direction === 'down' ? c.y - (r.y + r.h) : r.y - (c.y + c.h);
    if (gap < -eps) continue;
    const overlap = horizontal ? Math.min(r.y + r.h, c.y + c.h) - Math.max(r.y, c.y) : Math.min(r.x + r.w, c.x + c.w) - Math.max(r.x, c.x);
    if (overlap <= eps) continue;
    if (!best || gap < best.gap - eps || (Math.abs(gap - best.gap) <= eps && overlap > best.overlap)) best = { id, gap, overlap };
  }
  return best?.id ?? null;
}

/** A saved layout is used only if it's well formed; anything else starts over. */
export function valid(layout: unknown): layout is Layout {
  if (!layout || typeof layout !== 'object') return false;
  const l = layout as { kind?: unknown; id?: unknown; session?: unknown; dir?: unknown; ratio?: unknown; a?: unknown; b?: unknown };
  if (l.kind === 'pane') return typeof l.id === 'string' && (l.session === null || typeof l.session === 'string');
  return (
    l.kind === 'split' && typeof l.id === 'string' && (l.dir === 'row' || l.dir === 'column') && typeof l.ratio === 'number' && valid(l.a) && valid(l.b)
  );
}
