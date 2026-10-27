import { useSyncExternalStore } from 'react';
import { type Connection, connectLive, TOKEN } from './api';
import type { Edge, EntriesEvent, Endpoint, Event, Session, Subagent } from './protocol';

export interface Jump {
  session: string;
  entry: string;
  /** Changes on every jump, so jumping to the same entry twice still scrolls. */
  nonce: number;
}

/** Parts of the screen put away with their x (web) or C-Space t / C-Space x. */
export interface Hidden {
  tree: boolean;
  pane: boolean;
}

const HIDDEN_KEY = 'constellation.hidden';

function loadHidden(): Hidden {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? 'null') as Hidden | null;
    if (saved && typeof saved.tree === 'boolean' && typeof saved.pane === 'boolean') return saved;
  } catch {
    // no storage: show everything
  }
  return { tree: false, pane: false };
}

/** What floats over the panes: the launcher, or the stop confirmation for one session. */
export type Dialog = { kind: 'launcher' } | { kind: 'stop'; session: string };

export interface State {
  connection: Connection | 'no-token';
  sessions: Record<string, Session>;
  edges: Edge[];
  endpoints: Endpoint[];
  subagents: Subagent[];
  /** The session shown in the pane. */
  focused: string | null;
  jump: Jump | null;
  hidden: Hidden;
  dialog: Dialog | null;
  /** The session whose name is being edited in its pane header. */
  renaming: string | null;
  /** Bumped by C-Space a: the focused session's question or permission card takes the keys. */
  attention: number;
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
    focused: null,
    jump: null,
    hidden: loadHidden(),
    dialog: null,
    renaming: null,
    attention: 0,
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
        const { edges, endpoints, subagents } = event.snapshot;
        this.set({ sessions, edges, endpoints, subagents, focused: this.keepFocus(sessions) });
        break;
      }
      case 'session':
        this.set({ sessions: { ...this.state.sessions, [event.session.id]: event.session } });
        if (!this.state.focused) this.set({ focused: event.session.id });
        break;
      case 'session_removed': {
        const { [event.id]: _gone, ...sessions } = this.state.sessions;
        this.set({ sessions, focused: this.keepFocus(sessions) });
        break;
      }
      case 'graph':
        this.set({ edges: event.edges, endpoints: event.endpoints, subagents: event.subagents });
        break;
      case 'entries':
        for (const listener of this.entryListeners) listener(event);
        break;
    }
  }

  /** Keep the focused session if it still runs; otherwise focus the one that needs you, or the busiest. */
  private keepFocus(sessions: Record<string, Session>): string | null {
    if (this.state.focused && sessions[this.state.focused]) return this.state.focused;
    const all = Object.values(sessions);
    const pick = all.find((s) => s.status === 'waiting') ?? all.find((s) => s.status === 'working') ?? all[0];
    return pick?.id ?? null;
  }

  /** Opening a session shows the pane again if it was put away. */
  focus(id: string) {
    this.set({ focused: id });
    if (this.state.hidden.pane) this.toggle('pane');
  }

  jumpTo(session: string, entry: string) {
    this.set({ focused: session, jump: { session, entry, nonce: Date.now() } });
    if (this.state.hidden.pane) this.toggle('pane');
  }

  /** C-Space a (design system): the session waiting longest, its card focused. Again: the next one. */
  attend() {
    const waiting = Object.values(this.state.sessions)
      .filter((s) => s.status === 'waiting')
      .sort((a, b) => (a.pending[0]?.at ?? a.lastActivityAt ?? 0) - (b.pending[0]?.at ?? b.lastActivityAt ?? 0));
    if (!waiting.length) return;
    const at = waiting.findIndex((s) => s.id === this.state.focused);
    const next = waiting[at >= 0 && this.state.attention ? (at + 1) % waiting.length : 0];
    this.focus(next.id);
    this.set({ attention: Date.now() });
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
