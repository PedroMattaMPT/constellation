import { beforeEach, describe, expect, it } from 'vitest';
import { store } from './store';
import { session } from './test/make';

const snapshot = (...sessions: ReturnType<typeof session>[]) => ({
  type: 'snapshot' as const,
  snapshot: { protocol: 1, generatedAt: 0, sessions, edges: [], endpoints: [], subagents: [], totals: { todayUsd: null } },
});

describe('the store', () => {
  beforeEach(() => store.set({ focused: null, selected: [], link: null }));

  it('focuses the session that needs you first', () => {
    store.apply(snapshot(session({ id: 'a' }), session({ id: 'b', status: 'waiting' })));
    expect(store.state.focused).toBe('b');
  });

  it('follows a session to the one that replaces it (adopted, rewound)', () => {
    store.apply(snapshot(session({ id: 'old' }), session({ id: 'other' })));
    store.focus('old');
    store.apply({ type: 'session_removed', id: 'old' });
    expect(store.state.focused).toBe('other');
    store.apply({ type: 'session', session: session({ id: 'new', replaces: 'old' }) });
    expect(store.state.focused).toBe('new');
  });

  it('drops a session that left from the selection', () => {
    store.apply(snapshot(session({ id: 'a' }), session({ id: 'b' })));
    store.select('a');
    store.select('b');
    store.select('b');
    expect(store.state.selected).toEqual(['a']);
    store.apply({ type: 'session_removed', id: 'a' });
    expect(store.state.selected).toEqual([]);
  });

  it('goes to the session waiting longest, then the next', () => {
    store.apply(snapshot(session({ id: 'late', status: 'waiting', lastActivityAt: 20 }), session({ id: 'early', status: 'waiting', lastActivityAt: 10 })));
    store.set({ attention: 0 });
    store.attend();
    expect(store.state.focused).toBe('early');
    store.attend();
    expect(store.state.focused).toBe('late');
  });
});
