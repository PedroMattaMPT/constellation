// Answering a managed session: the design system's QuestionCard and PermissionPrompt, made to take keys and
// clicks. Their markup and classes are the design system's; the text fields are real inputs where the
// components draw a caret. A terminal session's question, reported by its hooks, shows read-only.
import { KeyHints, QuestionCard, glyph } from '@ds';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { PendingRequest, Session } from './protocol';
import { useStore } from './store';

interface Option {
  label: string;
  description?: string;
}
interface Question {
  header: string;
  question: string;
  options: Option[];
  multiSelect: boolean;
}
/** Per question: the picked option indexes, or the Other text. */
type Answer = number[] | string | null;

const MAX_DIFF_LINES = 400;

function readQuestions(input: Record<string, unknown>): Question[] {
  const list = Array.isArray(input.questions) ? input.questions : [];
  return list.map((raw) => {
    const q = (raw ?? {}) as Record<string, unknown>;
    const options = (Array.isArray(q.options) ? q.options : []).map((o) => {
      const option = (o ?? {}) as Record<string, unknown>;
      return { label: String(option.label ?? ''), description: option.description ? String(option.description) : undefined };
    });
    return { header: String(q.header ?? 'question'), question: String(q.question ?? ''), options, multiSelect: !!q.multiSelect };
  });
}

/**
 * Cards take keys only while focused. A new one takes focus unless you are typing something, or when C-Space a asks.
 * A read-only card (attention -1) never takes focus: there is nothing to answer here.
 */
function useCardFocus(attention: number) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = document.activeElement;
    const typing = (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && active.value.trim() !== '';
    if (!typing && attention >= 0) card.current?.focus();
  }, []);
  useEffect(() => {
    if (attention > 0) card.current?.focus();
  }, [attention]);
  return card;
}

function failure(reason: unknown) {
  return `not sent · ${reason instanceof Error ? reason.message : 'server unreachable'}`;
}

// ── QuestionCard ─────────────────────────────────────────────────────────

function QuestionAnswer({ session, request, more }: { session: Session; request: PendingRequest; more: number }) {
  const questions = readQuestions(request.input);
  const attention = useStore((s) => s.attention);
  const card = useCardFocus(attention);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => null));
  const [highlighted, setHighlighted] = useState(0);
  const [other, setOther] = useState<string | null>(null); // the Other field, while open
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!questions.length) return null;
  const q = questions[current];
  const chosen = answers[current];
  const picked = (i: number) => Array.isArray(chosen) && chosen.includes(i);
  const otherRow = q.options.length;

  const setAnswer = (value: Answer) => setAnswers((all) => all.map((a, i) => (i === current ? value : a)));
  const pick = (i: number) => {
    setHighlighted(i);
    if (q.multiSelect) setAnswer(picked(i) ? (chosen as number[]).filter((k) => k !== i) : [...(Array.isArray(chosen) ? chosen : []), i]);
    else setAnswer([i]);
  };
  const move = (step: number) => {
    setOther(null);
    setHighlighted(0);
    setCurrent((c) => Math.min(questions.length - 1, Math.max(0, c + step)));
  };

  const submit = async (final: Answer[] = answers) => {
    const missing = final.findIndex((a) => a == null || (Array.isArray(a) && !a.length));
    if (missing >= 0) {
      setCurrent(missing);
      setError(`answer ${questions[missing].header} first`);
      return;
    }
    const text = Object.fromEntries(
      questions.map((qq, i) => {
        const a = final[i];
        return [qq.question, typeof a === 'string' ? a : (a ?? []).map((k) => qq.options[k]?.label).join(', ')];
      }),
    );
    setSending(true);
    try {
      await api.answer(session.id, request.id, { allow: true, message: null, updatedInput: { ...request.input, answers: text }, remember: false, mode: null });
    } catch (reason) {
      setError(failure(reason));
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return; // the Other field handles its own keys
    const n = Number(event.key);
    if (Number.isInteger(n) && n >= 1 && n <= q.options.length) pick(n - 1);
    else if (event.key === 'ArrowDown') setHighlighted((h) => Math.min(otherRow, h + 1));
    else if (event.key === 'ArrowUp') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === ' ') highlighted === otherRow ? setOther(typeof chosen === 'string' ? chosen : '') : pick(highlighted);
    else if (event.key === 'o') setOther(typeof chosen === 'string' ? chosen : '');
    else if (event.key === 'Tab' && questions.length > 1) move(event.shiftKey ? -1 : 1);
    else if (event.key === 'Enter') {
      if (highlighted === otherRow) setOther(typeof chosen === 'string' ? chosen : '');
      else if (chosen == null && !q.multiSelect) {
        // Enter on a highlighted option picks it; the answer goes out when every question has one.
        const next = answers.map((a, i) => (i === current ? [highlighted] : a));
        setAnswers(next);
        if (next.every((a) => a != null)) void submit(next);
        else move(1);
      } else void submit();
    } else if (event.key === 'Escape') card.current?.blur(); // later: the session keeps waiting
    else return;
    event.preventDefault();
  };

  const mark = (i: number) =>
    q.multiSelect ? glyph('misc', picked(i) ? 'check_on' : 'check_off') : glyph('misc', picked(i) ? 'radio_on' : 'radio_off');

  return (
    <div className="cn-card cn-card--question answer-card" role="group" tabIndex={0} ref={card} onKeyDown={onKeyDown} aria-label={`question from ${session.name}: ${q.question}`}>
      <div className="cn-card__head">
        <span className="cn-chip cn-chip--waiting">
          {glyph('status', 'waiting')} {q.header}
        </span>
        {questions.length > 1 ? (
          <span className="cn-steps">
            {questions.map((qq, i) => (
              <button
                key={i}
                type="button"
                className={`cn-steps__s step-button${i === current ? ' cn-steps__s--on' : ''}${answers[i] != null ? ' cn-steps__s--done' : ''}`}
                onClick={() => move(i - current)}
              >
                {answers[i] != null ? glyph('message', 'answer') : i + 1} {qq.header}
              </button>
            ))}
          </span>
        ) : null}
        <span className="cn-fill" />
        {more ? <span className="cn-dim">+{more} more</span> : null}
      </div>
      <div className="cn-card__q">{q.question}</div>
      <div role={q.multiSelect ? 'group' : 'radiogroup'} className="cn-opts">
        {q.options.map((o, i) => (
          <div
            key={i}
            role={q.multiSelect ? 'checkbox' : 'radio'}
            aria-checked={picked(i)}
            className={`cn-opt option-row${i === highlighted && other === null ? ' cn-opt--on' : ''}${picked(i) ? ' cn-opt--picked' : ''}`}
            onClick={() => pick(i)}
          >
            <span className="cn-row__bar">{i === highlighted && other === null ? glyph('tree', 'cursor') : ' '}</span>
            <span className="cn-opt__mark">{mark(i)}</span>
            <span className="cn-opt__key">{i + 1}</span>
            <span className="cn-opt__label">{o.label}</span>
            {o.description ? <span className="cn-opt__desc">{o.description}</span> : null}
          </div>
        ))}
        <div className={`cn-opt cn-opt--other option-row${other !== null || highlighted === otherRow ? ' cn-opt--on' : ''}`} onClick={() => other === null && setOther(typeof chosen === 'string' ? chosen : '')}>
          <span className="cn-row__bar">{other !== null || highlighted === otherRow ? glyph('tree', 'cursor') : ' '}</span>
          <span className="cn-opt__mark">{glyph('misc', typeof chosen === 'string' ? 'radio_on' : 'radio_off')}</span>
          <span className="cn-opt__key">o</span>
          {other !== null ? (
            <input
              className="cn-input cn-input--inline answer-input"
              autoFocus
              value={other}
              aria-label="your own answer"
              onChange={(event) => setOther(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && other.trim()) {
                  const next = answers.map((a, i) => (i === current ? other.trim() : a));
                  setAnswers(next);
                  setOther(null);
                  card.current?.focus();
                  if (next.every((a) => a != null)) void submit(next);
                  else move(1);
                } else if (event.key === 'Escape') {
                  setOther(null);
                  card.current?.focus();
                } else return;
                event.preventDefault();
              }}
            />
          ) : (
            <span className="cn-opt__label cn-dim">{typeof chosen === 'string' ? chosen : 'Other…'}</span>
          )}
        </div>
      </div>
      {error ? (
        <div className="cn-status--error">
          {glyph('status', 'error')} {error}
        </div>
      ) : null}
      <div className="cn-card__foot">
        <KeyHints
          keys={[
            [`1-${q.options.length}`, q.multiSelect ? 'toggle' : 'pick'],
            ['o', 'other'],
            ...(questions.length > 1 ? [['tab', 'next'] as [string, string]] : []),
            ['esc', 'later'],
          ]}
        />
        <span className="cn-fill" />
        <button type="button" className="cn-btn cn-btn--primary" disabled={sending} onClick={() => void submit()}>
          Submit <span className="cn-btn__key">enter</span>
        </button>
      </div>
    </div>
  );
}

// ── PermissionPrompt ─────────────────────────────────────────────────────

interface Shape {
  verb: string;
  subject: string;
  /** Show the subject as a command (`$ …`) rather than a path. */
  command: boolean;
  diff?: string[];
  /** The field "allow with changes" edits; null: the whole input as JSON. */
  editField: string | null;
}

const text = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value ?? ''));
const lines = (prefix: string, value: unknown) => text(value).split('\n').map((l) => `${prefix}${l}`);

/** What a tool call is, in the design system's words: verb, subject, and a diff for file changes. */
function shape(tool: string, input: Record<string, unknown>): Shape {
  switch (tool) {
    case 'Bash':
      return { verb: 'run a command', subject: text(input.command), command: true, editField: 'command' };
    case 'Write':
      return { verb: 'write a file', subject: text(input.file_path), command: false, diff: lines('+ ', input.content), editField: 'content' };
    case 'Edit':
      return {
        verb: 'edit a file',
        subject: text(input.file_path),
        command: false,
        diff: [...lines('- ', input.old_string), ...lines('+ ', input.new_string)],
        editField: 'new_string',
      };
    case 'MultiEdit': {
      const edits = Array.isArray(input.edits) ? (input.edits as Array<Record<string, unknown>>) : [];
      const diff = edits.flatMap((e, i) => [...(i ? ['  …'] : []), ...lines('- ', e.old_string), ...lines('+ ', e.new_string)]);
      return { verb: 'edit a file', subject: text(input.file_path), command: false, diff, editField: null };
    }
    case 'WebFetch':
      return { verb: 'fetch a URL', subject: text(input.url), command: false, editField: 'url' };
    case 'WebSearch':
      return { verb: 'search the web', subject: text(input.query), command: false, editField: 'query' };
    case 'ExitPlanMode':
      return { verb: 'leave plan mode and start', subject: 'its plan', command: false, diff: lines('', input.plan), editField: null };
    default:
      return { verb: `use ${tool}`, subject: JSON.stringify(input), command: false, editField: null };
  }
}

/** The risk lines (design system): ▲ for destructive commands, △ for writes outside the project. */
function risks(tool: string, input: Record<string, unknown>, cwd: string): Array<{ level: 'warning' | 'critical'; text: string }> {
  const found: Array<{ level: 'warning' | 'critical'; text: string }> = [];
  if (tool === 'Bash') {
    const command = text(input.command);
    if (/(^|[\s;&|])sudo\b/.test(command)) found.push({ level: 'critical', text: 'runs as root' });
    if (/\brm\s+(-\w*r\w*f|-\w*f\w*r|--recursive)/.test(command)) found.push({ level: 'critical', text: 'deletes recursively' });
    if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/.test(command)) found.push({ level: 'critical', text: 'pipes a download into a shell' });
    if (/\bgit\s+push\b.*(\s--force\b|\s-f\b)/.test(command)) found.push({ level: 'critical', text: 'force push' });
  }
  const path = typeof input.file_path === 'string' ? input.file_path : null;
  if (path && path.startsWith('/') && !path.startsWith(cwd.endsWith('/') ? cwd : `${cwd}/`)) {
    found.push({ level: 'warning', text: 'outside the project' });
  }
  return found;
}

type Editing = { kind: 'changes' | 'reason'; value: string };

/** The footer of a card a terminal session is waiting on: answered in its terminal (design system: QuestionCard). */
function ReadonlyFoot() {
  return (
    <span className="cn-kind--external">
      {glyph('kind', 'external')} external session · answer it in its terminal, or <b>A</b> adopt to answer here
    </span>
  );
}

function PermissionAnswer({ session, request, more, readonly = false }: { session: Session; request: PendingRequest; more: number; readonly?: boolean }) {
  const attention = useStore((s) => s.attention);
  const card = useCardFocus(readonly ? -1 : attention);
  const plan = request.kind === 'plan';
  const what = shape(request.tool, request.input);
  const [highlighted, setHighlighted] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async (
    allow: boolean,
    extra: { message?: string; updatedInput?: Record<string, unknown>; remember?: boolean; mode?: 'acceptEdits' } = {},
  ) => {
    setSending(true);
    setError(null);
    try {
      await api.answer(session.id, request.id, {
        allow,
        message: extra.message ?? null,
        updatedInput: extra.updatedInput ?? null,
        remember: extra.remember ?? false,
        mode: extra.mode ?? null,
      });
    } catch (reason) {
      setError(failure(reason));
      setSending(false);
    }
  };

  // Plan approval has Claude Code's three answers; a permission prompt has the design system's four.
  const options: Array<{ key: string; label: string; extra?: ReactNode; act: () => void; deny?: boolean; disabled?: boolean }> = plan
    ? [
        { key: 'y', label: 'Approve the plan', extra: <span className="cn-dim">then ask before edits</span>, act: () => void send(true) },
        {
          key: 'a',
          label: 'Approve, and accept edits',
          extra: <span className="cn-mode cn-mode--edits">{glyph('mode', 'acceptEdits')} edits</span>,
          act: () => void send(true, { mode: 'acceptEdits' }),
        },
        { key: 'n', label: 'Keep planning, and say why…', act: () => setEditing({ kind: 'reason', value: '' }), deny: true },
      ]
    : [
        { key: 'y', label: 'Allow once', act: () => void send(true) },
        {
          key: 'a',
          label: 'Allow and remember',
          extra: request.rules.length ? <code className="cn-rule">{request.rules.join(', ')}</code> : <span className="cn-dim">no rule offered</span>,
          act: () => void send(true, { remember: true }),
          disabled: !request.rules.length,
        },
        {
          key: 'e',
          label: 'Allow with changes…',
          act: () =>
            setEditing({
              kind: 'changes',
              value: what.editField ? text(request.input[what.editField]) : JSON.stringify(request.input, null, 2),
            }),
        },
        { key: 'n', label: 'Deny, and say why…', act: () => setEditing({ kind: 'reason', value: '' }), deny: true },
      ];

  const confirmEditing = () => {
    if (!editing) return;
    if (editing.kind === 'reason') {
      void send(false, { message: editing.value.trim() || (plan ? 'keep planning' : undefined) });
      return;
    }
    if (what.editField) {
      void send(true, { updatedInput: { ...request.input, [what.editField]: editing.value } });
      return;
    }
    try {
      void send(true, { updatedInput: JSON.parse(editing.value) as Record<string, unknown> });
    } catch {
      setError('that is not valid JSON');
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editing || sending || readonly) return; // the field below has the keys; a terminal's prompt takes none
    const n = Number(event.key);
    const byKey = options.findIndex((o) => o.key === event.key);
    const chosen = Number.isInteger(n) && n >= 1 && n <= options.length ? n - 1 : byKey;
    if (chosen >= 0 && !options[chosen].disabled) {
      setHighlighted(chosen);
      options[chosen].act();
    } else if (event.key === 'ArrowDown') setHighlighted((h) => Math.min(options.length - 1, h + 1));
    else if (event.key === 'ArrowUp') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'Enter' && !options[highlighted].disabled) options[highlighted].act();
    else if (event.key === 'Escape') card.current?.blur(); // later: the session keeps waiting
    else return;
    event.preventDefault();
  };

  const diff = what.diff && what.diff.length > MAX_DIFF_LINES ? [...what.diff.slice(0, MAX_DIFF_LINES), `  … ${what.diff.length - MAX_DIFF_LINES} more lines`] : what.diff;
  return (
    <div className={`cn-card cn-card--permission answer-card${readonly ? ' cn-card--readonly' : ''}`} role="group" tabIndex={readonly ? -1 : 0} ref={card} onKeyDown={onKeyDown} aria-label={`${request.tool} wants to ${what.verb}`}>
      <div className="cn-card__head">
        <span className="cn-chip cn-chip--waiting">
          {glyph('status', 'waiting')} {request.tool}
        </span>
        <span>wants to {what.verb}</span>
        <span className="cn-fill" />
        {more ? <span className="cn-dim">+{more} more</span> : null}
      </div>
      <div className="cn-perm__subject">
        {what.command ? (
          <>
            <span className="cn-dim">$ </span>
            <b>{what.subject}</b>
          </>
        ) : (
          <span className="cn-dim">{what.subject}</span>
        )}
      </div>
      {diff ? (
        <pre className="cn-diff answer-diff">
          {diff.map((line, i) => (
            <div key={i} className={plan ? undefined : line.startsWith('+') ? 'cn-diff__add' : line.startsWith('-') ? 'cn-diff__del' : 'cn-dim'}>
              {line}
            </div>
          ))}
        </pre>
      ) : null}
      <div className="cn-dim">in {session.cwd}</div>
      {risks(request.tool, request.input, session.cwd).map((risk) => (
        <div key={risk.text} className={risk.level === 'critical' ? 'cn-risk cn-risk--critical' : 'cn-risk cn-level--warning'}>
          {risk.level === 'critical' ? (
            <span className="cn-chip cn-chip--critical">
              {glyph('alert', 'critical')} {risk.text}
            </span>
          ) : (
            <>
              {glyph('alert', 'warning')} {risk.text}
            </>
          )}
        </div>
      ))}
      <div className="cn-opts" role="radiogroup">
        {options.map((option, i) => (
          <div
            key={option.key}
            role="radio"
            aria-checked={i === highlighted}
            aria-disabled={option.disabled}
            className={`cn-opt${readonly ? '' : ' option-row'}${i === highlighted && !readonly ? ' cn-opt--on' : ''}${option.deny ? ' cn-opt--deny' : ''}${option.disabled ? ' option-row--disabled' : ''}`}
            onClick={() => {
              if (option.disabled || readonly) return;
              setHighlighted(i);
              option.act();
            }}
          >
            <span className="cn-row__bar">{i === highlighted && !readonly ? glyph('tree', 'cursor') : ' '}</span>
            <span className="cn-opt__key">{readonly ? ' ' : i + 1}</span>
            <span className="cn-opt__label">{option.label}</span>
            {option.extra ? <span className="cn-opt__desc">{option.extra}</span> : null}
            <span className="cn-fill" />
            {option.disabled || readonly ? null : <span className="cn-keys__key">{option.key}</span>}
          </div>
        ))}
      </div>
      {editing ? (
        <div className="cn-input answer-edit">
          <span className="cn-dim">{editing.kind === 'changes' ? (what.command ? '$ ' : 'new: ') : 'why: '}</span>
          <textarea
            className="answer-edit__field"
            autoFocus
            rows={Math.min(8, Math.max(1, editing.value.split('\n').length))}
            value={editing.value}
            aria-label={editing.kind === 'changes' ? 'the changed input' : 'why'}
            onChange={(event) => setEditing({ ...editing, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.altKey) confirmEditing();
              else if (event.key === 'Escape') {
                setEditing(null);
                card.current?.focus();
              } else return;
              event.preventDefault();
            }}
          />
        </div>
      ) : null}
      {error ? (
        <div className="cn-status--error">
          {glyph('status', 'error')} {error}
        </div>
      ) : null}
      <div className="cn-card__foot">
        {readonly ? (
          <ReadonlyFoot />
        ) : (
          <KeyHints
            keys={
              editing
                ? [['enter', editing.kind === 'reason' ? 'send' : 'allow'], ['S-enter', 'newline'], ['esc', 'back']]
                : plan
                  ? [['y', 'approve'], ['a', 'accept edits'], ['n', 'keep planning'], ['esc', 'later']]
                  : [['y', 'allow'], ['a', 'always'], ['e', 'edit'], ['n', 'deny'], ['esc', 'later']]
            }
          />
        )}
      </div>
    </div>
  );
}

/** The first pending request of a session, docked above its prompt box. A terminal session's is read-only. */
export function AnswerCard({ session }: { session: Session }) {
  const request = session.pending[0];
  if (!request) return null;
  const more = session.pending.length - 1;
  if (request.source !== 'sdk') {
    return request.kind === 'question' ? (
      <QuestionCard key={request.id} session={session.name} questions={readQuestions(request.input)} state="readonly" />
    ) : (
      <PermissionAnswer key={request.id} session={session} request={request} more={more} readonly />
    );
  }
  // Keyed by request: each new question or prompt starts with a fresh card.
  return request.kind === 'question' ? (
    <QuestionAnswer key={request.id} session={session} request={request} more={more} />
  ) : (
    <PermissionAnswer key={request.id} session={session} request={request} more={more} />
  );
}
