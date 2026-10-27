import { React } from './react';
import { KindMark, Kind, KeyHints, Mode, ModeBadge, MsgGlyph, MsgType, Spinner, Status, StatusBadge, cx, glyph } from './atoms';
import { ContextBar } from './meters';

export interface Message {
  type: MsgType;
  /** First line: the prompt, tool name, peer name or reply text. */
  text: React.ReactNode;
  /** Muted remainder: arguments, file, preview. */
  detail?: React.ReactNode;
  /** Collapsed tool output or a reply body. */
  body?: React.ReactNode;
}

/** One entry in the conversation: a 2ch glyph gutter, then text. Prompts bold starlight, tools quiet. */
export function MessageRow({ type, text, detail, body }: Message) {
  return (
    <div className={cx('cn-msg', `cn-msg-row--${type}`)}>
      <span className="cn-msg__gutter"><MsgGlyph type={type} /></span>
      <div className="cn-msg__main">
        <span className={cx('cn-msg__text', `cn-msg--${type}`)}>{text}</span>
        {detail ? <span className="cn-dim"> {detail}</span> : null}
        {body ? <div className="cn-msg__body">{body}</div> : null}
      </div>
    </div>
  );
}

export interface StatusLineProps { model: string; branch: string; ctx: number; mode: Mode; cost?: string; mcp?: { up: number; down: number } }

/** The pane's last line: model │ @branch │ ctx bar │ mode │ cost. Drops cost, then branch, when narrow. */
export function StatusLine({ model, branch, ctx, mode, cost, mcp }: StatusLineProps) {
  const sep = <span className="cn-sep" aria-hidden="true">│</span>;
  return (
    <div className="cn-statusline">
      <span className="cn-dim">{model}</span>{sep}
      <span className="cn-dim cn-statusline__branch">@{branch}</span>{sep}
      <ContextBar value={ctx} />{sep}
      <ModeBadge mode={mode} />
      {mcp ? <>{sep}<span className={mcp.down ? 'cn-level--warning' : 'cn-dim'}>mcp {mcp.up}{mcp.down ? ` · ${glyph('alert', 'warning')} ${mcp.down} down` : ''}</span></> : null}
      {cost ? <>{sep}<span className="cn-dim cn-statusline__cost">{cost}</span></> : null}
    </div>
  );
}

export interface PromptBoxProps {
  value?: string;
  placeholder?: string;
  focused?: boolean;
  /** The session is working: Enter queues, Esc interrupts. */
  running?: boolean;
  /** External session: messages arrive as from a peer; no slash commands, no answers. */
  external?: boolean;
  /** Broadcasting to n sessions (synchronize-panes). */
  broadcast?: number;
  images?: Array<{ name: string; size: string }>;
  disabled?: boolean;
}

export function PromptBox(p: PromptBoxProps) {
  return (
    <div className={cx('cn-prompt', p.focused && 'cn-prompt--focused', !!p.broadcast && 'cn-prompt--broadcast', p.external && 'cn-prompt--external', p.disabled && 'cn-prompt--disabled')}>
      {p.broadcast ? <div className="cn-prompt__banner cn-msg--sent">{glyph('message', 'sent')} to {p.broadcast} sessions · synchronized</div> : null}
      {p.external ? <div className="cn-prompt__banner cn-kind--external">{glyph('kind', 'external')} external · arrives as a peer message · no slash commands · <b>A</b> adopt</div> : null}
      {p.images?.length ? (
        <div className="cn-prompt__images">
          {p.images.map((im) => <span key={im.name} className="cn-tag">{glyph('misc', 'image')} {im.name} <span className="cn-dim">{im.size}</span></span>)}
        </div>
      ) : null}
      <div className="cn-prompt__line">
        <span className="cn-prompt__marker">{glyph('message', 'prompt')}</span>
        {p.value ? <span className="cn-prompt__value">{p.value}</span> : <span className="cn-prompt__ph">{p.placeholder ?? 'type a prompt, / for commands'}</span>}
        {p.focused && !p.disabled ? <span className="cn-caret" aria-hidden="true" /> : null}
        <span className="cn-fill" />
        {p.disabled ? null : p.running ? <KeyHints keys={[['enter', 'queue'], ['esc', 'interrupt']]} /> : p.focused ? <KeyHints keys={[['enter', 'send'], ['M-enter', 'newline']]} /> : null}
      </div>
    </div>
  );
}

export interface PaneProps {
  index: number;
  name: string;
  project: string;
  kind?: Kind;
  status: Status;
  ago?: string;
  focused?: boolean;
  zoomed?: boolean;
  /** Inline rename (prefix ,). */
  renaming?: string;
  messages: Message[];
  /** Something that sits between conversation and prompt: a question card, a permission prompt, a menu. */
  dock?: React.ReactNode;
  activity?: string;
  prompt?: PromptBoxProps;
  status_line: StatusLineProps;
  height?: number;
}

/** One session in a tmux-style pane: header, conversation, (dock), prompt box, status line. */
export function Pane(p: PaneProps) {
  const kind = p.kind ?? 'managed';
  return (
    <section
      className={cx('cn-pane', p.focused && 'cn-pane--focused', kind === 'external' && 'cn-pane--external', p.status_line.mode === 'bypassPermissions' && 'cn-pane--bypass', p.zoomed && 'cn-pane--zoomed', p.status === 'waiting' && 'cn-pane--waiting')}
      style={p.height ? { height: p.height } : undefined}
      aria-label={`pane ${p.index}: ${p.name}`}
    >
      <header className="cn-pane__head">
        <span className="cn-pane__index">{p.index}</span>
        {p.renaming != null ? (
          <span className="cn-rename"><span className="cn-rename__value">{p.renaming}</span><span className="cn-caret" /><span className="cn-dim"> enter save · esc cancel</span></span>
        ) : (
          <span className="cn-pane__name">{p.name}</span>
        )}
        <KindMark kind={kind} />
        <span className="cn-dim cn-ellipsis">{p.project}</span>
        {p.zoomed ? <span className="cn-tag" title="zoomed (prefix z)">Z</span> : null}
        <span className="cn-fill" />
        <StatusBadge status={p.status} age={p.ago} />
      </header>
      <div className="cn-pane__conv" role="log" aria-live="polite">
        {p.messages.map((m, i) => <MessageRow key={i} {...m} />)}
        {p.activity ? (
          <div className="cn-msg cn-msg--activity">
            <span className="cn-msg__gutter cn-status--working"><Spinner /></span>
            <span className="cn-msg__main"><span className="cn-status--working">{p.activity}</span><span className="cn-dim"> · esc to interrupt</span></span>
          </div>
        ) : null}
      </div>
      {p.dock ? <div className="cn-pane__dock">{p.dock}</div> : null}
      <PromptBox focused={p.focused} external={kind === 'external'} {...p.prompt} />
      <StatusLine {...p.status_line} />
    </section>
  );
}

export interface BarSession { n: number; name: string; status: Status; current?: boolean; zoomed?: boolean }

/**
 * The global status bar, one line: windows on the left, every session in the middle (tmux window list),
 * attention counts, cost and clock on the right. Waiting sessions keep their full name in an amber chip.
 */
export function StatusBar({
  windows, sessions, prefix, cost, clock, warnings = 0, maxName = 8, limit,
}: { windows: Array<{ n: number; name: string; active?: boolean }>; sessions: BarSession[]; prefix?: boolean; cost?: string; clock?: string; warnings?: number; maxName?: number; limit?: number }) {
  const waiting = sessions.filter((s) => s.status === 'waiting').length;
  const stale = sessions.filter((s) => s.status === 'stale').length;
  // Waiting sessions are never cut; the others fill what is left, then "+n".
  const keep = limit == null ? sessions : sessions.filter((s, i) => s.status === 'waiting' || i < limit);
  const hidden = sessions.length - keep.length;
  return (
    <footer className="cn-bar" role="status">
      {prefix ? <span className="cn-chip cn-chip--brand">C-Space</span> : null}
      {windows.map((w) => (
        <span key={w.n} className={cx('cn-bar__win', w.active && 'cn-bar__win--active')}>{w.n} {w.name}</span>
      ))}
      <span className="cn-bar__sessions">
        {keep.map((s) =>
          s.status === 'waiting' ? (
            <span key={s.n} className="cn-chip cn-chip--waiting" title={`${s.name} needs you`}>{s.n}{glyph('status', 'waiting')} {s.name}</span>
          ) : (
            <span key={s.n} className={cx('cn-bar__s', s.current && 'cn-bar__s--current')} title={`${s.name}: ${s.status}`}>
              <span className="cn-bar__n">{s.n}</span>
              <span className={`cn-status--${s.status}`}>{glyph('status', s.status)}</span>
              {s.name.length > maxName ? s.name.slice(0, maxName) : s.name}
              {s.zoomed ? <span className="cn-dim">Z</span> : null}
            </span>
          ),
        )}
        {hidden ? <span className="cn-dim">+{hidden}</span> : null}
      </span>
      <span className="cn-fill" />
      {waiting ? <span className="cn-chip cn-chip--waiting">{glyph('status', 'waiting')} {waiting}</span> : null}
      {stale ? <span className="cn-status--stale">{glyph('status', 'stale')} {stale}</span> : null}
      {warnings ? <span className="cn-level--warning">{glyph('alert', 'warning')} {warnings}</span> : null}
      {cost ? <span className="cn-dim">{cost}</span> : null}
      {clock ? <span className="cn-dim">{clock}</span> : null}
    </footer>
  );
}
