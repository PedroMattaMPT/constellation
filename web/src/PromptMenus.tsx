// Two more menus docked above the prompt box, in the CommandMenu's pattern (design system: docked card):
// `@` mentions a file of the project, C-r searches your prompts in this folder.
import { KeyHints, glyph } from '@ds';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { ago } from './format';
import type { FileMatch, PastPrompt } from './protocol';
import { useStore } from './store';

const ROWS = 8;

/** Long paths lose their middle, not their end (design system: truncation). */
export function middle(path: string, max = 64): string {
  if (path.length <= max) return path;
  const keep = Math.floor((max - 1) / 2);
  return `${path.slice(0, keep)}${glyph('misc', 'ellipsis')}${path.slice(path.length - keep)}`;
}

/** The query underlined where it occurs (design system: matches underlined). */
export function underline(text: string, query: string): ReactNode {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <u>{text.slice(at, at + query.length)}</u>
      {text.slice(at + query.length)}
    </>
  );
}

/** The `@query` right before the caret, if the caret is in one. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const found = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return found ? { start: caret - found[2].length - 1, query: found[2] } : null;
}

interface FilesState {
  matches: FileMatch[];
  total: number;
}

/** `@` in the prompt box: the project's files and folders. The prompt box keeps the keys; this only draws. */
export function useFiles(session: string, query: string | null): FilesState | null {
  const [found, setFound] = useState<FilesState | null>(null);
  useEffect(() => {
    if (query === null) {
      setFound(null);
      return;
    }
    const timer = window.setTimeout(() => api.files(session, query).then(setFound, () => setFound(null)), 100);
    return () => window.clearTimeout(timer);
  }, [session, query]);
  return found;
}

export function FilesMenu({ query, found, highlighted, onPick }: { query: string; found: FilesState | null; highlighted: number; onPick: (match: FileMatch) => void }) {
  const top = Math.max(0, Math.min(highlighted - ROWS + 1, (found?.matches.length ?? 0) - ROWS));
  const shown = found?.matches.slice(top, top + ROWS) ?? [];
  return (
    <div className="cn-menu" role="listbox" aria-label="files">
      <div className="cn-menu__head">
        <b>@</b>
        <span className="cn-menu__query">{query}</span>
        <span className="cn-fill" />
        <span className="cn-dim">{found ? `${found.matches.length} of ${found.total}` : `looking${glyph('misc', 'ellipsis')}`}</span>
      </div>
      {shown.map((match, i) => {
        const on = top + i === highlighted;
        return (
          <div key={match.path} role="option" aria-selected={on} className={`cn-menu__item picker__row${on ? ' cn-menu__item--on' : ''}`} onClick={() => onPick(match)}>
            <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
            <span className="cn-menu__desc mention__path" title={match.path}>
              {underline(middle(match.path), query)}
            </span>
            <span className="cn-menu__src">{match.folder ? 'folder' : 'file'}</span>
          </div>
        );
      })}
      {found && !found.matches.length ? <div className="cn-menu__item cn-dim picker__row">nothing matches</div> : null}
      <div className="cn-menu__foot">
        <KeyHints keys={[['↑↓', 'move'], ['tab', 'mention'], ['esc', 'close']]} />
      </div>
    </div>
  );
}

/** C-r: your prompts in this folder, newest first (Claude Code's own history). It has the keys while open. */
export function HistoryMenu({ cwd, project, onUse, onClose }: { cwd: string; project: string; onUse: (text: string) => void; onClose: () => void }) {
  const now = useStore((s) => s.now);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PastPrompt[] | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        api.prompts(cwd, query).then(
          (prompts) => {
            setFound(prompts);
            setHighlighted(0);
          },
          () => setFound([]),
        ),
      query ? 120 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [cwd, query]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = found?.length ?? 0;
    if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'r')) setHighlighted((h) => Math.min(count - 1, h + 1));
    else if (event.key === 'ArrowUp') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'Enter' && found?.[highlighted]) onUse(found[highlighted].text);
    else if (event.key === 'Escape') onClose();
    else return;
    event.preventDefault();
  };

  const top = Math.max(0, Math.min(highlighted - ROWS + 1, (found?.length ?? 0) - ROWS));
  return (
    <div className="cn-menu" role="listbox" aria-label="prompt history">
      <div className="cn-menu__head">
        <b>history</b>
        <span className="cn-dim">/</span>
        <input
          ref={input}
          className="menu-search"
          value={query}
          spellCheck={false}
          aria-label="search your prompts"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onClose}
        />
        <span className="cn-dim">{found ? `${found.length} in ${project}` : glyph('misc', 'ellipsis')}</span>
      </div>
      {(found ?? []).slice(top, top + ROWS).map((prompt, i) => {
        const on = top + i === highlighted;
        const line = prompt.text.split('\n')[0];
        return (
          <div
            key={`${prompt.at}-${i}`}
            role="option"
            aria-selected={on}
            className={`cn-menu__item picker__row${on ? ' cn-menu__item--on' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onUse(prompt.text)}
          >
            <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
            <span className="cn-msg--prompt">{glyph('message', 'prompt')}</span>
            <span className="cn-menu__desc">{underline(line, query)}</span>
            <span className="cn-dim">{ago(prompt.at, now)}</span>
          </div>
        );
      })}
      {found && !found.length ? <div className="cn-menu__item cn-dim picker__row">no prompts here yet</div> : null}
      <div className="cn-menu__foot">
        <KeyHints keys={[['↑↓', 'move'], ['enter', 'use'], ['esc', 'close']]} />
      </div>
    </div>
  );
}
