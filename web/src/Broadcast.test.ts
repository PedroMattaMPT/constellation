import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { broadcast, note } from './Broadcast';
import { session } from './test/make';

describe('sending one prompt to several sessions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('says what each session will do with it, in the design system words', () => {
    expect(note(session({ id: 'a', status: 'waiting' })).text).toBe('answer its question first: the prompt queues');
    expect(note(session({ id: 'a', status: 'working' })).text).toBe('queued after this turn');
    expect(note(session({ id: 'a', mode: 'plan' })).text).toBe('will only plan');
    expect(note(session({ id: 'a', kind: 'external', inbox: true })).text).toBe('arrives as a peer message');
    expect(note(session({ id: 'a', kind: 'external', inbox: false })).reachable).toBe(false);
  });

  it('prompts managed sessions, messages terminal ones, and reports the ones that failed', async () => {
    const prompt = vi.spyOn(api, 'prompt').mockResolvedValue({ queued: 0 });
    const message = vi.spyOn(api, 'message').mockRejectedValue(new Error('inbox gone'));
    const failed = await broadcast([session({ id: 'm', name: 'mine' }), session({ id: 't', name: 'term', kind: 'external', inbox: true })], 'run the tests');
    expect(prompt).toHaveBeenCalledWith('m', 'run the tests');
    expect(message).toHaveBeenCalledWith('t', 'run the tests');
    expect(failed).toEqual([{ name: 'term', why: 'inbox gone' }]);
  });
});
