import { beforeEach, describe, expect, it } from 'vitest';
import { type Layout, find, neighbor, pane, panes, rects, remove, resize, split, valid } from './panes';
import { store } from './store';
import { session } from './test/make';

describe('a layout of panes', () => {
  // a | b, with b split over c below it
  const a = pane('a');
  const b = pane('b');
  const c = pane('c');
  const layout = split(split(a, a.id, 'row', b), b.id, 'column', c);

  it('lists panes in reading order and knows where each one sits', () => {
    expect(panes(layout).map((p) => p.session)).toEqual(['a', 'b', 'c']);
    expect(rects(layout).get(c.id)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });

  it('moves to the nearest pane in a direction, and nowhere past the edge', () => {
    expect(neighbor(layout, a.id, 'right')).toBe(b.id); // both b and c touch a's edge: the one with more overlap, then first
    expect(neighbor(layout, b.id, 'down')).toBe(c.id);
    expect(neighbor(layout, c.id, 'left')).toBe(a.id);
    expect(neighbor(layout, a.id, 'left')).toBeNull();
  });

  it('closes a pane by giving its space to its sibling', () => {
    const rest = remove(layout, b.id) as Layout;
    expect(panes(rest).map((p) => p.session)).toEqual(['a', 'c']);
    expect(rects(rest).get(c.id)).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(remove(a, a.id)).toBeNull();
  });

  it('keeps a dragged split within reach of both sides', () => {
    expect((resize(layout, layout.id, 0.99) as Extract<Layout, { kind: 'split' }>).ratio).toBe(0.85);
  });

  it('only takes a saved layout that is well formed', () => {
    expect(valid(layout)).toBe(true);
    expect(valid({ kind: 'split', id: 's', dir: 'diagonal', ratio: 0.5, a, b })).toBe(false);
    expect(valid(null)).toBe(false);
  });
});

describe('the store keeps windows of panes', () => {
  const snapshot = (...sessions: ReturnType<typeof session>[]) =>
    store.apply({ type: 'snapshot', snapshot: { protocol: 1, generatedAt: 0, sessions, edges: [], endpoints: [], subagents: [], totals: { todayUsd: null } } });

  beforeEach(() => {
    const first = pane();
    store.set({ windows: [{ id: 'w1', layout: first }], win: 0, pane: first.id, focused: null, zoomed: false, dialog: null });
    snapshot(session({ id: 'a' }), session({ id: 'b', status: 'waiting' }), session({ id: 'c' }));
  });

  it('fills the focused pane with the session that needs you', () => {
    expect(store.state.focused).toBe('b');
  });

  it('opens a new session beside the focused one, and a session already shown where it is', () => {
    store.open('a');
    expect(panes(store.state.windows[0].layout).map((p) => p.session)).toEqual(['b', 'a']);
    expect(store.state.focused).toBe('a');
    store.focus('b');
    expect(store.state.focused).toBe('b');
    expect(panes(store.state.windows[0].layout)).toHaveLength(2); // shown already: no new pane
    store.focus('c'); // not shown: it takes the focused pane
    expect(panes(store.state.windows[0].layout).map((p) => p.session)).toEqual(['c', 'a']);
  });

  it('splits into an empty pane and asks which session goes there', () => {
    expect(store.splitPane('column')).toBe(true);
    expect(store.state.focused).toBeNull();
    expect(store.state.dialog).toEqual({ kind: 'goto' });
    store.focus('c');
    expect(panes(store.state.windows[0].layout).map((p) => p.session)).toEqual(['b', 'c']);
    store.movePane('up');
    expect(store.state.focused).toBe('b');
  });

  it('opens windows, moves between them, and closes the last pane of one with the window', () => {
    store.open('c', 'window');
    expect(store.state.win).toBe(1);
    expect(store.state.focused).toBe('c');
    store.selectWindow(1);
    expect(store.state.focused).toBe('b');
    store.nextWindow(1);
    expect(store.state.focused).toBe('c');
    store.closePane();
    expect(store.state.windows).toHaveLength(1);
    expect(store.state.focused).toBe('b');
  });

  it('empties a pane whose session left, and gives it the one that replaces it', () => {
    store.open('a');
    store.focusPane(find(store.state.windows[0].layout, store.state.pane)!.id);
    store.focus('b'); // the left pane, focused
    store.apply({ type: 'session_removed', id: 'a' }); // the right pane's session
    const right = panes(store.state.windows[0].layout)[1];
    expect(right.session).toBeNull();
    expect(right.gone).toBe('a');
    store.apply({ type: 'session', session: session({ id: 'a2', replaces: 'a' }) });
    expect(panes(store.state.windows[0].layout)[1].session).toBe('a2');
    expect(store.state.focused).toBe('b'); // focus stays where you are
  });
});
