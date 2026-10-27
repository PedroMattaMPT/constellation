// Protocol objects for tests: every field the server always sends, with the ones a test cares about overridden.
import type { Entry, Session } from '../protocol';

export function entry(over: Partial<Entry> & { id: string }): Entry {
  return {
    seq: 0, turn: 1, starter: false, kind: 'reply', at: null, text: over.id, detail: null, tool: null, toolUseId: null,
    resultError: null, resultPreview: null, peer: null, msgId: null, agentId: null, sessionId: 's1', abandoned: false, images: 0,
    ...over,
  };
}

export function session(over: Partial<Session> & { id: string }): Session {
  return {
    sessionId: `${over.id}-sid`, sessionIds: [], pid: 1, name: over.id, nameSource: null, kind: 'managed', processKind: 'interactive',
    cwd: '/lab/a', project: 'a', branch: null, tmux: null, version: null, startedAt: 1, status: 'idle', rawStatus: 'idle',
    waitingFor: null, lastActivityAt: null, mode: 'default', title: null, firstPrompt: null, lastPrompt: null, step: null,
    awaySummary: null, context: null, costUsd: null, prLinks: [], artifacts: [], turns: 0, entries: 0, counts: {}, compactions: 0,
    transcriptExists: true, model: null, summary: null, summaryAt: null, inbox: false, adopting: false, replaces: null,
    pending: [], queued: [], activity: null, error: null, effort: null, mcp: null, forkOf: null, forks: [], tasks: [],
    costEstimated: false, resources: null, alerts: [], summarySource: null,
    ...over,
  };
}
