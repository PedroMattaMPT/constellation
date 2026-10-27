import { ConfirmStop, KeyHints, ModeBadge, glyph } from '@ds';
import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { api, reason } from './api';
import type { FolderMatches, Mode, ModelInfo } from './protocol';
import { middle } from './PromptMenus';
import { store, useStore } from './store';

// Claude Code's own aliases, until the server has the list a session reported (get_server_info).
const ALIASES = ['default', 'opus', 'sonnet', 'haiku', 'fable'];
export const MODES: Mode[] = ['default', 'plan', 'acceptEdits', 'auto', 'bypassPermissions', 'dontAsk'];
// The design system's line for each mode (SessionLauncher).
export const MODE_NOTE: Record<Mode, string> = {
  default: 'asks before edits and commands',
  plan: 'reads only until you approve a plan',
  acceptEdits: 'edits files without asking',
  auto: 'a classifier approves most actions',
  bypassPermissions: 'nothing is checked',
  dontAsk: 'never asks; denies what is not pre-approved',
};
const RECENT_KEY = 'constellation.recentFolders';

const base = (path: string) => path.split('/').filter(Boolean).pop() ?? '';

function rememberedFolders(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function rememberFolder(folder: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([folder, ...rememberedFolders().filter((f) => f !== folder)].slice(0, 8)));
  } catch {
    // not remembered, still works
  }
}

/** One labelled row of a dialog; the label lights up while the row has focus (design system: focused field). */
export function Field({ id, label, focus, onFocus, children }: { id: string; label: string; focus: string; onFocus: (id: string) => void; children: ReactNode }) {
  return (
    <div className={`cn-field${focus === id ? ' cn-field--focused' : ''}`} onFocus={() => onFocus(id)}>
      <span className="cn-field__label">{label}</span>
      <div className="cn-field__body">{children}</div>
    </div>
  );
}

/** Radio chips: click, or ← → while one has focus. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  render,
  disabled = () => false,
  label,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  render: (option: T, on: boolean) => ReactNode;
  disabled?: (option: T) => string | false;
  label: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const move = (event: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    for (let i = from + step; i >= 0 && i < options.length; i += step) {
      if (!disabled(options[i])) {
        onChange(options[i]);
        group.current?.querySelectorAll('button')[i]?.focus();
        return;
      }
    }
  };
  return (
    <div className="cn-seg" role="radiogroup" aria-label={label} ref={group}>
      {options.map((option, i) => {
        const why = disabled(option);
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={`cn-seg__opt seg-button${option === value ? ' cn-seg__opt--on' : ''}`}
            disabled={!!why}
            title={why || undefined}
            tabIndex={option === value || (value === null && i === 0) ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => move(event, i)}
          >
            {render(option, option === value)}
          </button>
        );
      })}
    </div>
  );
}

/** C-Space c: start a managed session in a folder, with your setup. */
export function Launcher() {
  const sessions = useStore((s) => s.sessions);
  const recent = useMemo(() => {
    const live = Object.values(sessions)
      .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
      .map((s) => s.cwd);
    return [...new Set([...rememberedFolders(), ...live])].slice(0, 6);
  }, [sessions]);

  const [folder, setFolder] = useState(recent[0] ?? '');
  const [name, setName] = useState<string | null>(null); // null: follows the folder
  const [models, setModels] = useState<string[]>(ALIASES);
  const [model, setModel] = useState('default');
  const [mode, setMode] = useState<Mode | null>(null); // null: your own default mode
  const [confirm, setConfirm] = useState(''); // bypass: the folder's name, typed back
  const [prompt, setPrompt] = useState('');
  const [openIn, setOpenIn] = useState<'pane' | 'window'>('pane');
  const [focus, setFocus] = useState('folder');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completion, setCompletion] = useState<FolderMatches | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  // Folder completion (design system: SessionLauncher), and the error line when what's typed isn't a folder.
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        api.folders(folder).then(
          (found) => {
            setCompletion(found);
            setHighlighted(0);
          },
          () => setCompletion(null),
        ),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [folder]);
  // Offer only what adds to the path: once it names a folder with no subfolders, nothing.
  const matches = (completion?.matches ?? []).filter((m) => m !== (folder.endsWith('/') ? folder : `${folder}/`));
  const folderField = useRef<HTMLInputElement>(null);
  const complete = (to: string | undefined) => {
    if (!to) return;
    setFolder(to);
    requestAnimationFrame(() => {
      // the caret goes to the end, where the completion is, and the field scrolls to show it
      const input = folderField.current;
      input?.setSelectionRange(to.length, to.length);
      if (input) input.scrollLeft = input.scrollWidth;
    });
  };

  // The short names of the models a running session reported, so the chips stay one line.
  useEffect(() => {
    api.models().then(
      (list: ModelInfo[]) => setModels(list.filter((m) => !m.value.startsWith('claude-')).map((m) => m.value)),
      () => {},
    );
  }, []);

  const taken = new Set(Object.values(sessions).map((s) => s.name));
  const suggested = (() => {
    const stem = base(folder) || 'session';
    let candidate = stem;
    for (let n = 2; taken.has(candidate); n++) candidate = `${stem}-${n}`;
    return candidate;
  })();
  const finalName = (name ?? suggested).trim();
  const bypass = mode === 'bypassPermissions';
  const confirmed = !bypass || confirm === base(folder.trim());
  const notFolder = folder.trim() !== '' && completion?.folder === false;
  const ready = folder.trim() !== '' && finalName !== '' && !starting && confirmed && !notFolder;

  const start = async () => {
    if (!ready) return;
    setStarting(true);
    setError(null);
    try {
      const { id } = await api.start({
        cwd: folder.trim(),
        model: model === 'default' ? null : model,
        mode,
        name: finalName,
        confirm: bypass ? confirm : null,
      });
      rememberFolder(folder.trim());
      if (prompt.trim()) await api.prompt(id, prompt);
      store.set({ dialog: null });
      store.open(id, openIn);
    } catch (failure) {
      setError(reason(failure, 'could not start'));
      setStarting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      store.set({ dialog: null });
    } else if (event.key === 'Enter' && !event.altKey && !event.shiftKey && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      void start();
    }
  };

  return (
    <div className={`cn-dialog${bypass ? ' cn-dialog--danger' : ''}`} role="dialog" aria-label="new session" onKeyDown={onKeyDown}>
      <div className="cn-dialog__title">
        <b>new session</b>
        <span className="cn-fill" />
        <span className="cn-dim">managed {glyph('kind', 'managed')}</span>
      </div>
      <Field id="folder" label="folder" focus={focus} onFocus={setFocus}>
        <input
          ref={folderField}
          className="cn-input dialog-input"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          onKeyDown={(event) => {
            // tab completes while there's something to complete; otherwise it moves on, as everywhere
            if (event.key === 'Tab' && !event.shiftKey && matches.length) complete(matches[highlighted]);
            else if (event.key === 'ArrowDown' && matches.length) setHighlighted((h) => Math.min(matches.length - 1, h + 1));
            else if (event.key === 'ArrowUp' && matches.length) setHighlighted((h) => Math.max(0, h - 1));
            else return;
            event.preventDefault();
          }}
          autoFocus
          spellCheck={false}
          aria-label="folder"
          aria-autocomplete="list"
        />
        {focus === 'folder' && matches.length ? (
          <div className="folder-matches" role="listbox" aria-label="folders">
            {matches.slice(0, 6).map((match, i) => (
              <div
                key={match}
                role="option"
                aria-selected={i === highlighted}
                className={`cn-menu__item picker__row${i === highlighted ? ' cn-menu__item--on' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => complete(match)}
              >
                <span className="cn-row__bar">{i === highlighted ? glyph('tree', 'cursor') : ' '}</span>
                <span className="cn-ellipsis" title={match}>{middle(match, 70)}</span>
              </div>
            ))}
            {matches.length > 6 ? <div className="cn-dim folder-matches__more">and {matches.length - 6} more</div> : null}
          </div>
        ) : null}
        {notFolder && !matches.length ? (
          <div className="cn-status--error">
            {glyph('status', 'error')} not a folder
          </div>
        ) : null}
        {recent.length ? (
          <div className="cn-recent">
            {recent.map((path) => (
              <button key={path} type="button" className="cn-tag tag-button" title={path} onClick={() => setFolder(path)}>
                {base(path)}
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <div className="cn-status--error">
            {glyph('status', 'error')} {error}
          </div>
        ) : null}
      </Field>
      <Field id="name" label="name" focus={focus} onFocus={setFocus}>
        <input className="cn-input dialog-input" value={name ?? suggested} onChange={(e) => setName(e.target.value)} spellCheck={false} aria-label="name" />
      </Field>
      <Field id="model" label="model" focus={focus} onFocus={setFocus}>
        <Choice
          label="model"
          options={models}
          value={model}
          onChange={setModel}
          render={(m, on) => (
            <>
              {glyph('misc', on ? 'radio_on' : 'radio_off')} {m}
            </>
          )}
        />
      </Field>
      <Field id="mode" label="mode" focus={focus} onFocus={setFocus}>
        <Choice label="mode" options={MODES} value={mode} onChange={setMode} render={(m) => <ModeBadge mode={m} />} />
        <div className="cn-dim">{mode ? MODE_NOTE[mode] : 'your default mode, from your settings'}</div>
        {bypass ? (
          <div className="cn-risk cn-risk--critical">
            <span className="cn-chip cn-chip--critical">
              {glyph('alert', 'critical')} bypass
            </span>{' '}
            every tool runs unchecked in <b>{folder.trim() || 'the folder'}</b>. Type <b>{base(folder.trim())}</b> to confirm:{' '}
            <input
              className="cn-input cn-input--inline dialog-input dialog-input--inline"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              spellCheck={false}
              aria-label="type the folder's name to confirm bypass"
            />
          </div>
        ) : null}
      </Field>
      <Field id="prompt" label="prompt" focus={focus} onFocus={setFocus}>
        <textarea
          className="cn-input cn-input--multi dialog-input"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="optional first prompt…"
          aria-label="first prompt"
        />
      </Field>
      <Field id="open" label="open in" focus={focus} onFocus={setFocus}>
        <Choice label="open in" options={['pane', 'window'] as const} value={openIn} onChange={setOpenIn} render={(where) => `new ${where}`} />
      </Field>
      <div className="cn-dialog__foot">
        <KeyHints keys={focus === 'folder' && matches.length ? [['tab', 'complete'], ['↑↓', 'folder']] : [['tab', 'next field'], ['←→', 'choose']]} />
        <span className="cn-fill" />
        <button type="button" className="cn-btn" onClick={() => store.set({ dialog: null })}>
          Cancel <span className="cn-btn__key">esc</span>
        </button>
        <button type="button" className={`cn-btn ${bypass ? 'cn-btn--danger' : 'cn-btn--primary'}`} disabled={!ready} onClick={() => void start()}>
          {starting ? `starting${glyph('misc', 'ellipsis')}` : 'Start'} <span className="cn-btn__key">enter</span>
        </button>
      </div>
    </div>
  );
}

/** C-Space &: the design system's ConfirmStop. & again (or the button) stops; esc keeps it running. */
export function StopDialog({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const subagents = useStore((s) => s.subagents.filter((a) => a.parent === id && a.status === 'working').length);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []); // keys go to the dialog: & stops, esc cancels

  const stop = () =>
    api.stop(id).then(
      () => store.set({ dialog: null }),
      (reason: unknown) => setError(reason instanceof Error ? reason.message : 'could not stop'),
    );
  const close = () => store.set({ dialog: null });

  // ConfirmStop draws its own buttons: read the click from which one it was.
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button');
    if (!button) return;
    if (button.classList.contains('cn-btn--danger')) void stop();
    else close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') close();
    else if (event.key === '&') void stop();
    else return;
    event.preventDefault();
  };

  if (!session) return null;
  return (
    <div className="stop-dialog" tabIndex={-1} ref={box} onClick={onClick} onKeyDown={onKeyDown}>
      <ConfirmStop name={session.name} kind={session.kind} waiting={session.pending.length} subagents={subagents} />
      {error ? (
        <div className="cn-status--error stop-dialog__error">
          {glyph('status', 'error')} {error}
        </div>
      ) : null}
    </div>
  );
}
