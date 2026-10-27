import { describe, expect, it } from 'vitest';
import { count, rank } from './Prompt';
import type { CommandInfo } from './protocol';

const command = (name: string, aliases: string[] = []): CommandInfo => ({ name, description: '', argumentHint: '', source: 'built-in', aliases, unavailable: null });

describe('the / menu ranking', () => {
  const commands = [command('context'), command('compact'), command('usage', ['cost']), command('api-docs'), command('clear')];

  it('puts prefix and alias matches first, then the rest that contain the query', () => {
    expect(rank(commands, 'co', 's1').map((c) => c.name)).toEqual(['compact', 'context', 'usage']);
    expect(rank(commands, 'c', 's1').map((c) => c.name)).toEqual(['clear', 'compact', 'context', 'usage', 'api-docs']);
  });

  it('ranks what you ran in this session before the alphabet', () => {
    count('s2', '/context now');
    expect(rank(commands, 'co', 's2').map((c) => c.name)).toEqual(['context', 'compact', 'usage']);
    expect(rank(commands, 'co', 's1')[0].name).toBe('compact'); // per session
  });
});
