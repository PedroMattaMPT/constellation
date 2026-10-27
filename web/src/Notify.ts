// Desktop notifications (design system): when a session asks a question, shows a permission prompt or fires a resource
// alert. Clicking one opens the session. Nothing is sent for the session you're looking at, and each session keeps one
// notification at a time. Off until you turn them on with `:notify on` (the browser asks first).
import { glyph } from '@ds';
import { useEffect } from 'react';
import { readQuestions, shape } from './Answer';
import type { Session } from './protocol';
import { store } from './store';

const KEY = 'constellation.notify';
const BODY_MAX = 100;

export interface Note {
  session: string;
  title: string;
  body: string;
  /** A question or prompt: the click focuses its card, as C-Space a does. */
  attend: boolean;
}

function short(text: string): string {
  const line = text.split('\n')[0];
  return line.length > BODY_MAX ? `${line.slice(0, BODY_MAX - 1)}${glyph('misc', 'ellipsis')}` : line;
}

/** What the session asks, in one line: the question, or `Bash: psql -d app_dev …`. */
function asks(session: Session): string {
  const request = session.pending[0];
  if (!request) return session.waitingFor ?? '';
  if (request.kind === 'question') return short(readQuestions(request.input)[0]?.question ?? 'a question');
  if (request.kind === 'plan') return 'a plan to approve';
  return short(`${request.tool}: ${shape(request.tool, request.input).subject}`);
}

/** What changed between two views of the sessions that's worth a notification. */
export function notes(before: Record<string, Session>, after: Record<string, Session>): Note[] {
  const found: Note[] = [];
  for (const session of Object.values(after)) {
    const was = before[session.id];
    const asked = session.pending[0]?.id;
    if (session.status === 'waiting' && (was?.status !== 'waiting' || (asked && asked !== was.pending[0]?.id))) {
      found.push({ session: session.id, title: `${glyph('status', 'waiting')} ${session.name} needs you`, body: asks(session), attend: true });
    }
    for (const alert of session.alerts) {
      if (alert.kind === 'ctx' && alert.level === 'warning') continue; // the context bar raises an alert at 95%
      const old = was?.alerts.find((a) => a.kind === alert.kind);
      if (old && (old.level === alert.level || alert.level === 'warning')) continue;
      found.push({ session: session.id, title: `${glyph('alert', alert.level)} ${session.name}: ${alert.text}`, body: session.project, attend: false });
    }
  }
  return found;
}

export function notifying(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** `:notify on` and `:notify off`. Turning them on asks the browser, which needs the key press that ran the command. */
export async function setNotifying(on: boolean): Promise<string | null> {
  if (on) {
    if (typeof Notification === 'undefined') return 'this browser has no notifications';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'the browser blocks notifications for this page: allow them in its site settings';
  }
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    return 'not remembered: this browser keeps no settings here';
  }
  return null;
}

function show(note: Note) {
  const { focused, hidden } = store.state;
  const looking = document.visibilityState === 'visible' && document.hasFocus() && focused === note.session && !hidden.pane;
  if (looking) return;
  const notification = new Notification(note.title, { body: note.body, tag: `constellation:${note.session}` });
  notification.onclick = () => {
    window.focus();
    if (note.attend) store.attendTo(note.session);
    else store.focus(note.session);
    notification.close();
  };
}

/** Watches the sessions; the first snapshot only sets what's already known. */
export function useNotifications() {
  useEffect(() => {
    let before = store.state.sessions;
    return store.subscribe(() => {
      const after = store.state.sessions;
      if (after === before) return;
      const found = Object.keys(before).length ? notes(before, after) : [];
      before = after;
      if (found.length && notifying()) found.forEach(show);
    });
  }, []);
}
