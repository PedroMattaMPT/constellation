import { React } from './react';
import { KeyHints, KindMark, Kind, Mode, ModeBadge, Status, StatusBadge, cx, glyph } from './atoms';

const MODES: Mode[] = ['default', 'plan', 'acceptEdits', 'auto', 'bypassPermissions', 'dontAsk'];
const MODE_NOTE: Record<Mode, string> = {
  default: 'asks before edits and commands',
  plan: 'reads only until you approve a plan',
  acceptEdits: 'edits files without asking',
  auto: 'a classifier approves most actions',
  bypassPermissions: 'nothing is checked',
  dontAsk: 'never asks; denies what is not pre-approved',
};

export interface LauncherProps {
  folder: string;
  recent?: string[];
  name: string;
  models: string[];
  model: string;
  mode: Mode;
  prompt?: string;
  openIn?: 'pane' | 'window';
  /** Field with keyboard focus. */
  focus?: 'folder' | 'name' | 'model' | 'mode' | 'prompt';
  /** Bypass needs the folder name typed back before Start enables. */
  bypassConfirm?: string;
  error?: string;
}

/** prefix c: start a managed session. Folder, model, mode; Start opens it in a new pane. */
export function SessionLauncher(p: LauncherProps) {
  const bypass = p.mode === 'bypassPermissions';
  const base = p.folder.split('/').filter(Boolean).pop() ?? '';
  const confirmed = !bypass || p.bypassConfirm === base;
  const field = (id: LauncherProps['focus'], lbl: string, body: React.ReactNode) => (
    <div className={cx('cn-field', p.focus === id && 'cn-field--focused')}>
      <span className="cn-field__label">{lbl}</span>
      <div className="cn-field__body">{body}</div>
    </div>
  );
  return (
    <div className={cx('cn-dialog', bypass && 'cn-dialog--danger')} role="dialog" aria-label="new session">
      <div className="cn-dialog__title"><b>new session</b><span className="cn-fill" /><span className="cn-dim">managed {glyph('kind', 'managed')}</span></div>
      {field('folder', 'folder', <>
        <span className="cn-input"><span>{p.folder}</span>{p.focus === 'folder' ? <span className="cn-caret" /> : null}</span>
        {p.recent?.length ? <div className="cn-recent">{p.recent.map((r) => <span key={r} className="cn-tag">{r}</span>)}</div> : null}
        {p.error ? <div className="cn-status--error">{glyph('status', 'error')} {p.error}</div> : null}
      </>)}
      {field('name', 'name', <span className="cn-input"><span>{p.name}</span>{p.focus === 'name' ? <span className="cn-caret" /> : null}</span>)}
      {field('model', 'model', <span className="cn-seg">{p.models.map((m) => (
        <span key={m} className={cx('cn-seg__opt', m === p.model && 'cn-seg__opt--on')}>{m === p.model ? glyph('misc', 'radio_on') : glyph('misc', 'radio_off')} {m}</span>
      ))}</span>)}
      {field('mode', 'mode', <>
        <span className="cn-seg">{MODES.map((m) => (
          <span key={m} className={cx('cn-seg__opt', m === p.mode && 'cn-seg__opt--on')}><ModeBadge mode={m} /></span>
        ))}</span>
        <div className="cn-dim">{MODE_NOTE[p.mode]}</div>
        {bypass ? (
          <div className="cn-risk cn-risk--critical">
            <span className="cn-chip cn-chip--critical">{glyph('alert', 'critical')} bypass</span> every tool runs unchecked in <b>{p.folder}</b>. Type <b>{base}</b> to confirm:{' '}
            <span className="cn-input cn-input--inline"><span>{p.bypassConfirm ?? ''}</span><span className="cn-caret" /></span>
          </div>
        ) : null}
      </>)}
      {field('prompt', 'prompt', <span className="cn-input cn-input--multi">{p.prompt ? <span>{p.prompt}</span> : <span className="cn-prompt__ph">optional first prompt…</span>}</span>)}
      <div className="cn-field"><span className="cn-field__label">open in</span><div className="cn-field__body"><span className="cn-seg">
        <span className={cx('cn-seg__opt', p.openIn !== 'window' && 'cn-seg__opt--on')}>{p.openIn !== 'window' ? glyph('misc', 'radio_on') : glyph('misc', 'radio_off')} new pane</span>
        <span className={cx('cn-seg__opt', p.openIn === 'window' && 'cn-seg__opt--on')}>{p.openIn === 'window' ? glyph('misc', 'radio_on') : glyph('misc', 'radio_off')} new window</span>
      </span></div></div>
      <div className="cn-dialog__foot">
        <KeyHints keys={[['tab', 'next field'], ['←→', 'choose']]} />
        <span className="cn-fill" />
        <button className="cn-btn">Cancel <span className="cn-btn__key">esc</span></button>
        <button className={cx('cn-btn', bypass ? 'cn-btn--danger' : 'cn-btn--primary')} disabled={!confirmed} aria-disabled={!confirmed}>
          Start <span className="cn-btn__key">enter</span>
        </button>
      </div>
    </div>
  );
}

/** prefix &: stopping is the one action that needs a second key. Names the session and what will be lost. */
export function ConfirmStop({ name, kind = 'managed', waiting, subagents, unsaved }: { name: string; kind?: Kind; waiting?: number; subagents?: number; unsaved?: string }) {
  return (
    <div className="cn-dialog cn-dialog--danger cn-dialog--small" role="alertdialog" aria-label={`stop ${name}?`}>
      <div className="cn-dialog__title"><span className="cn-status--error">{glyph('status', 'stopped')}</span> <b>stop {name}?</b></div>
      <div>The process ends{kind === 'managed' ? '' : ' (it was started elsewhere)'}. Its transcript stays: <b>/resume</b> brings it back.</div>
      {waiting ? <div className="cn-status--waiting">{glyph('status', 'waiting')} it is waiting on {waiting} question{waiting > 1 ? 's' : ''}; they will go unanswered</div> : null}
      {subagents ? <div className="cn-msg--subagent">{glyph('message', 'subagent_started')} {subagents} subagent{subagents > 1 ? 's' : ''} running will stop too</div> : null}
      {unsaved ? <div className="cn-level--warning">{glyph('alert', 'warning')} {unsaved}</div> : null}
      <div className="cn-dialog__foot">
        <span className="cn-fill" />
        <button className="cn-btn">Cancel <span className="cn-btn__key">esc</span></button>
        <button className="cn-btn cn-btn--danger">Stop <span className="cn-btn__key">&amp;</span></button>
      </div>
    </div>
  );
}

export interface Target { n: number; name: string; project: string; kind: Kind; status: Status; selected: boolean; note?: string }

/** prefix b: one prompt to several sessions you pick, like tmux synchronize-panes. Says what each will do with it. */
export function BroadcastPrompt({ targets, prompt, cursor = 0 }: { targets: Target[]; prompt: string; cursor?: number }) {
  const n = targets.filter((t) => t.selected).length;
  let last = '';
  return (
    <div className="cn-dialog cn-dialog--broadcast" role="dialog" aria-label="send to several sessions">
      <div className="cn-dialog__title"><span className="cn-msg--sent">{glyph('message', 'sent')}</span> <b>send to several sessions</b><span className="cn-fill" /><span className="cn-msg--sent">{n} selected</span></div>
      <div className="cn-targets" role="listbox" aria-multiselectable="true">
        {targets.map((t, i) => {
          const head = t.project !== last ? (last = t.project, <div key={'h' + t.project} className="cn-targets__proj"><span className="cn-dim">{glyph('message', 'project')}</span> <b>{t.project}</b> <span className="cn-dim">· p select project</span></div>) : null;
          return (
            <React.Fragment key={t.n}>
              {head}
              <div role="option" aria-selected={t.selected} className={cx('cn-target', i === cursor && 'cn-target--on', t.selected && 'cn-target--picked')}>
                <span className="cn-row__bar">{i === cursor ? glyph('tree', 'cursor') : ' '}</span>
                <span className="cn-target__check">{t.selected ? glyph('misc', 'check_on') : glyph('misc', 'check_off')}</span>
                <KindMark kind={t.kind} />
                <span className="cn-target__name">{t.name}</span>
                <span className="cn-target__status"><StatusBadge status={t.status} /></span>
                <span className="cn-dim cn-ellipsis">{t.note ?? ''}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="cn-prompt cn-prompt--broadcast cn-prompt--focused">
        <div className="cn-prompt__line"><span className="cn-prompt__marker">{glyph('message', 'prompt')}</span><span className="cn-prompt__value">{prompt}</span><span className="cn-caret" /></div>
      </div>
      <div className="cn-dialog__foot">
        <KeyHints keys={[['space', 'pick'], ['p', 'project'], ['*', 'all idle']]} />
        <span className="cn-fill" />
        <button className="cn-btn">Cancel <span className="cn-btn__key">esc</span></button>
        <button className="cn-btn cn-btn--broadcast" disabled={!n}>Send to {n} <span className="cn-btn__key">C-enter</span></button>
      </div>
    </div>
  );
}
