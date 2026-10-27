import type {
  AnswerRequest, ContextUsage, Effort, EntryContent, EntryPage, Event, HookStatus, ImageInput, LinkMessage, McpServer,
  Mode, ModelInfo, PastSession, Queued, RewindPreview, RewindRequest, SessionOptions, SessionPreview, StartRequest,
  Started, Turn,
} from './protocol';

const TOKEN_KEY = 'constellation.token';

/** The server prints a link with ?token=…; keep it for this tab and take it out of the address bar. */
function readToken(): string | null {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('token');
  if (fromUrl) {
    try {
      sessionStorage.setItem(TOKEN_KEY, fromUrl);
    } catch {
      // private mode: the token still works for this page load
    }
    url.searchParams.delete('token');
    window.history.replaceState(null, '', url);
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export const TOKEN = readToken();

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${TOKEN ?? ''}` } });
  if (!response.ok) throw new ApiError(response.status, `${response.status} ${path}`);
  return response.json() as Promise<T>;
}

/** A write: JSON in, JSON (or nothing) out. A refusal carries the server's reason as the message. */
async function send<T = void>(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN ?? ''}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let reason = `${response.status}`;
    try {
      const detail = ((await response.json()) as { detail?: unknown }).detail;
      reason = typeof detail === 'string' ? detail : reason;
    } catch {
      // no JSON body: keep the status
    }
    throw new ApiError(response.status, reason);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export interface PageQuery {
  before?: number;
  after?: number;
  around?: string;
  turn?: number;
  limit?: number;
}

const session = (id: string) => `/api/sessions/${encodeURIComponent(id)}`;
const past = (id: string) => `/api/history/${encodeURIComponent(id)}`;
const query = (params: Record<string, string | null | undefined>) =>
  new URLSearchParams(Object.entries(params).filter((p): p is [string, string] => p[1] != null)).toString();

export const api = {
  turns: (id: string) => get<Turn[]>(`${session(id)}/turns`),
  entries: (id: string, query: PageQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value != null) params.set(key, String(value));
    return get<EntryPage>(`${session(id)}/entries?${params}`);
  },
  content: (id: string, entryId: string) => get<EntryContent>(`${session(id)}/entries/${encodeURIComponent(entryId)}`),
  // Managed sessions
  start: (request: StartRequest) => send<Started>('POST', '/api/sessions', request),
  prompt: (id: string, text: string, images: ImageInput[] = []) => send<Queued>('POST', `${session(id)}/prompt`, { text, images }),
  clearQueue: (id: string) => send('DELETE', `${session(id)}/queue`),
  rename: (id: string, name: string) => send<Queued>('POST', `${session(id)}/rename`, { name }),
  interrupt: (id: string) => send('POST', `${session(id)}/interrupt`),
  stop: (id: string) => send('POST', `${session(id)}/stop`),
  answer: (id: string, requestId: string, answer: AnswerRequest) =>
    send('POST', `${session(id)}/pending/${encodeURIComponent(requestId)}`, answer),
  // Commands, model, mode, context, MCP
  models: () => get<ModelInfo[]>('/api/models'),
  options: (id: string) => get<SessionOptions>(`${session(id)}/options`),
  setModel: (id: string, model: string) => send('POST', `${session(id)}/model`, { model }),
  setEffort: (id: string, effort: Effort) => send<Queued>('POST', `${session(id)}/effort`, { effort }),
  setMode: (id: string, mode: Mode, confirm: string | null = null) => send('POST', `${session(id)}/mode`, { mode, confirm }),
  context: (id: string) => get<ContextUsage>(`${session(id)}/context`),
  mcp: (id: string) => get<McpServer[]>(`${session(id)}/mcp`),
  mcpReconnect: (id: string, server: string) => send<McpServer[]>('POST', `${session(id)}/mcp/${encodeURIComponent(server)}/reconnect`),
  mcpToggle: (id: string, server: string, enabled: boolean) =>
    send<McpServer[]>('POST', `${session(id)}/mcp/${encodeURIComponent(server)}/toggle`, { enabled }),
  // History
  fork: (id: string, name: string | null = null) => send<Started>('POST', `${session(id)}/fork`, { name }),
  rewindPreview: (id: string, entry: string) => get<RewindPreview>(`${session(id)}/rewind/${encodeURIComponent(entry)}`),
  rewind: (id: string, request: RewindRequest) => send<Started>('POST', `${session(id)}/rewind`, request),
  history: (search = '') => get<PastSession[]>(`/api/history?${query({ query: search })}`),
  preview: (sessionId: string, cwd?: string | null) => get<SessionPreview>(`${past(sessionId)}?${query({ cwd })}`),
  resume: (sessionId: string, fork = false, name: string | null = null) => send<Started>('POST', `${past(sessionId)}/resume`, { fork, name }),
  tag: (sessionId: string, tag: string | null) => send('POST', `${past(sessionId)}/tag`, { tag }),
  // Sessions you didn't start
  message: (id: string, text: string) => send('POST', `${session(id)}/message`, { text }),
  adopt: (id: string) => send('POST', `${session(id)}/adopt`),
  cancelAdopt: (id: string) => send('DELETE', `${session(id)}/adopt`),
  terminal: (id: string) => send('POST', `${session(id)}/terminal`),
  hooks: () => get<HookStatus>('/api/hooks'),
  installHooks: () => send<HookStatus>('POST', '/api/hooks'),
  removeHooks: () => send<HookStatus>('DELETE', '/api/hooks'),
  // Map
  summary: (id: string) => send('POST', `${session(id)}/summary`),
  links: (source: string, target: string) => get<LinkMessage[]>(`/api/links?${query({ source, target })}`),
};

/** The server's reason for a refusal, for an error line. */
export const reason = (error: unknown, fallback = 'server unreachable') => (error instanceof Error ? error.message : fallback);

export type Connection = 'connecting' | 'live' | 'offline' | 'unauthorized';

/** Keeps a WebSocket to /api/live open, reconnecting with backoff. Returns a function that closes it. */
export function connectLive(onEvent: (event: Event) => void, onConnection: (state: Connection) => void): () => void {
  let socket: WebSocket | null = null;
  let retry = 500;
  let timer: number | undefined;
  let closed = false;

  const open = () => {
    onConnection('connecting');
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${scheme}://${window.location.host}/api/live?token=${encodeURIComponent(TOKEN ?? '')}`);
    socket.onopen = () => {
      retry = 500;
      onConnection('live');
    };
    socket.onmessage = (message) => onEvent(JSON.parse(message.data as string) as Event);
    socket.onclose = (close) => {
      if (closed) return;
      if (close.code === 4401) {
        onConnection('unauthorized');
        return;
      }
      onConnection('offline');
      timer = window.setTimeout(open, retry);
      retry = Math.min(retry * 2, 5000);
    };
  };

  open();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    socket?.close();
  };
}
