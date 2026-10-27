import { KeyHints, glyph } from '@ds';
import { type ClipboardEvent, type DragEvent, type KeyboardEvent, useState } from 'react';
import { api } from './api';
import type { ImageInput } from './protocol';

const MAX_LINES = 6; // design system: the prompt box grows from 1 to 6 lines
const MAX_IMAGE = 5 * 1024 * 1024; // the API's limit per image
const IMAGE_TYPES: ReadonlyArray<string> = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

interface Attached {
  name: string;
  size: number;
  image: ImageInput;
}

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function readImage(file: File): Promise<Attached> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(',', 2)[1] ?? '';
      resolve({ name: file.name || 'pasted image', size: file.size, image: { mediaType: file.type as ImageInput['mediaType'], data } });
    };
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * The design system's PromptBox, typed into: enter sends (or queues while a turn runs), M-enter or S-enter
 * adds a line, esc interrupts. Pasted or dropped images become chips and go out with the prompt.
 */
export function PromptInput({ session, running }: { session: string; running: boolean }) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState<Attached[]>([]);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'could not read the image');
    }
  };

  const submit = async () => {
    if (sending || (!value.trim() && !images.length)) return;
    setSending(true);
    setError(null);
    try {
      await api.prompt(session, value, images.map((i) => i.image));
      setValue('');
      setImages([]);
    } catch (reason) {
      setError(`not sent · ${reason instanceof Error ? reason.message : 'server unreachable'}`);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.altKey) {
      // M-enter: a newline where the caret is (browsers insert nothing for it)
      event.preventDefault();
      const field = event.currentTarget;
      const { selectionStart: from, selectionEnd: to } = field;
      setValue(value.slice(0, from) + '\n' + value.slice(to));
      requestAnimationFrame(() => field.setSelectionRange(from + 1, from + 1));
    } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape' && running) {
      event.preventDefault();
      api.interrupt(session).catch((reason: unknown) => setError(`not interrupted · ${reason instanceof Error ? reason.message : ''}`));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files].filter((file) => IMAGE_TYPES.includes(file.type));
    if (files.length) {
      event.preventDefault();
      void attach(files);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const files = [...event.dataTransfer.files];
    if (files.some((file) => IMAGE_TYPES.includes(file.type))) {
      event.preventDefault();
      void attach(files);
    }
  };

  const rows = Math.min(MAX_LINES, Math.max(1, value.split('\n').length));
  const hints: Array<[string, string]> | null = running
    ? [['enter', 'queue'], ['esc', 'interrupt']]
    : focused
      ? [['enter', 'send'], ['M-enter', 'newline']]
      : null;

  return (
    <div className={`cn-prompt prompt${focused ? ' cn-prompt--focused' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
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
              {glyph('misc', 'image')} {attached.name} <span className="cn-dim">{size(attached.size)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="cn-prompt__line">
        <span className="cn-prompt__marker">{glyph('message', 'prompt')}</span>
        <textarea
          className="prompt__input"
          rows={rows}
          value={value}
          placeholder="type a prompt, / for commands"
          aria-label="prompt"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
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
  );
}
