import type { AnswerRequest, EntryContent, EntryPage, Event, ImageInput, Queued, StartRequest, Started, Turn } from './protocol';

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
};

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
