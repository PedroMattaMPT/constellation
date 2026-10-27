import { React } from './react';
import { KeyHints, cx, glyph } from './atoms';

export interface QOption { label: string; description?: string }
export interface Question { header: string; question: string; options: QOption[]; multiSelect?: boolean }

export interface QuestionCardProps {
  session?: string;
  /** 1 to 4 questions (AskUserQuestion). */
  questions: Question[];
  current?: number;
  /** Per question: chosen option indexes, or the Other text. */
  answers?: Array<number[] | string | null>;
  highlighted?: number;
  otherText?: string;
  editingOther?: boolean;
  /** open: waiting for you · answered: collapsed record · readonly: external session, adopt to answer. */
  state?: 'open' | 'answered' | 'readonly';
}

/** A question from a session. Amber border and title chip: it is waiting for you. Numbers pick, Tab moves between questions. */
export function QuestionCard({ session, questions, current = 0, answers = [], highlighted = 0, otherText, editingOther, state = 'open' }: QuestionCardProps) {
  const q = questions[current];
  if (state === 'answered') {
    return (
      <div className="cn-card cn-card--answered">
        <span className="cn-msg--answer">{glyph('message', 'answer')}</span>{' '}
        {questions.map((qq, i) => {
          const a = answers[i];
          const text = typeof a === 'string' ? a : (a ?? []).map((k) => qq.options[k]?.label).join(', ');
          return <span key={i}><span className="cn-dim">{qq.header}:</span> <b>{text}</b>{i < questions.length - 1 ? <span className="cn-dim"> · </span> : null}</span>;
        })}
      </div>
    );
  }
  const chosen = answers[current];
  const picked = (i: number) => Array.isArray(chosen) && chosen.includes(i);
  return (
    <div className={cx('cn-card', 'cn-card--question', state === 'readonly' && 'cn-card--readonly')} role="group" aria-label={`question from ${session ?? 'session'}: ${q.question}`}>
      <div className="cn-card__head">
        <span className="cn-chip cn-chip--waiting">{glyph('status', 'waiting')} {q.header}</span>
        {questions.length > 1 ? (
          <span className="cn-steps">
            {questions.map((qq, i) => (
              <span key={i} className={cx('cn-steps__s', i === current && 'cn-steps__s--on', answers[i] != null && 'cn-steps__s--done')}>
                {answers[i] != null ? glyph('message', 'answer') : i + 1} {qq.header}
              </span>
            ))}
          </span>
        ) : null}
        <span className="cn-fill" />
        {session ? <span className="cn-dim">{session}</span> : null}
      </div>
      <div className="cn-card__q">{q.question}</div>
      <div role={q.multiSelect ? 'group' : 'radiogroup'} className="cn-opts">
        {q.options.map((o, i) => {
          const on = i === highlighted && !editingOther;
          const mark = q.multiSelect ? (picked(i) ? glyph('misc', 'check_on') : glyph('misc', 'check_off')) : picked(i) ? glyph('misc', 'radio_on') : glyph('misc', 'radio_off');
          return (
            <div key={i} role={q.multiSelect ? 'checkbox' : 'radio'} aria-checked={picked(i)} className={cx('cn-opt', on && 'cn-opt--on', picked(i) && 'cn-opt--picked')}>
              <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
              <span className="cn-opt__mark">{mark}</span>
              <span className="cn-opt__key">{i + 1}</span>
              <span className="cn-opt__label">{o.label}</span>
              {o.description ? <span className="cn-opt__desc">{o.description}</span> : null}
            </div>
          );
        })}
        <div className={cx('cn-opt', 'cn-opt--other', editingOther && 'cn-opt--on')}>
          <span className="cn-row__bar">{editingOther ? glyph('tree', 'cursor') : ' '}</span>
          <span className="cn-opt__mark">{typeof chosen === 'string' ? glyph('misc', 'radio_on') : glyph('misc', 'radio_off')}</span>
          <span className="cn-opt__key">o</span>
          {editingOther ? (
            <span className="cn-input cn-input--inline"><span>{otherText}</span><span className="cn-caret" /></span>
          ) : (
            <span className="cn-opt__label cn-dim">Other…</span>
          )}
        </div>
      </div>
      <div className="cn-card__foot">
        {state === 'readonly' ? (
          <span className="cn-kind--external">{glyph('kind', 'external')} external session · answer it in its terminal, or <b>A</b> adopt to answer here</span>
        ) : (
          <>
            <KeyHints keys={[[`1-${q.options.length}`, q.multiSelect ? 'toggle' : 'pick'], ['o', 'other'], ...(questions.length > 1 ? [['tab', 'next'] as [string, string]] : []), ['esc', 'later']]} />
            <span className="cn-fill" />
            <button className="cn-btn cn-btn--primary">Submit <span className="cn-btn__key">enter</span></button>
          </>
        )}
      </div>
    </div>
  );
}

export interface PermissionPromptProps {
  session?: string;
  tool: string;
  /** "run a command", "edit a file", "fetch a URL". */
  verb: string;
  /** Bash: the command. Edit/Write: the path. */
  subject: string;
  cwd?: string;
  /** Edit/Write: the diff, as lines starting with + or - or space. */
  diff?: string[];
  /** Why this one deserves a second look: outside the project, network, destructive. */
  risks?: Array<{ level: 'warning' | 'critical'; text: string }>;
  /** The rule "allow and remember" will save; editable. */
  rule: string;
  highlighted?: 0 | 1 | 2 | 3;
  /** Allow with changes: the edited command. Deny: the reason. */
  editing?: { kind: 'changes' | 'reason'; value: string };
}

/** A permission prompt: exactly what the tool wants to do, then allow · allow and remember · allow with changes · deny. */
export function PermissionPrompt(p: PermissionPromptProps) {
  const h = p.highlighted ?? 0;
  const opts: Array<[string, string, React.ReactNode]> = [
    ['y', 'Allow once', null],
    ['a', 'Allow and remember', <code className="cn-rule">{p.rule}</code>],
    ['e', 'Allow with changes…', null],
    ['n', 'Deny, and say why…', null],
  ];
  return (
    <div className="cn-card cn-card--permission" role="group" aria-label={`${p.tool} wants to ${p.verb}`}>
      <div className="cn-card__head">
        <span className="cn-chip cn-chip--waiting">{glyph('status', 'waiting')} {p.tool}</span>
        <span>wants to {p.verb}</span>
        <span className="cn-fill" />
        {p.session ? <span className="cn-dim">{p.session}</span> : null}
      </div>
      <div className="cn-perm__subject">
        {p.diff ? <span className="cn-dim">{p.subject}</span> : <><span className="cn-dim">$ </span><b>{p.subject}</b></>}
      </div>
      {p.diff ? (
        <pre className="cn-diff">
          {p.diff.map((l, i) => <div key={i} className={l.startsWith('+') ? 'cn-diff__add' : l.startsWith('-') ? 'cn-diff__del' : 'cn-dim'}>{l}</div>)}
        </pre>
      ) : null}
      {p.cwd ? <div className="cn-dim">in {p.cwd}</div> : null}
      {p.risks?.map((r, i) => (
        <div key={i} className={r.level === 'critical' ? 'cn-risk cn-risk--critical' : 'cn-risk cn-level--warning'}>
          {r.level === 'critical' ? <span className="cn-chip cn-chip--critical">{glyph('alert', 'critical')} {r.text}</span> : <>{glyph('alert', 'warning')} {r.text}</>}
        </div>
      ))}
      <div className="cn-opts" role="radiogroup">
        {opts.map(([key, text, extra], i) => (
          <div key={key} role="radio" aria-checked={i === h} className={cx('cn-opt', i === h && 'cn-opt--on', i === 3 && 'cn-opt--deny')}>
            <span className="cn-row__bar">{i === h ? glyph('tree', 'cursor') : ' '}</span>
            <span className="cn-opt__key">{i + 1}</span>
            <span className="cn-opt__label">{text}</span>
            {extra ? <span className="cn-opt__desc">{extra}</span> : null}
            <span className="cn-fill" />
            <span className="cn-keys__key">{key}</span>
          </div>
        ))}
      </div>
      {p.editing ? (
        <div className="cn-input">
          <span className="cn-dim">{p.editing.kind === 'changes' ? '$ ' : 'why: '}</span>
          <span>{p.editing.value}</span><span className="cn-caret" />
        </div>
      ) : null}
      <div className="cn-card__foot"><KeyHints keys={[['y', 'allow'], ['a', 'always'], ['e', 'edit'], ['n', 'deny'], ['esc', 'later']]} /></div>
    </div>
  );
}
