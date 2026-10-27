import { describe, expect, it } from 'vitest';
import { type Box, nearest } from './Map';

describe('moving between nodes', () => {
  const box = (x: number, y: number): Box => ({ x, y, w: 100, h: 40 });
  const boxes = new Map([
    ['here', box(0, 0)],
    ['right', box(300, 10)],
    ['far-right', box(800, 0)],
    ['below', box(0, 200)],
    ['diagonal', box(200, 200)],
  ]);
  const ids = [...boxes.keys()];
  const go = (dx: number, dy: number) => nearest(boxes, ids, 'here', [dx, dy], false);

  it('pick the nearest node mostly along the direction', () => {
    expect(go(1, 0)).toBe('right');
    expect(go(0, 1)).toBe('below');
  });

  it('stay put when nothing lies that way', () => {
    expect(go(-1, 0)).toBeNull();
    expect(go(0, -1)).toBeNull();
  });
});
