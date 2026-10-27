import { describe, expect, it } from 'vitest';
import { ago, count, gb, msgType, shortModel } from './format';

describe('formatting', () => {
  it('writes times short and relative', () => {
    expect([ago(Date.now() - 4_000, Date.now()), ago(Date.now() - 12 * 60_000, Date.now()), ago(null, Date.now())]).toEqual(['4s', '12m', '']);
  });

  it('writes tokens in thousands and memory in GB', () => {
    expect([count(950), count(182_400), count(33_220_575), count(2_000_000)]).toEqual(['950', '182k', '33.2M', '2M']);
    expect([gb(1.25 * 1024 ** 3), gb(20 * 1024 ** 3)]).toEqual(['1.3 GB', '20 GB']);
  });

  it('writes model ids as the design system does', () => {
    expect(shortModel('claude-opus-5-5')).toBe('opus-5.5');
    expect(shortModel('claude-haiku-4-5-20251001')).toBe('haiku-4.5-20251001');
    expect(shortModel('claude-fable-5')).toBe('fable-5');
  });

  it('gives conversation-only kinds the closest message glyph', () => {
    expect([msgType('compact'), msgType('interrupt'), msgType('thinking'), msgType('tool')]).toEqual(['slash', 'denied', 'reply', 'tool']);
  });
});
