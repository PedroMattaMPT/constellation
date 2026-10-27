import { describe, expect, it } from 'vitest';
import { entry, session } from './test/make';
import { type Row, label, place, slashless } from './Tree';

describe('tree rows', () => {
  it('draw guides for every ancestor that has a later sibling', () => {
    const rows: Row[] = [
      { key: 'p1', depth: 0, type: 'project', cwd: '/a', name: 'a', count: 2 },
      { key: 's1', depth: 1, type: 'session', session: session({ id: 's1' }), n: 1 },
      { key: 't1', depth: 2, type: 'turn', session: 's1', turn: { turn: 1, entry: entry({ id: 'p' }), entries: 1, attention: false, abandoned: false } },
      { key: 's2', depth: 1, type: 'session', session: session({ id: 's2' }), n: 2 },
    ];
    const placed = place(rows, () => false);
    expect(placed.map((r) => [r.key, r.last, r.guides])).toEqual([
      ['p1', true, []],
      ['s1', false, []],
      ['t1', true, [true]], // s1 has a sibling below: the guide continues
      ['s2', true, []],
    ]);
  });

  it('label a slash command without repeating its glyph', () => {
    expect(slashless(entry({ id: 'x', kind: 'compact', text: '/compact' }))).toBe('compact');
    const tool: Row = { key: 'e', depth: 3, type: 'entry', session: 's1', entry: entry({ id: 'x', kind: 'tool', tool: 'Bash', detail: 'make' }) };
    expect(label(tool)).toBe('Bash make');
  });
});
