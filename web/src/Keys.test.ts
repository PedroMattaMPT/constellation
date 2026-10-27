import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { COMMANDS, applyTheme, matchSessions, run } from './Keys';
import { numbered, store, waitingOldestFirst } from './store';
import { session } from './test/make';

const items = numbered({
  a: session({ id: 'a', name: 'auth', project: 'api', startedAt: 1 }),
  b: session({ id: 'b', name: 'docs', project: 'site', startedAt: 2 }),
  c: session({ id: 'c', name: 'limits', project: 'auth-service', startedAt: 3 }),
});

describe("go to a session (C-Space ')", () => {
  it('takes a number as the session with that number', () => {
    expect(matchSessions(items, '2').map((x) => x.session.id)).toEqual(['b']);
  });

  it('puts names that start with the query before names and projects that only have it', () => {
    expect(matchSessions(items, 'auth').map((x) => x.session.id)).toEqual(['a', 'c']);
  });

  it('shows everything for an empty query, and nothing for no match', () => {
    expect(matchSessions(items, ' ')).toHaveLength(3);
    expect(matchSessions(items, 'zzz')).toEqual([]);
  });
});

describe('everything waiting (C-Space A)', () => {
  it('lists the session waiting longest first, by its open request', () => {
    const sessions = {
      new: session({ id: 'new', status: 'waiting', lastActivityAt: 5, pending: [{ id: 'p', kind: 'permission', tool: 'Bash', input: {}, rules: [], at: 30, source: 'sdk' }] }),
      old: session({ id: 'old', status: 'waiting', lastActivityAt: 20 }),
      busy: session({ id: 'busy', status: 'working', lastActivityAt: 1 }),
    };
    expect(waitingOldestFirst(sessions).map((s) => s.id)).toEqual(['old', 'new']);
  });
});

describe('the command prompt (C-Space :)', () => {
  beforeEach(() => {
    store.set({
      sessions: {
        m: session({ id: 'm', name: 'mine', tasks: [{ id: 'task-1234567', description: 'watch the tests', type: 'local_bash' }] }),
        t: session({ id: 't', name: 'term', kind: 'external' }),
      },
      focused: 'm',
      dialog: null,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('knows every command it offers', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const answered = await Promise.all(COMMANDS.map(([name]) => run(name)));
    expect(answered.filter((why) => typeof why === 'string' && why.startsWith('no such command'))).toEqual([]);
  });

  it('says why an unknown command does nothing', async () => {
    expect(await run('frobnicate')).toBe('no such command: frobnicate');
  });

  it('opens the picker for a command given nothing, and sets the value given one', async () => {
    const setModel = vi.spyOn(api, 'setModel').mockResolvedValue(undefined as never);
    expect(await run('model')).toBeNull();
    expect(store.state.dialog).toEqual({ kind: 'model', session: 'm' });
    expect(await run(':model opus')).toBeNull();
    expect(setModel).toHaveBeenCalledWith('m', 'opus');
  });

  it('checks the effort and mode before sending them, and leaves bypass to its own second key', async () => {
    const setMode = vi.spyOn(api, 'setMode').mockResolvedValue(undefined as never);
    expect(await run('effort loud')).toMatch(/^effort low, medium/);
    expect(await run('mode plan')).toBeNull();
    expect(setMode).toHaveBeenCalledWith('m', 'plan');
    expect(await run('mode bypassPermissions')).toBeNull();
    expect(store.state.dialog).toEqual({ kind: 'mode', session: 'm' });
    expect(setMode).toHaveBeenCalledTimes(1);
  });

  it('stops the only background task, or the one named by the start of its id', async () => {
    const stopTask = vi.spyOn(api, 'stopTask').mockResolvedValue(undefined as never);
    expect(await run('stop-task')).toBeNull();
    expect(await run('stop-task task-12')).toBeNull();
    expect(stopTask.mock.calls).toEqual([['m', 'task-1234567'], ['m', 'task-1234567']]);
    expect(await run('stop-task nope')).toMatch(/^which one\?/);
  });

  it('asks you to adopt a terminal session before acting on it', async () => {
    store.set({ focused: 't' });
    expect(await run('compact')).toBe('term is external: adopt it first');
    expect(await run('adopt')).toBeNull();
    expect(store.state.dialog).toEqual({ kind: 'adopt', session: 't' });
  });

  it('shows and changes the limits, and opens the usage card for any session', async () => {
    const setLimits = vi.spyOn(api, 'setLimits').mockResolvedValue({ memoryGb: 12, gpuGb: 16, cpuPercent: 200 });
    expect(await run('limit mem 12')).toEqual({ info: 'limits: memory 12 GB · GPU 16 GB · CPU 200% for 5m' });
    expect(setLimits).toHaveBeenCalledWith({ memoryGb: 12 });
    expect(await run('limit gpu lots')).toBe('limit mem <GB>, gpu <GB>, cpu <percent>, or reset');
    store.set({ focused: 't' });
    expect(await run('usage')).toBeNull();
    expect(store.state.dialog).toEqual({ kind: 'usage', session: 't' });
  });

  it('is dark unless you chose light or auto, and remembers that choice', async () => {
    const saved = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => saved.set(k, v), removeItem: (k: string) => saved.delete(k) });
    vi.stubGlobal('document', { documentElement: { dataset: {} as Record<string, string> } });
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(await run('theme light')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(saved.get('constellation.theme')).toBe('light');
    expect(await run('theme auto')).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined(); // the system's light or dark
    applyTheme();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(await run('theme dark')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(saved.size).toBe(0);
    expect(await run('theme pink')).toBe('theme light, dark or auto');
  });
});
