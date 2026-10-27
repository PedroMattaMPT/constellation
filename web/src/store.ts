import { useSyncExternalStore } from 'react';
import { type Connection, api, connectLive, TOKEN } from './api';
import { type Direction, type Layout, type Win, find, mapPanes, neighbor, newId, pane, panes, remove, resize, split, valid } from './panes';
import type { Edge, EntriesEvent, Endpoint, Event, HookStatus, Session, Subagent, Totals } from './protocol';

export interface Jump {
  session: string;
  entry: string;
  /** Changes on every jump, so jumping to the same entry twice still scrolls. */
  nonce: number;
}

/** Parts of the screen put away with their x (web) or C-Space t / C-Space x / C-Space g. */
export interface Hidden {
  tree: boolean;
  pane: boolean;
  map: boolean;
}

const HIDDEN_KEY = 'constellation.hidden';
/** The design system's three layouts (roadmap 5.5): all of it, then the tree as an overlay and compact nodes, then one
 * pane at a time with the map as window 0. */
export type Screen = 'wide' | 'medium' | 'narrow';
export function screenFor(width: number): Screen {
  return width >= 1280 ? 'wide' : width >= 960 ? 'medium' : 'narrow';
}
const PANES_KEY = 'constellation.panes';
// A split leaves each half at least this big (px), or the session opens in a window of its own.
const MIN_PANE_W = 360;
const MIN_PANE_H = 240;

function loadHidden(): Hidden {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? 'null') as Partial<Hidden> | null;
    if (saved && typeof saved.tree === 'boolean' && typeof saved.pane === 'boolean') return { map: false, ...saved } as Hidden;
  } catch {
    // no storage: show everything
  }
  return { tree: false, pane: false, map: false };
}

interface Panes {
  windows: Win[];
  win: number;
  pane: string;
}

/** The windows as you left them in this browser; their sessions settle once the first snapshot arrives. */
function loadPanes(): Panes {
  try {
    const saved = JSON.parse(localStorage.getItem(PANES_KEY) ?? 'null') as Panes | null;
    if (saved && Array.isArray(saved.windows) && saved.windows.length && saved.windows.every((w) => typeof w?.id === 'string' && valid(w.layout))) {
      const win = Math.min(Math.max(0, saved.win | 0), saved.windows.length - 1);
      const ids = panes(saved.windows[win].layout).map((p) => p.id);
      return { windows: saved.windows, win, pane: ids.includes(saved.pane) ? saved.pane : ids[0] };
    }
  } catch {
    // no storage, or not ours: one window, one pane
  }
  const first = pane();
  return { windows: [{ id: newId('w'), layout: first }], win: 0, pane: first.id };
}

/**
 * What floats over the panes (design system: the floating layer): the launcher and the resume picker, or a dialog,
 * picker or card for one session.
 */
export type Dialog =
  | { kind: 'launcher' }
  | { kind: 'resume' }
  | { kind: 'hooks' }
  | { kind: 'stop' | 'model' | 'mode' | 'context' | 'mcp' | 'rewind' | 'adopt' | 'clear' | 'usage'; session: string }
  | { kind: 'image'; session: string; entry: string; n: number }
  | { kind: 'waiting' | 'goto' | 'keys' | 'find' | 'broadcast' };

/** The messages between two sessions, opened from their edge on the map. */
export interface Link {
  source: string;
  target: string;
}

export interface State {
  connection: Connection | 'no-token';
  sessions: Record<string, Session>;
  edges: Edge[];
  endpoints: Endpoint[];
  subagents: Subagent[];
  /** Across the machine: today's cost. */
  totals: Totals;
  /** Windows of panes (design system: tmux windows, 1 and up; 0 is the map). */
  windows: Win[];
  /** The window shown below the map: an index into `windows`. */
  win: number;
  /** The focused pane. `focused` is the session it shows. */
  pane: string;
  /** C-Space z: the focused pane over the map and the other panes. */
  zoomed: boolean;
  /** Bumped when a key moves between panes: the newly focused one takes the keys. */
  paneFocus: number;
  /** C-Space [: the pane whose conversation the vi keys scroll, until q or esc. */
  scroll: string | null;
  screen: Screen;
  /** Below 1280 px the tree is an overlay: open or not (C-Space t). */
  treeOpen: boolean;
  /** Below 960 px the map is window 0, shown instead of the pane (C-Space 0, C-Space g). */
  mapShown: boolean;
  /** The session in the focused pane. */
  focused: string | null;
  jump: Jump | null;
  hidden: Hidden;
  dialog: Dialog | null;
  /** The session whose name is being edited in its pane header. */
  renaming: string | null;
  /** Bumped by C-Space a: the focused session's question or permission card takes the keys. */
  attention: number;
  /** Bumped by C-Space 0: the map takes the keys. */
  mapFocus: number;
  /** C-Space : is open over the status bar. */
  command: boolean;
  /** Sessions picked on the map (space), for sending one prompt to several (roadmap 5.3). */
  selected: string[];
  /** The edge whose messages the tree shows. */
  link: Link | null;
  /** Text to put back in a session's prompt box: the prompt a rewind went back to. */
  draft: { session: string; text: string; nonce: number } | null;
  /** Whether the hooks that show a terminal session's questions are installed (roadmap 3.12). */
  hooks: HookStatus | null;
  /** What the server did on its own and failed at (adopting a session), until dismissed. */
  notices: Array<{ text: string; at: number }>;
  /** Ticks every few seconds so "12s ago" stays true. */
  now: number;
}

type Listener = () => void;
type EntriesListener = (event: EntriesEvent) => void;

class Store {
  state: State = {
    connection: TOKEN ? 'connecting' : 'no-token',
    sessions: {},
    edges: [],
    endpoints: [],
    subagents: [],
    totals: { todayUsd: null },
    ...loadPanes(),
    zoomed: false,
    paneFocus: 0,
    scroll: null,
    screen: typeof window === 'undefined' || !window.innerWidth ? 'wide' : screenFor(window.innerWidth),
    treeOpen: false,
    mapShown: false,
    focused: null,
    jump: null,
    hidden: loadHidden(),
    dialog: null,
    renaming: null,
    attention: 0,
    mapFocus: 0,
    command: false,
    selected: [],
    link: null,
    draft: null,
    hooks: null,
    notices: [],
    now: Date.now(),
  };
  private listeners = new Set<Listener>();
  private entryListeners = new Set<EntriesListener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Entries are not kept here: each view keeps the pages it shows and listens for updates. */
  onEntries(listener: EntriesListener) {
    this.entryListeners.add(listener);
    return () => {
      this.entryListeners.delete(listener);
    };
  }

  set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  apply(event: Event) {
    switch (event.type) {
      case 'snapshot': {
        const sessions = Object.fromEntries(event.snapshot.sessions.map((s) => [s.id, s]));
        const { edges, endpoints, subagents, totals } = event.snapshot;
        this.set({ sessions, edges, endpoints, subagents, totals });
        this.settle();
        break;
      }
      case 'session': {
        const fresh = !this.state.sessions[event.session.id];
        this.set({ sessions: { ...this.state.sessions, [event.session.id]: event.session } });
        // It arrived late (a pane opened it before the server saw it), or took over from another: back in its pane.
        if (fresh) this.replace(event.session.id, event.session.id);
        if (fresh && event.session.replaces) this.replace(event.session.replaces, event.session.id);
        if (!this.state.focused) this.settle();
        break;
      }
      case 'session_removed': {
        const { [event.id]: _gone, ...sessions } = this.state.sessions;
        const selected = this.state.selected.filter((id) => id !== event.id);
        this.set({ sessions, selected });
        this.settle();
        break;
      }
      case 'graph':
        this.set({ edges: event.edges, endpoints: event.endpoints, subagents: event.subagents });
        break;
      case 'entries':
        for (const listener of this.entryListeners) listener(event);
        break;
      case 'totals':
        this.set({ totals: event.totals });
        break;
      case 'notice':
        this.set({ notices: [...this.state.notices, { text: event.text, at: event.at }] });
        break;
    }
  }

  // ── Panes and windows (roadmap 5.1) ──────────────────────────────────────

  private get layout(): Layout {
    return this.state.windows[this.state.win].layout;
  }

  /** New windows in place: `focused` follows the focused pane, each window remembers its own, and they're saved. */
  private place(windows: Win[], win: number, paneId: string, extra: Partial<State> = {}) {
    const there = find(windows[win].layout, paneId) ?? panes(windows[win].layout)[0];
    const placed = windows.map((w, i) => (i === win ? { ...w, focus: there.id } : w));
    this.set({ windows: placed, win, pane: there.id, focused: there.session, ...extra });
    try {
      localStorage.setItem(PANES_KEY, JSON.stringify({ windows: placed, win, pane: there.id }));
    } catch {
      // not remembered, still works
    }
  }

  private withLayout(layout: Layout, win = this.state.win): Win[] {
    return this.state.windows.map((w, i) => (i === win ? { ...w, layout } : w));
  }

  /** Where a session is shown: the current window first. */
  private shown(id: string): { win: number; pane: string } | null {
    const { windows, win } = this.state;
    for (const i of [win, ...windows.map((_, j) => j).filter((j) => j !== win)]) {
      const there = panes(windows[i].layout).find((p) => p.session === id);
      if (there) return { win: i, pane: there.id };
    }
    return null;
  }

  /**
   * After sessions come and go: a pane whose session left the map empties, keeping its name for one that replaces it
   * (adopted, rewound). The focused pane never stays empty while sessions run: it takes the one that needs you, or
   * the busiest, not already shown.
   */
  private settle() {
    const { sessions } = this.state;
    let windows = this.state.windows.map((w) => ({
      ...w,
      layout: mapPanes(w.layout, (p) => (p.session && !sessions[p.session] ? { ...p, session: null, gone: p.session } : p)),
    }));
    const focusedPane = find(windows[this.state.win].layout, this.state.pane);
    if (focusedPane && !focusedPane.session) {
      const shown = new Set(windows.flatMap((w) => panes(w.layout).map((p) => p.session)));
      const all = Object.values(sessions);
      const free = all.filter((s) => !shown.has(s.id));
      const pick = [free, all].map((list) => list.find((s) => s.status === 'waiting') ?? list.find((s) => s.status === 'working') ?? list[0]).find(Boolean);
      if (pick) {
        windows = windows.map((w, i) =>
          i === this.state.win ? { ...w, layout: mapPanes(w.layout, (p) => (p.id === focusedPane.id ? { ...p, session: pick.id } : p)) } : w,
        );
      }
    }
    this.place(windows, this.state.win, this.state.pane);
  }

  /** A session that took over from another (adopted, rewound) goes where that one was. */
  private replace(old: string, fresh: string) {
    let moved = false;
    const windows = this.state.windows.map((w) => ({
      ...w,
      layout: mapPanes(w.layout, (p) => {
        if (p.gone !== old && p.session !== old) return p;
        moved = true;
        return { ...p, session: fresh, gone: null };
      }),
    }));
    if (moved) this.place(windows, this.state.win, this.state.pane);
  }

  /** C-Space t: the tree beside the map, or over it below 1280 px. */
  toggleTree() {
    if (this.state.screen === 'wide') this.toggle('tree');
    else this.set({ treeOpen: !this.state.treeOpen });
  }

  /** C-Space g: the map shown or put away; below 960 px, the map window or the pane. */
  toggleMap() {
    if (this.state.screen === 'narrow') this.set({ mapShown: !this.state.mapShown, mapFocus: Date.now() });
    else this.toggle('map');
  }

  /** C-Space 0: the map takes the keys; below 960 px it's a window of its own. */
  showMap() {
    this.set({ mapFocus: Date.now(), ...(this.state.screen === 'narrow' ? { mapShown: true } : {}) });
  }

  /** Opens a session: where it's shown already, else in the focused pane. Shows the panes if they were put away. */
  focus(id: string) {
    this.set({ mapShown: false, treeOpen: false });
    const at = this.shown(id);
    if (at) this.place(this.state.windows, at.win, at.pane);
    else {
      const layout = mapPanes(this.layout, (p) => (p.id === this.state.pane ? { ...p, session: id, gone: null } : p));
      this.place(this.withLayout(layout), this.state.win, this.state.pane);
    }
    if (this.state.hidden.pane) this.toggle('pane');
  }

  /** Another pane takes focus; from the keyboard, it takes the keys too. */
  focusPane(id: string, keys = false) {
    const win = this.state.windows.findIndex((w) => find(w.layout, id));
    if (win >= 0) this.place(this.state.windows, win, id, keys ? { paneFocus: Date.now() } : {});
  }

  /** How to split the focused pane: across its longer side, or as asked. Null when a half would be too small. */
  private splitDir(dir?: 'row' | 'column'): 'row' | 'column' | null {
    const box = typeof document === 'undefined' ? null : document.querySelector(`[data-pane="${this.state.pane}"]`)?.getBoundingClientRect();
    if (!box) return dir ?? 'row';
    const chosen = dir ?? (box.width >= box.height * 2 ? 'row' : 'column');
    return (chosen === 'row' ? box.width / 2 < MIN_PANE_W : box.height / 2 < MIN_PANE_H) ? null : chosen;
  }

  /** A new session (launcher, resume, fork) in a pane of its own beside the focused one, or a window of its own. */
  open(id: string, where: 'pane' | 'window' = 'pane') {
    this.set({ mapShown: false });
    const fresh = pane(id);
    const dir = where === 'pane' ? this.splitDir() : null;
    if (!dir) {
      const windows = [...this.state.windows, { id: newId('w'), layout: fresh }];
      this.place(windows, windows.length - 1, fresh.id, { zoomed: false });
    } else {
      this.place(this.withLayout(split(this.layout, this.state.pane, dir, fresh)), this.state.win, fresh.id, { zoomed: false });
    }
    if (this.state.hidden.pane) this.toggle('pane');
  }

  /** C-Space % and C-Space ": an empty pane beside or below the focused one, and the go-to picker to fill it. */
  splitPane(dir: 'row' | 'column'): boolean {
    if (this.state.screen === 'narrow' || !this.splitDir(dir)) return false; // one pane at a time there
    const fresh = pane();
    this.place(this.withLayout(split(this.layout, this.state.pane, dir, fresh)), this.state.win, fresh.id, { zoomed: false, dialog: { kind: 'goto' } });
    if (this.state.hidden.pane) this.toggle('pane');
    return true;
  }

  /** :window (tmux's new-window): a window with one empty pane, and the go-to picker to fill it. */
  newWindow() {
    this.set({ mapShown: false });
    const fresh = pane();
    const windows = [...this.state.windows, { id: newId('w'), layout: fresh }];
    this.place(windows, windows.length - 1, fresh.id, { zoomed: false, dialog: { kind: 'goto' } });
    if (this.state.hidden.pane) this.toggle('pane');
  }

  /** C-Space x: closes the focused pane; the session keeps running. The very last pane is put away instead (web). */
  closePane() {
    const order = panes(this.layout);
    const at = order.findIndex((p) => p.id === this.state.pane);
    const rest = remove(this.layout, this.state.pane);
    if (rest) {
      const next = order[at + 1] ?? order[at - 1];
      this.place(this.withLayout(rest), this.state.win, next.id, { zoomed: false, paneFocus: Date.now() });
    } else if (this.state.windows.length > 1) {
      const windows = this.state.windows.filter((_, i) => i !== this.state.win);
      const win = Math.min(this.state.win, windows.length - 1);
      this.place(windows, win, windows[win].focus ?? panes(windows[win].layout)[0].id, { zoomed: false, paneFocus: Date.now() });
    } else this.toggle('pane');
  }

  /** C-Space h j k l and the arrows. */
  movePane(direction: Direction) {
    const id = neighbor(this.layout, this.state.pane, direction);
    if (id) this.focusPane(id, true);
  }

  /** C-Space o: the next pane in the window. */
  nextPane() {
    const order = panes(this.layout);
    const at = order.findIndex((p) => p.id === this.state.pane);
    if (order.length > 1) this.focusPane(order[(at + 1) % order.length].id, true);
  }

  /** C-Space 1-9: that window, at the pane it had focused. */
  selectWindow(n: number) {
    const w = this.state.windows[n - 1];
    if (!w) return;
    this.set({ mapShown: false });
    this.place(this.state.windows, n - 1, w.focus ?? panes(w.layout)[0].id, { zoomed: false, paneFocus: Date.now() });
    if (this.state.hidden.pane) this.toggle('pane');
  }

  /** C-Space n and p. */
  nextWindow(step: 1 | -1) {
    const count = this.state.windows.length;
    if (count > 1) this.selectWindow(((this.state.win + step + count) % count) + 1);
  }

  /** C-Space z. */
  zoom() {
    this.set({ zoomed: !this.state.zoomed });
    if (this.state.hidden.pane) this.toggle('pane');
  }

  /** A gutter dragged. Saved on release, not on every move. */
  resizeSplit(id: string, ratio: number, done = false) {
    const windows = this.withLayout(resize(this.layout, id, ratio));
    if (done) this.place(windows, this.state.win, this.state.pane);
    else this.set({ windows });
  }

  jumpTo(session: string, entry: string) {
    this.focus(session);
    this.set({ jump: { session, entry, nonce: Date.now() } });
  }

  /** C-Space a (design system): the session waiting longest, its card focused. Again: the next one. */
  attend() {
    const waiting = waitingOldestFirst(this.state.sessions);
    if (!waiting.length) return;
    const at = waiting.findIndex((s) => s.id === this.state.focused);
    this.attendTo(waiting[at >= 0 && this.state.attention ? (at + 1) % waiting.length : 0].id);
  }

  /** One session's question or permission card takes the keys. */
  attendTo(id: string) {
    this.focus(id);
    this.set({ attention: Date.now() });
  }

  /** space on the map: add a session to the selection, or take it out. */
  select(id: string) {
    const { selected } = this.state;
    this.set({ selected: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  }

  openLink(source: string, target: string) {
    this.set({ link: { source, target } });
    if (this.state.hidden.tree) this.toggle('tree');
  }

  async refreshHooks() {
    try {
      this.set({ hooks: await api.hooks() });
    } catch {
      // unknown: the pane simply doesn't offer them
    }
  }

  toggle(part: keyof Hidden) {
    const hidden = { ...this.state.hidden, [part]: !this.state.hidden[part] };
    this.set({ hidden });
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
    } catch {
      // not remembered, still works
    }
  }

  start() {
    if (!TOKEN) return () => {};
    const stop = connectLive(
      (event) => this.apply(event),
      (connection) => this.set({ connection }),
    );
    const tick = window.setInterval(() => this.set({ now: Date.now() }), 5000);
    void this.refreshHooks();
    return () => {
      stop();
      window.clearInterval(tick);
    };
  }
}

export const store = new Store();

export function useStore<T>(select: (state: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.state));
}

/** Sessions in a stable order (oldest first), numbered from 1 like tmux windows. */
export function numbered(sessions: Record<string, Session>): Array<{ n: number; session: Session }> {
  return Object.values(sessions)
    .sort((a, b) => a.startedAt - b.startedAt || a.pid - b.pid)
    .map((session, i) => ({ n: i + 1, session }));
}

/** What waits for you, the longest waiting first (design system: C-Space a, C-Space A). */
export function waitingOldestFirst(sessions: Record<string, Session>): Session[] {
  const since = (s: Session) => s.pending[0]?.at ?? s.lastActivityAt ?? 0;
  return Object.values(sessions)
    .filter((s) => s.status === 'waiting')
    .sort((a, b) => since(a) - since(b));
}
