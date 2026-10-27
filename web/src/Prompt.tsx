import { CommandMenu, KeyHints, glyph } from '@ds';
import { type ClipboardEvent, type DragEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, reason } from './api';
import type { CommandInfo, Effort, FileMatch, ImageInput, Mode, Session } from './protocol';
import { FilesMenu, HistoryMenu, mentionAt, useFiles } from './PromptMenus';
import { store, useStore } from './store';

const MAX_LINES = 6; // design system: the prompt box grows from 1 to 6 lines
const MAX_IMAGE = 5 * 1024 * 1024; // the API's limit per image
const IMAGE_TYPES: ReadonlyArray<string> = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MENU_ROWS = 8;
const ESC_ESC_MS = 400;
// S-Tab (design system): default → edits → plan → auto. Bypass and no-ask are never in the cycle.
const CYCLE: Mode[] = ['default', 'acceptEdits', 'plan', 'auto'];
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

interface Attached {
  name: string;
  size: number;
  image: ImageInput;
  /** The data URL, for the thumbnail. */
  url: string;
  width: number;
  height: number;
}

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function readImage(file: File): Promise<Attached> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const data = url.split(',', 2)[1] ?? '';
      const done = (width: number, height: number) =>
        resolve({ name: file.name || 'pasted image', size: file.size, image: { mediaType: file.type as ImageInput['mediaType'], data }, url, width, height });
      // Its size in pixels, for the chip (design system: `▣ schema.png 1280×720`).
      const probe = new Image();
      probe.onload = () => done(probe.naturalWidth, probe.naturalHeight);
      probe.onerror = () => done(0, 0);
      probe.src = url;
    };
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** How often each command was run from this page, per session: the menu's second ranking key. */
const used = new Map<string, Map<string, number>>();

export function count(session: string, line: string) {
  const name = /^\/(\S+)/.exec(line.trim())?.[1];
  if (!name) return;
  const counts = used.get(session) ?? new Map<string, number>();
  counts.set(name, (counts.get(name) ?? 0) + 1);
  used.set(session, counts);
}

/** The design system's ranking: prefix matches first, then how often you ran it in this session, then by name. */
export function rank(commands: CommandInfo[], query: string, session: string): CommandInfo[] {
  const q = query.toLowerCase();
  const counts = used.get(session);
  const score = (c: CommandInfo) => {
    const name = c.name.toLowerCase();
    if (name.startsWith(q) || c.aliases.some((a) => a.toLowerCase().startsWith(q))) return 0;
    return name.includes(q) ? 1 : 2;
  };
  const often = (c: CommandInfo) => counts?.get(c.name) ?? 0;
  return commands
    .filter((c) => score(c) < 2)
    .sort((a, b) => score(a) - score(b) || often(b) - often(a) || a.name.localeCompare(b.name));
}

/**
 * Commands Constellation draws itself (design system: Claude Code features). Returns true when it handled the line;
 * anything else goes to the session as a prompt.
 */
function native(session: Session, line: string): boolean | Promise<unknown> {
  const [command, ...rest] = line.trim().slice(1).split(/\s+/);
  const arg = rest.join(' ');
  const open = (kind: 'model' | 'context' | 'mcp' | 'rewind' | 'clear' | 'usage') => store.set({ dialog: { kind, session: session.id } });
  switch (command) {
    case 'model':
      if (arg) return api.setModel(session.id, arg);
      open('model');
      return true;
    case 'effort':
      return EFFORTS.includes(arg as Effort) ? api.setEffort(session.id, arg as Effort) : false;
    case 'context':
      open('context');
      return true;
    case 'usage':
    case 'cost':
      open('usage');
      return true;
    case 'mcp':
      if (arg) return false; // /mcp reconnect x: Claude Code's own
      open('mcp');
      return true;
    case 'rewind':
      open('rewind');
      return true;
    case 'resume':
      store.set({ dialog: { kind: 'resume' } });
      return true;
    case 'clear':
    case 'reset':
    case 'new':
      if (!session.pending.length) return false;
      open('clear');
      return true;
    case 'fork':
      return api.fork(session.id, arg || null).then(({ id }) => store.open(id));
    case 'rename':
      if (arg) return false;
      store.set({ renaming: session.id });
      return true;
    default:
      return false;
  }
}

/**
 * The design system's PromptBox, typed into. Managed: enter sends (or queues while a turn runs), M-enter or S-enter
 * adds a line, esc interrupts, esc esc rewinds, S-Tab cycles the mode, and / opens the command menu docked above.
 * Pasted or dropped images become chips. External: what you type goes to the session as a peer message.
 */
export function PromptInput({ session }: { session: Session }) {
  const external = session.kind === 'external';
  // A target of the send-to-several dialog while it's open (design system: the teal prompt edge).
  const targeted = useStore((s) => s.dialog?.kind === 'broadcast' && s.selected.includes(session.id));
  const running = session.status === 'working';
  const draft = useStore((s) => (s.draft?.session === session.id ? s.draft : null));
  const [value, setValue] = useState('');
  const [images, setImages] = useState<Attached[]>([]);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [commands, setCommands] = useState<CommandInfo[] | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [menuClosed, setMenuClosed] = useState(false);
  const [caret, setCaret] = useState(0);
  const [mentionClosed, setMentionClosed] = useState<number | null>(null); // esc closes the @ menu for that mention
  const [fileHighlighted, setFileHighlighted] = useState(0);
  const [history, setHistory] = useState(false);
  const lastEsc = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);

  // A rewind put the prompt you went back to here, to edit and send again.
  useEffect(() => {
    if (!draft) return;
    setValue(draft.text);
    store.set({ draft: null });
    field.current?.focus();
  }, [draft?.nonce]);

  // The / menu: while the line is a command name with nothing after it yet.
  const query = /^\/(\S*)$/.exec(value)?.[1] ?? null;
  const menuOpen = query !== null && !menuClosed && focused;
  useEffect(() => {
    if (menuOpen && !external && commands === null) api.options(session.id).then((o) => setCommands(o.commands), () => setCommands([]));
  }, [menuOpen]);
  useEffect(() => {
    setHighlighted(0);
    if (query === null) setMenuClosed(false);
  }, [query]);
  const matches = useMemo(() => (query === null || !commands ? [] : rank(commands, query, session.id)), [commands, query, session.id]);
  const top = Math.max(0, Math.min(highlighted - MENU_ROWS + 1, matches.length - MENU_ROWS));

  // @ mentions a file of the project (managed sessions: Claude Code reads what you mention).
  const mention = !external && focused && !menuOpen ? mentionAt(value, caret) : null;
  const mentionOpen = mention !== null && mentionClosed !== mention.start;
  const files = useFiles(session.id, mentionOpen ? mention.query : null);
  useEffect(() => setFileHighlighted(0), [mention?.query]);
  const mentionFile = (match: FileMatch | undefined) => {
    if (!match || !mention) return;
    // A folder stays open to keep completing inside it; a file ends the mention with a space.
    const inserted = `@${match.path}${match.folder ? '' : ' '}`;
    const next = value.slice(0, mention.start) + inserted + value.slice(caret);
    const at = mention.start + inserted.length;
    setValue(next);
    setCaret(at);
    requestAnimationFrame(() => field.current?.setSelectionRange(at, at));
  };
  const shown = matches.slice(top, top + MENU_ROWS);

  const attach = async (files: File[]) => {
    const accepted = files.filter((file) => IMAGE_TYPES.includes(file.type));
    const large = accepted.find((file) => file.size > MAX_IMAGE);
    if (large) {
      setError(`${large.name || 'the image'} is over 5 MB`);
      return;
    }
    try {
      const read = await Promise.all(accepted.map(readImage));
      setImages((current) => [...current, ...read]);
      setError(null);
    } catch (failure) {
      setError(reason(failure, 'could not read the image'));
    }
  };

  const submit = async (text = value) => {
    if (sending || (!text.trim() && !images.length)) return;
    setSending(true);
    setError(null);
    try {
      if (external) await api.message(session.id, text);
      else {
        count(session.id, text);
        const handled = text.startsWith('/') && !images.length ? native(session, text) : false;
        if (handled === false) await api.prompt(session.id, text, images.map((i) => i.image));
        else await handled;
      }
      setValue('');
      setImages([]);
    } catch (failure) {
      setError(`not sent · ${reason(failure)}`);
    } finally {
      setSending(false);
    }
  };

  const complete = (command: CommandInfo | undefined) => {
    if (!command || command.unavailable) return;
    setValue(`/${command.name} `);
  };

  const cycleMode = () => {
    const at = CYCLE.indexOf(session.mode ?? 'default');
    const next = CYCLE[(at + 1) % CYCLE.length];
    api.setMode(session.id, next).catch((failure: unknown) => setError(`mode not changed · ${reason(failure)}`));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.ctrlKey && event.key === 'r') {
      event.preventDefault(); // C-r: search your prompts in this folder (Claude Code's key)
      setHistory(true);
      return;
    }
    if (mentionOpen && files?.matches.length) {
      const count = files.matches.length;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFileHighlighted((h) => (h + (event.key === 'ArrowDown' ? 1 : -1) + count) % count);
        return;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey && !event.altKey)) {
        event.preventDefault();
        mentionFile(files.matches[fileHighlighted]);
        return;
      }
    }
    if (mentionOpen && event.key === 'Escape') {
      event.preventDefault();
      setMentionClosed(mention.start);
      return;
    }
    if (menuOpen && !external && matches.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlighted((h) => (h + step + matches.length) % matches.length);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        complete(matches[highlighted]);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        const command = matches[highlighted];
        if (command && !command.unavailable) void submit(`/${command.name}`);
        return;
      }
    }
    if (menuOpen && event.key === 'Escape') {
      event.preventDefault();
      setMenuClosed(true);
      return;
    }
    if (event.key === 'Enter' && event.altKey) {
      // M-enter: a newline where the caret is (browsers insert nothing for it)
      event.preventDefault();
      const target = event.currentTarget;
      const { selectionStart: from, selectionEnd: to } = target;
      setValue(value.slice(0, from) + '\n' + value.slice(to));
      requestAnimationFrame(() => target.setSelectionRange(from + 1, from + 1));
    } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Tab' && event.shiftKey && !external) {
      event.preventDefault();
      cycleMode();
    } else if (event.key === 'Escape' && !external) {
      event.preventDefault();
      const now = Date.now();
      if (now - lastEsc.current < ESC_ESC_MS) {
        lastEsc.current = 0;
        store.set({ dialog: { kind: 'rewind', session: session.id } });
      } else {
        lastEsc.current = now;
        if (running) api.interrupt(session.id).catch((failure: unknown) => setError(`not interrupted · ${reason(failure)}`));
      }
    } else if (event.key === 'Backspace' && !value && images.length) {
      event.preventDefault(); // design system: backspace on an empty prompt removes the last image
      setImages((current) => current.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (external) return;
    const files = [...event.clipboardData.files].filter((file) => IMAGE_TYPES.includes(file.type));
    if (files.length) {
      event.preventDefault();
      void attach(files);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (external) return;
    const files = [...event.dataTransfer.files];
    if (files.some((file) => IMAGE_TYPES.includes(file.type))) {
      event.preventDefault();
      void attach(files);
    }
  };

  // CommandMenu draws plain rows: a click picks the row at that position.
  const onMenuClick = (event: MouseEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest('.cn-menu__item');
    const index = row ? [...row.parentElement!.querySelectorAll(':scope > .cn-menu__item')].indexOf(row) : -1;
    if (index >= 0) {
      complete(shown[index]);
      field.current?.focus();
    }
  };

  const rows = Math.min(MAX_LINES, Math.max(1, value.split('\n').length));
  const hints: Array<[string, string]> | null = external
    ? focused
      ? [['enter', 'send']]
      : null
    : running
      ? [['enter', 'queue'], ['esc', 'interrupt']]
      : focused
        ? [['enter', 'send'], ['M-enter', 'newline']]
        : null;

  return (
    <>
      {history ? (
        <div className="cn-pane__dock prompt-menu">
          <HistoryMenu
            cwd={session.cwd}
            project={session.project}
            onUse={(text) => {
              setHistory(false);
              setValue(text);
              requestAnimationFrame(() => field.current?.focus());
            }}
            onClose={() => {
              setHistory(false);
              requestAnimationFrame(() => field.current?.focus());
            }}
          />
        </div>
      ) : mentionOpen && mention ? (
        <div className="cn-pane__dock prompt-menu" onMouseDown={(event) => event.preventDefault()}>
          <FilesMenu query={mention.query} found={files} highlighted={fileHighlighted} onPick={mentionFile} />
        </div>
      ) : null}
      {menuOpen ? (
        <div className="cn-pane__dock prompt-menu" onMouseDown={(event) => event.preventDefault()} onClick={onMenuClick}>
          {external ? (
            <div className="cn-menu" role="listbox" aria-label="commands">
              <div className="cn-menu__head">
                <b>/</b>
                <span className="cn-menu__query">{query}</span>
                <span className="cn-fill" />
                <span className="cn-kind--external">
                  {glyph('kind', 'external')} external · slash commands can't be sent · <b>A</b> adopt
                </span>
              </div>
            </div>
          ) : commands === null ? (
            <div className="cn-menu">
              <div className="cn-menu__head">
                <b>/</b>
                <span className="cn-menu__query">{query}</span>
                <span className="cn-fill" />
                <span className="cn-dim">loading{glyph('misc', 'ellipsis')}</span>
              </div>
            </div>
          ) : (
            <CommandMenu
              query={query ?? ''}
              highlighted={highlighted - top}
              total={commands.length}
              commands={shown.map((c) => ({
                name: c.name,
                source: c.source,
                description: c.description,
                args: c.argumentHint || undefined,
                unavailable: c.unavailable ?? undefined,
              }))}
            />
          )}
        </div>
      ) : null}
      <div
        className={`cn-prompt prompt${focused ? ' cn-prompt--focused' : ''}${external ? ' cn-prompt--external' : ''}${targeted ? ' cn-prompt--broadcast' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        {external ? (
          <div className="cn-prompt__banner cn-kind--external">
            {glyph('kind', 'external')} external · arrives as a peer message · no slash commands ·{' '}
            <button type="button" className="link-button" onClick={() => store.set({ dialog: { kind: 'adopt', session: session.id } })}>
              <b>A</b> adopt
            </button>
          </div>
        ) : null}
        {images.length ? (
          <div className="cn-prompt__images">
            {images.map((attached, i) => (
              <button
                key={`${attached.name}-${i}`}
                type="button"
                className="cn-tag prompt__image"
                title="remove this image"
                onClick={() => setImages((current) => current.filter((_, j) => j !== i))}
              >
                {glyph('misc', 'image')} {attached.name}{' '}
                <span className="cn-dim">{attached.width ? `${attached.width}×${attached.height}` : size(attached.size)}</span>
                <img className="prompt__thumb" src={attached.url} alt="" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="cn-prompt__line">
          <span className="cn-prompt__marker">{glyph('message', 'prompt')}</span>
          <textarea
            ref={field}
            className="prompt__input"
            rows={rows}
            value={value}
            placeholder={external ? `message ${session.name}…` : 'type a prompt, / for commands'}
            aria-label={external ? 'peer message' : 'prompt'}
            spellCheck={false}
            onChange={(event) => {
              setValue(event.target.value);
              setCaret(event.target.selectionStart);
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {hints ? <KeyHints keys={hints} /> : null}
        </div>
        {error ? (
          <div className="cn-prompt__banner cn-status--error">
            {glyph('status', 'error')} {error}
          </div>
        ) : null}
      </div>
    </>
  );
}
