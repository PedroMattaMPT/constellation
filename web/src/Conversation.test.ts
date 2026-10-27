import { describe, expect, it } from 'vitest';
import { lines, records, runOf, withRecords } from './Conversation';
import { entry, session } from './test/make';

describe('conversation lines', () => {
  const entries = [
    entry({ id: 'a', turn: 1 }),
    entry({ id: 'b', turn: 2, abandoned: true }),
    entry({ id: 'c', turn: 2, abandoned: true }),
    entry({ id: 'd', turn: 3, abandoned: true }),
    entry({ id: 'e', turn: 4 }),
    entry({ id: 'f', turn: 5, sessionId: 's2' }),
  ];

  it('fold a run a rewind left behind into one rule that counts its turns', () => {
    const drawn = lines(entries, new Set());
    expect(drawn.map((l) => (l.kind === 'entry' ? l.entry.id : l.kind === 'rewound' ? `rewound:${l.turns}` : l.kind))).toEqual(['a', 'rewound:2', 'e', 'f']);
  });

  it('show the run, marked, once opened', () => {
    const drawn = lines(entries, new Set(['b']));
    expect(drawn.filter((l) => l.kind === 'entry' && l.abandoned).map((l) => (l.kind === 'entry' ? l.entry.id : ''))).toEqual(['b', 'c', 'd']);
  });

  it('draw the cleared rule where a new transcript starts', () => {
    const cleared = lines(entries, new Set()).filter((l) => l.kind === 'entry' && l.cleared);
    expect(cleared.map((l) => (l.kind === 'entry' ? l.entry.id : ''))).toEqual(['f']);
  });

  it('find the run a jump lands in', () => {
    expect(runOf(entries, 'c')).toBe('b');
    expect(runOf(entries, 'e')).toBeNull();
  });
});

describe('fork records', () => {
  const at = (minute: number) => `2026-10-27T12:0${minute}:00Z`;
  const entries = [entry({ id: 'a', at: at(1) }), entry({ id: 'b', at: at(3) }), entry({ id: 'c', at: at(5) })];
  const forked = session({ id: 's', forks: [{ session: 'child', name: 'lab-fork', at: Date.parse(at(4)) }] });

  it('go after the last entry written before the fork', () => {
    const drawn = withRecords(lines(entries, new Set()), records(forked), false, false);
    expect(drawn.map((l) => (l.kind === 'record' ? `${l.text} ${l.detail}` : l.kind === 'entry' ? l.entry.id : l.kind))).toEqual(['a', 'b', 'fork → lab-fork', 'c']);
  });

  it('wait for the page they belong to', () => {
    const early = session({ id: 's', forkOf: { session: null, name: 'lab', at: Date.parse(at(0)) } });
    expect(withRecords(lines(entries, new Set()), records(early), true, false).some((l) => l.kind === 'record')).toBe(false);
    expect(withRecords(lines(entries, new Set()), records(early), false, false)[0]).toMatchObject({ kind: 'record', detail: 'from lab' });
  });
});
