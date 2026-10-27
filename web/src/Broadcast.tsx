// C-Space b (design system: BroadcastPrompt; roadmap 5.3): one prompt to several sessions, like tmux's
// synchronize-panes. Each target says what it will do with the prompt before you send it, and C-enter sends, so a stray
// return can't reach five sessions. While it's open, the targets' prompt boxes carry the teal edge.
import { KeyHints, KindMark, StatusBadge, glyph } from '@ds';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, reason } from './api';
import type { Session } from './protocol';
import { numbered, store, useStore } from './store';

/** What a session will do with the prompt (design system), or why it can't take one. */
export function note(session: Session): { text: string; reachable: boolean } {
  if (session.kind === 'external') {
    return session.inbox ? { text: 'arrives as a peer message', reachable: true } : { text: 'no inbox: adopt it to reach it', reachable: false };
  }
  if (session.status === 'waiting') return { text: 'answer its question first: the prompt queues', reachable: true };
  if (session.status === 'working') return { text: 'queued after this turn', reachable: true };
  if (session.mode === 'plan') return { text: 'will only plan', reachable: true };
  return { text: '', reachable: true };
}

/** Sends to each, one at a time. Returns the ones that failed, with why. */
export async function broadcast(targets: Session[], text: string): Promise<Array<{ name: string; why: string }>> {
  const failed: Array<{ name: string; why: string }> = [];
  for (const session of targets) {
    try {
      if (session.kind === 'managed') await api.prompt(session.id, text);
      else await api.message(session.id, text);
    } catch (failure) {
      failed.push({ name: session.name, why: reason(failure) });
    }
  }
  return failed;
}

export function BroadcastDialog() {
  const sessions = useStore((s) => s.sessions);
  const selected = useStore((s) => s.selected);
  const rows = useMemo(
    () => numbered(sessions).sort((a, b) => a.session.project.localeCompare(b.session.project) || a.n - b.n),
    [sessions],
  );
  const [cursor, setCursor] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // Nothing picked on the map yet: start in the list; otherwise the prompt.
  useEffect(() => (store.state.selected.length ? field.current : list.current)?.focus(), []);

  const picked = rows.filter((r) => selected.includes(r.session.id) && note(r.session).reachable).map((r) => r.session);
  const close = () => store.set({ dialog: null });
  const toggle = (ids: string[]) => {
    const all = ids.every((id) => selected.includes(id));
    store.set({ selected: all ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])] });
  };
  const reachable = (s: Session) => note(s).reachable;

  const send = async () => {
    if (!picked.length || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    const failed = await broadcast(picked, text);
    setSending(false);
    if (failed.length) setError(failed.map((f) => `${f.name}: ${f.why}`).join(' · '));
    else {
      store.set({ selected: [] });
      close();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void send();
    else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') (document.activeElement === field.current ? list.current : field.current)?.focus();
    else if (event.target !== list.current) return; // the prompt box keeps every other key
    else if (event.key === 'ArrowDown' || event.key === 'j') setCursor((c) => Math.min(rows.length - 1, c + 1));
    else if (event.key === 'ArrowUp' || event.key === 'k') setCursor((c) => Math.max(0, c - 1));
    else if (event.key === ' ' && rows[cursor] && reachable(rows[cursor].session)) toggle([rows[cursor].session.id]);
    else if (event.key === 'p' && rows[cursor]) {
      const project = rows[cursor].session.project;
      toggle(rows.filter((r) => r.session.project === project && reachable(r.session)).map((r) => r.session.id));
    } else if (event.key === '*') toggle(rows.filter((r) => r.session.status === 'idle' && reachable(r.session)).map((r) => r.session.id));
    else return;
    event.preventDefault();
  };

  let last = '';
  return (
    <div className="cn-dialog cn-dialog--broadcast broadcast" role="dialog" aria-label="send to several sessions" onKeyDown={onKeyDown}>
      <div className="cn-dialog__title">
        <span className="cn-msg--sent">{glyph('message', 'sent')}</span> <b>send to several sessions</b>
        <span className="cn-fill" />
        <span className="cn-msg--sent">{picked.length} selected</span>
      </div>
      <div className="cn-targets broadcast__targets" role="listbox" aria-multiselectable="true" tabIndex={0} ref={list}>
        {rows.map(({ n, session }, i) => {
          const head =
            session.project !== last ? (
              ((last = session.project),
              (
                <div key={`h:${session.project}`} className="cn-targets__proj">
                  <span className="cn-dim">{glyph('message', 'project')}</span> <b>{session.project}</b> <span className="cn-dim">· p select project</span>
                </div>
              ))
            ) : null;
          const { text: what, reachable: ok } = note(session);
          const on = selected.includes(session.id) && ok;
          return (
            <div key={session.id}>
              {head}
              <div
                role="option"
                aria-selected={on}
                aria-disabled={!ok}
                className={`cn-target picker__row${i === cursor ? ' cn-target--on' : ''}${on ? ' cn-target--picked' : ''}${ok ? '' : ' cn-menu__item--off'}`}
                onClick={() => {
                  setCursor(i);
                  if (ok) toggle([session.id]);
                }}
              >
                <span className="cn-row__bar">{i === cursor ? glyph('tree', 'cursor') : ' '}</span>
                <span className="cn-target__check">{on ? glyph('misc', 'check_on') : glyph('misc', 'check_off')}</span>
                <KindMark kind={session.kind} />
                <span className="cn-target__name">
                  <span className="cn-dim">{n}</span> {session.name}
                </span>
                <span className="cn-target__status">
                  <StatusBadge status={session.status} compact />
                </span>
                <span className="cn-dim cn-ellipsis">{what}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="cn-prompt cn-prompt--broadcast cn-prompt--focused">
        <div className="cn-prompt__line">
          <span className="cn-prompt__marker">{glyph('message', 'prompt')}</span>
          <textarea
            ref={field}
            className="prompt__input"
            rows={2}
            value={text}
            placeholder={`the prompt for ${picked.length || 'the'} sessions${glyph('misc', 'ellipsis')}`}
            aria-label="the prompt to send"
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <div className="cn-status--error picker__error">
          {glyph('status', 'error')} not sent to {error}
        </div>
      ) : null}
      <div className="cn-dialog__foot">
        <KeyHints keys={[['space', 'pick'], ['p', 'project'], ['*', 'all idle'], ['tab', 'list, prompt']]} />
        <span className="cn-fill" />
        <button type="button" className="cn-btn" onClick={close}>
          Cancel <span className="cn-btn__key">esc</span>
        </button>
        <button type="button" className="cn-btn cn-btn--broadcast" disabled={!picked.length || !text.trim() || sending} onClick={() => void send()}>
          Send to {picked.length} {picked.length && text.trim() ? <span className="cn-btn__key">C-enter</span> : null}
        </button>
      </div>
    </div>
  );
}
