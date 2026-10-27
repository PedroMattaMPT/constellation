import { describe, expect, it } from 'vitest';
import { notes } from './Notify';
import type { PendingRequest, Session } from './protocol';
import { session } from './test/make';

const all = (...sessions: Session[]) => Object.fromEntries(sessions.map((s) => [s.id, s]));
const ask = (id: string, over: Partial<PendingRequest> = {}): PendingRequest => ({
  id, kind: 'permission', tool: 'Bash', input: { command: 'psql -d app_dev -f migrations/0042_tokens.sql' }, rules: [], at: 1, source: 'sdk', ...over,
});

describe('notifications', () => {
  it('tell you when a session starts waiting, with what it asks', () => {
    const idle = session({ id: 'a', name: 'auth' });
    const waiting = session({ id: 'a', name: 'auth', status: 'waiting', pending: [ask('p1')] });
    expect(notes(all(idle), all(waiting))).toEqual([
      { session: 'a', title: '? auth needs you', body: 'Bash: psql -d app_dev -f migrations/0042_tokens.sql', attend: true },
    ]);
    expect(notes(all(waiting), all(waiting))).toEqual([]); // still the same question: nothing new
    const next = session({ id: 'a', name: 'auth', status: 'waiting', pending: [ask('p2', { kind: 'question', tool: 'AskUserQuestion', input: { questions: [{ question: 'Which session store?', header: 'Store', options: [] }] } })] });
    expect(notes(all(waiting), all(next)).map((n) => n.body)).toEqual(['Which session store?']);
  });

  it('tell you when an alert fires or gets worse, but not for a context bar that is only filling up', () => {
    const calm = session({ id: 'g', name: 'train-eval', project: 'ml-pipeline' });
    const warm = session({ id: 'g', name: 'train-eval', project: 'ml-pipeline', alerts: [
      { kind: 'gpu', level: 'warning', text: 'GPU 17/20 GB' },
      { kind: 'ctx', level: 'warning', text: 'context 83%' },
    ] });
    const hot = session({ id: 'g', name: 'train-eval', project: 'ml-pipeline', alerts: [{ kind: 'gpu', level: 'critical', text: 'GPU 21.4/20 GB' }] });
    expect(notes(all(calm), all(warm)).map((n) => n.title)).toEqual(['△ train-eval: GPU 17/20 GB']);
    expect(notes(all(warm), all(hot)).map((n) => n.title)).toEqual(['▲ train-eval: GPU 21.4/20 GB']);
    expect(notes(all(hot), all(warm))).toEqual([]); // better is not news
  });
});
