import { React } from './react';
import { KeyHints, cx, glyph } from './atoms';

export interface Command {
  name: string;
  /** Where it comes from (get_server_info): built-in, skill, command, mcp, plugin. */
  source: 'built-in' | 'skill' | 'command' | 'mcp' | 'plugin';
  description: string;
  args?: string;
  /** Terminal-only commands (/theme, /terminal-setup, /login) stay listed, disabled, with the reason. */
  unavailable?: string;
}

/** The "/" menu: opens above the prompt box, filters as you type, Tab completes, Enter runs. */
export function CommandMenu({ query, commands, highlighted = 0, total }: { query: string; commands: Command[]; highlighted?: number; total?: number }) {
  return (
    <div className="cn-menu" role="listbox" aria-label="commands">
      <div className="cn-menu__head">
        <b>/</b><span className="cn-menu__query">{query}</span><span className="cn-caret" />
        <span className="cn-fill" />
        <span className="cn-dim">{commands.length} of {total ?? commands.length}</span>
      </div>
      {commands.map((c, i) => {
        const on = i === highlighted;
        const q = query.toLowerCase();
        const at = c.name.toLowerCase().indexOf(q);
        return (
          <div key={c.name} role="option" aria-selected={on} aria-disabled={!!c.unavailable} className={cx('cn-menu__item', on && 'cn-menu__item--on', c.unavailable && 'cn-menu__item--off')}>
            <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
            <span className="cn-menu__name">
              /{at >= 0 && q ? <>{c.name.slice(0, at)}<u>{c.name.slice(at, at + q.length)}</u>{c.name.slice(at + q.length)}</> : c.name}
              {c.args ? <span className="cn-dim"> {c.args}</span> : null}
            </span>
            <span className={cx('cn-menu__src', `cn-src--${c.source}`)}>{c.source}</span>
            <span className="cn-menu__desc">{c.unavailable ? <i>{c.unavailable}</i> : c.description}</span>
          </div>
        );
      })}
      <div className="cn-menu__foot"><KeyHints keys={[['↑↓', 'move'], ['tab', 'complete'], ['enter', 'run'], ['esc', 'close']]} /></div>
    </div>
  );
}

export interface ModelOption { id: string; name: string; note: string; context?: string; current?: boolean }
export type Effort = 'low' | 'medium' | 'high' | 'max';

/** /model: models from the server, the current one marked (●), and the effort row underneath (← →). */
export function ModelPicker({ models, highlighted = 0, effort = 'medium', efforts = ['low', 'medium', 'high', 'max'], focusEffort }: { models: ModelOption[]; highlighted?: number; effort?: Effort; efforts?: Effort[]; focusEffort?: boolean }) {
  return (
    <div className="cn-menu cn-picker" role="dialog" aria-label="model">
      <div className="cn-menu__head"><b>model</b><span className="cn-fill" /><span className="cn-dim">applies to the next turn</span></div>
      <div role="radiogroup" aria-label="model">
        {models.map((m, i) => {
          const on = i === highlighted && !focusEffort;
          return (
            <div key={m.id} role="radio" aria-checked={!!m.current} className={cx('cn-menu__item', on && 'cn-menu__item--on')}>
              <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
              <span className={cx('cn-radio', m.current && 'cn-radio--on')}>{m.current ? glyph('misc', 'radio_on') : glyph('misc', 'radio_off')}</span>
              <span className="cn-menu__name">{i + 1} {m.name}</span>
              <span className="cn-menu__src">{m.context ?? ''}</span>
              <span className="cn-menu__desc">{m.note}</span>
            </div>
          );
        })}
      </div>
      <div className={cx('cn-effort', focusEffort && 'cn-effort--focused')} role="radiogroup" aria-label="effort">
        <span className="cn-row__bar">{focusEffort ? glyph('tree', 'cursor') : ' '}</span>
        <span className="cn-dim">effort</span>
        {efforts.map((e) => (
          <span key={e} role="radio" aria-checked={e === effort} className={cx('cn-effort__opt', e === effort && 'cn-effort__opt--on')}>{e}</span>
        ))}
      </div>
      <div className="cn-menu__foot"><KeyHints keys={[['1-4', 'pick'], ['←→', 'effort'], ['enter', 'apply'], ['esc', 'close']]} /></div>
    </div>
  );
}

export interface PastSession { id: string; name: string; project: string; when: string; turns: number; preview: string[]; tag?: string }

/** /resume: past sessions on the left, the last turns of the highlighted one on the right. Enter resumes in a new pane. */
export function ResumePicker({ sessions, highlighted = 0, query }: { sessions: PastSession[]; highlighted?: number; query?: string }) {
  const cur = sessions[highlighted];
  return (
    <div className="cn-menu cn-resume" role="dialog" aria-label="resume a session">
      <div className="cn-menu__head"><b>resume</b> <span className="cn-dim">/{query ?? ''}</span><span className="cn-fill" /><span className="cn-dim">{sessions.length} past sessions</span></div>
      <div className="cn-resume__body">
        <div className="cn-resume__list" role="listbox">
          {sessions.map((s, i) => (
            <div key={s.id} role="option" aria-selected={i === highlighted} className={cx('cn-menu__item', i === highlighted && 'cn-menu__item--on')}>
              <span className="cn-row__bar">{i === highlighted ? glyph('tree', 'cursor') : ' '}</span>
              <span className="cn-status--stopped">{glyph('status', 'stopped')}</span>
              <span className="cn-menu__name">{s.name}</span>
              {s.tag ? <span className="cn-tag">{s.tag}</span> : null}
              <span className="cn-fill" />
              <span className="cn-dim">{s.when}</span>
            </div>
          ))}
        </div>
        {cur ? (
          <div className="cn-resume__preview" aria-label="preview">
            <div className="cn-dim">{cur.project} · {cur.turns} turns · {cur.id.slice(0, 8)}</div>
            {cur.preview.map((l, i) => <div key={i} className={l.startsWith('›') ? 'cn-msg--prompt cn-b' : ''}>{l}</div>)}
          </div>
        ) : null}
      </div>
      <div className="cn-menu__foot"><KeyHints keys={[['enter', 'resume'], ['f', 'fork'], ['t', 'tag'], ['/', 'search'], ['esc', 'close']]} /></div>
    </div>
  );
}
