// The design system's picker pattern (round border, a list, an optional preview on the right) for model and effort,
// mode, context, MCP servers, resume and rewind; plus the small dialogs around them. All open in the floating layer,
// take their keys while open, and close on esc.
import { AlertFlag, ContextBar, KeyHints, ModeBadge, ModelPicker, ResumePicker, Sparkline, Spinner, glyph } from '@ds';
import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { TOKEN, api, reason } from './api';
import { MODE_NOTE, MODES } from './Dialogs';
import { ago, cost, count, gb, shortModel } from './format';
import type {
  ContextUsage, Effort, Limits, McpServer, Mode, PastSession, RewindPreview, SessionOptions, SessionPreview, Turn, UsageReport,
} from './protocol';
import { store, useStore } from './store';

const close = () => store.set({ dialog: null });

/** Takes focus when it opens, so its keys work at once. */
function useAutofocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

/** Which row of a design-system list was clicked, by its position among the rows. */
function rowIndex(event: MouseEvent, selector: string): number {
  const row = (event.target as HTMLElement).closest(selector);
  return row ? [...row.parentElement!.querySelectorAll(`:scope > ${selector}`)].indexOf(row) : -1;
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <div className="cn-status--error picker__error">
      {glyph('status', 'error')} {text}
    </div>
  ) : null;
}

// ── Model and effort (/model, or a click on the model in the status line) ───

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export function ModelDialog({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const [options, setOptions] = useState<SessionOptions | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [effort, setEffort] = useState<Effort | null>(null);
  const [onEffort, setOnEffort] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useAutofocus<HTMLDivElement>();

  const models = options?.models ?? [];
  // Several entries can resolve to the model in use (default and opus): the first is marked (●).
  const current = models.findIndex((m) => m.value === options?.model || (m.model != null && m.model === options?.model));
  const efforts = (models[highlighted]?.efforts ?? []).filter((e): e is Effort => EFFORTS.includes(e as Effort));

  useEffect(() => {
    api.options(id).then(
      (found) => {
        setOptions(found);
        setHighlighted(Math.max(0, found.models.findIndex((m) => m.value === found.model || m.model === found.model)));
        setEffort((found.effort as Effort | null) ?? null);
      },
      (failure: unknown) => setError(reason(failure)),
    );
  }, [id]);

  const apply = async () => {
    const chosen = models[highlighted];
    if (!chosen) return;
    try {
      if (highlighted !== current) await api.setModel(id, chosen.value);
      if (effort && effort !== options?.effort && efforts.includes(effort)) await api.setEffort(id, effort);
      close();
    } catch (failure) {
      setError(`not applied · ${reason(failure)}`);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const n = Number(event.key);
    if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, models.length)) {
      setHighlighted(n - 1);
      setOnEffort(false);
    } else if (event.key === 'ArrowDown') {
      if (highlighted >= models.length - 1) setOnEffort(true);
      else setHighlighted((h) => h + 1);
    } else if (event.key === 'ArrowUp') {
      if (onEffort) setOnEffort(false);
      else setHighlighted((h) => Math.max(0, h - 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!efforts.length) return;
      const at = effort ? efforts.indexOf(effort) : -1;
      const next = event.key === 'ArrowRight' ? Math.min(efforts.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      setEffort(efforts[next]);
    } else if (event.key === 'Tab') setOnEffort((on) => !on);
    else if (event.key === 'Enter') void apply();
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const option = (event.target as HTMLElement).closest('.cn-effort__opt');
    if (option) {
      setEffort(option.textContent as Effort);
      return;
    }
    const index = rowIndex(event, '.cn-menu__item');
    if (index >= 0) {
      setHighlighted(index);
      setOnEffort(false);
      if (event.detail === 2) void apply();
    }
  };

  if (!session) return null;
  return (
    <div className="picker picker--model" tabIndex={-1} ref={box} onKeyDown={onKeyDown} onClick={onClick}>
      {options ? (
        <ModelPicker
          models={models.map((m, i) => ({ id: m.value, name: m.name, note: m.description, current: i === current }))}
          highlighted={highlighted}
          effort={(effort ?? 'medium') as never}
          efforts={efforts as never}
          focusEffort={onEffort}
        />
      ) : (
        <div className="cn-menu">
          <div className="cn-menu__head">
            <b>model</b>
            <span className="cn-fill" />
            <span className="cn-dim">loading{glyph('misc', 'ellipsis')}</span>
          </div>
        </div>
      )}
      <ErrorLine text={error} />
    </div>
  );
}

// ── Mode (a click on the mode badge) ─────────────────────────────────────

export function ModeMenu({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const [highlighted, setHighlighted] = useState(() => Math.max(0, MODES.indexOf(session?.mode ?? 'default')));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useAutofocus<HTMLDivElement>();
  // The design system keeps no-ask out of switching: it's set at launch.
  const why = (mode: Mode) => (mode === 'dontAsk' ? 'set it at launch' : null);

  const choose = async (index: number, confirmed = false) => {
    const mode = MODES[index];
    if (!session || why(mode)) return;
    setHighlighted(index);
    if (mode === 'bypassPermissions' && !confirmed) {
      setConfirming(true); // the second key that names the session (design system principle 5)
      return;
    }
    try {
      await api.setMode(id, mode, mode === 'bypassPermissions' ? session.name : null);
      close();
    } catch (failure) {
      setError(`not switched · ${reason(failure)}`);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const n = Number(event.key);
    if (confirming) {
      if (event.key === '!') void choose(MODES.indexOf('bypassPermissions'), true);
      else if (event.key === 'Escape') setConfirming(false);
      else return;
    } else if (Number.isInteger(n) && n >= 1 && n <= MODES.length) void choose(n - 1);
    else if (event.key === 'ArrowDown') setHighlighted((h) => Math.min(MODES.length - 1, h + 1));
    else if (event.key === 'ArrowUp') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'Enter') void choose(highlighted);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  if (!session) return null;
  const current = session.mode ?? 'default';
  return (
    <div className="picker" tabIndex={-1} ref={box} onKeyDown={onKeyDown}>
      <div className={`cn-menu cn-picker picker--narrow${confirming ? ' picker--danger' : ''}`} role="dialog" aria-label="mode">
        <div className="cn-menu__head">
          <b>mode</b>
          <span className="cn-dim">{session.name}</span>
          <span className="cn-fill" />
          <span className="cn-dim">applies from the next tool call</span>
        </div>
        <div role="radiogroup" aria-label="mode">
          {MODES.map((mode, i) => {
            const off = why(mode);
            const on = i === highlighted;
            return (
              <div
                key={mode}
                role="radio"
                aria-checked={mode === current}
                aria-disabled={!!off}
                className={`cn-menu__item picker__row${on ? ' cn-menu__item--on' : ''}${off ? ' cn-menu__item--off' : ''}`}
                onClick={() => void choose(i)}
              >
                <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
                <span className={`cn-radio${mode === current ? ' cn-radio--on' : ''}`}>{glyph('misc', mode === current ? 'radio_on' : 'radio_off')}</span>
                <span className="cn-menu__name picker__mode">
                  {off ? ' ' : i + 1} <ModeBadge mode={mode} />
                </span>
                <span className="cn-menu__desc">{off ? <i>{off}</i> : MODE_NOTE[mode]}</span>
              </div>
            );
          })}
        </div>
        {confirming ? (
          <div className="cn-risk cn-risk--critical picker__confirm">
            <span className="cn-chip cn-chip--critical">
              {glyph('alert', 'critical')} bypass
            </span>{' '}
            every tool in <b>{session.name}</b> runs unchecked. <b>!</b> again to confirm
          </div>
        ) : null}
        <ErrorLine text={error} />
        <div className="cn-menu__foot">
          <KeyHints keys={confirming ? [['!', 'bypass'], ['esc', 'cancel']] : [['1-5', 'pick'], ['enter', 'apply'], ['esc', 'close']]} />
          <span className="cn-fill" />
          {confirming ? (
            <button type="button" className="cn-btn cn-btn--danger" onClick={() => void choose(MODES.indexOf('bypassPermissions'), true)}>
              Bypass <span className="cn-btn__key">!</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Context (/context, or a click on the context bar) ────────────────────

/** Claude Code's categories, in the design system's tones for the breakdown bar. */
const TONE: Record<string, 'system' | 'tools' | 'mcp' | 'memory' | 'messages'> = {
  system_prompt: 'system',
  system_tools: 'tools',
  mcp_tools: 'mcp',
  custom_agents: 'tools',
  skills: 'tools',
  memory_files: 'memory',
  messages: 'messages',
};

export function ContextCard({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const [usage, setUsage] = useState<ContextUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useAutofocus<HTMLDivElement>();
  const managed = session?.kind === 'managed';

  useEffect(() => {
    if (managed) api.context(id).then(setUsage, (failure: unknown) => setError(reason(failure)));
  }, [id, managed]);

  const compact = () =>
    api.prompt(id, '/compact').then(close, (failure: unknown) => setError(`not sent · ${reason(failure)}`));
  const clear = () => {
    if (session?.pending.length) store.set({ dialog: { kind: 'clear', session: id } });
    else api.prompt(id, '/clear').then(close, (failure: unknown) => setError(`not sent · ${reason(failure)}`));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') close();
    else if (managed && event.key === 'c') void compact();
    else if (managed && event.key === 'C') clear();
    else return;
    event.preventDefault();
  };

  if (!session) return null;
  const used = usage
    ? usage.categories.filter((c) => c.kind === 'used' && c.tokens > 0)
    : [];
  return (
    <div className="picker" tabIndex={-1} ref={box} onKeyDown={onKeyDown}>
      <div className="cn-menu cn-picker" role="dialog" aria-label="context">
        <div className="cn-menu__head">
          <b>context</b>
          <span className="cn-dim">{session.name}</span>
          <span className="cn-fill" />
          <span className="cn-dim">{shortModel(usage?.model ?? session.context?.model ?? '')}</span>
        </div>
        <div className="picker__body">
          {usage ? (
            <>
              <ContextBar
                value={Math.round(usage.percent)}
                max={usage.maxTokens}
                compactAt={usage.compactAt ?? 1}
                slices={used.map((c) => ({ label: c.name.toLowerCase(), tokens: c.tokens, tone: TONE[c.id] ?? 'system' }))}
              />
              {usage.memoryFiles.length ? (
                <div className="picker__files">
                  {usage.memoryFiles.map((file) => (
                    <div key={file.path} className="cn-ellipsis">
                      <span className="cn-dim">memory</span> {file.path} <span className="cn-dim">{Math.round(file.tokens / 100) / 10}k</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {!usage.autoCompact ? <div className="cn-dim">auto-compact is off</div> : null}
            </>
          ) : managed ? (
            error ? null : <span className="cn-dim">reading{glyph('misc', 'ellipsis')}</span>
          ) : (
            <>
              <ContextBar value={Math.round(session.context?.percent ?? 0)} max={session.context?.windowTokens ?? undefined} cells={16} />
              <div className="cn-dim">external session · the breakdown needs a managed one (adopt it)</div>
            </>
          )}
          <ErrorLine text={error} />
        </div>
        <div className="cn-menu__foot">
          <KeyHints keys={[['esc', 'close']]} />
          <span className="cn-fill" />
          {managed ? (
            <>
              <button type="button" className="cn-btn" onClick={clear}>
                /clear <span className="cn-btn__key">C</span>
              </button>
              <button type="button" className="cn-btn" onClick={() => void compact()}>
                /compact <span className="cn-btn__key">c</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Usage (/usage, :usage, or a click on the cost in the status line) ───────────

const GB = 1024 ** 3;

/**
 * Design system: tokens per turn (`Sparkline`), the input / cache / output split and the cost; plus what the session's
 * processes cost the machine over the last 30 minutes, against your limits (roadmap 4.4).
 */
export function UsageCard({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const now = useStore((s) => s.now);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useAutofocus<HTMLDivElement>();

  useEffect(() => {
    api.usage(id).then(setReport, (failure: unknown) => setError(reason(failure)));
  }, [id, session?.costUsd]);
  useEffect(() => {
    api.limits().then(setLimits, () => {});
  }, []);

  if (!session) return null;
  const r = session.resources;
  const perTurn = report?.turns.map((t) => t.input + t.cacheWrite + t.cacheRead + t.output) ?? [];
  const models = Object.entries(report?.byModel ?? {}).filter(([, usd]) => usd > 0);
  const memLimit = limits?.memoryGb ?? null;
  const gpuLimit = limits?.gpuGb ?? null;
  return (
    <div
      className="picker"
      tabIndex={-1}
      ref={box}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        close();
      }}
    >
      <div className="cn-menu cn-picker usage" role="dialog" aria-label="usage">
        <div className="cn-menu__head">
          <b>usage</b>
          <span className="cn-dim">{session.name}</span>
          <span className="cn-fill" />
          <span className="cn-dim">since it started {ago(session.startedAt, now)} ago</span>
        </div>
        <div className="picker__body">
          {report ? (
            <>
              <div className="usage__row">
                {perTurn.length ? (
                  <Sparkline values={perTurn} label="tok" current={count(perTurn[perTurn.length - 1])} />
                ) : (
                  <span className="cn-dim">no replies yet</span>
                )}
                <span className="cn-dim">tokens per turn · the last {perTurn.length}</span>
              </div>
              <div className="usage__row">
                <span className="cn-dim">input</span> {count(report.input)}
                <span className="cn-dim">cache write</span> {count(report.cacheWrite)}
                <span className="cn-dim">cache read</span> {count(report.cacheRead)}
                <span className="cn-dim">output</span> {count(report.output)}
              </div>
              <div className="usage__row">
                <b>{cost(report.costUsd) ?? '$0.00'}</b>
                {models.length > 1
                  ? models.map(([model, usd]) => (
                      <span key={model}>
                        <span className="cn-dim">{shortModel(model)}</span> {cost(usd)}
                      </span>
                    ))
                  : null}
              </div>
              {report.estimated ? (
                <div className="cn-dim">
                  priced here from the transcript: Claude Code's own side calls, such as titles and compaction, aren't in it
                </div>
              ) : null}
            </>
          ) : error ? null : (
            <span className="cn-dim">reading{glyph('misc', 'ellipsis')}</span>
          )}
          <div className="cn-label usage__section">the machine · last 30 minutes</div>
          {r ? (
            <>
              <div className="usage__row">
                <Sparkline
                  values={r.cpuHistory.map(Math.round)}
                  label="cpu"
                  current={`${Math.round(r.cpu)}%`}
                  warn={limits?.cpuPercent}
                  max={Math.max(400, ...r.cpuHistory)}
                />
                <span className="cn-dim">{r.processes} processes</span>
              </div>
              <div className="usage__row">
                <Sparkline
                  values={r.memoryHistory.map((b) => b / GB)}
                  label="mem"
                  current={gb(r.memory)}
                  warn={memLimit ? memLimit * 0.8 : undefined}
                  crit={memLimit ?? undefined}
                  max={Math.max(memLimit ?? 0, ...r.memoryHistory.map((b) => b / GB))}
                />
              </div>
              {r.gpu != null ? (
                <div className="usage__row">
                  <Sparkline
                    values={r.gpuHistory.map((b) => b / GB)}
                    label="gpu"
                    current={gb(r.gpu)}
                    warn={gpuLimit ? gpuLimit * 0.8 : undefined}
                    crit={gpuLimit ?? undefined}
                    max={Math.max(gpuLimit ?? 0, ...r.gpuHistory.map((b) => b / GB))}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <span className="cn-dim">no sample yet</span>
          )}
          {session.alerts.length ? (
            <div className="usage__row">
              {session.alerts.map((alert) => (
                <AlertFlag key={alert.kind} level={alert.level} label={alert.text} />
              ))}
            </div>
          ) : null}
          {limits ? (
            <div className="cn-dim">
              limits: memory {limits.memoryGb ?? '—'} GB · GPU {limits.gpuGb ?? '—'} GB · CPU {limits.cpuPercent}% for 5m ·
              :limit changes them
            </div>
          ) : null}
          <ErrorLine text={error} />
        </div>
        <div className="cn-menu__foot">
          <KeyHints keys={[['esc', 'close']]} />
        </div>
      </div>
    </div>
  );
}

/** /clear on a session still waiting on questions: they go unanswered, so it asks first (design system). */
export function ClearDialog({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const [error, setError] = useState<string | null>(null);
  const box = useAutofocus<HTMLDivElement>();
  const clear = () => api.prompt(id, '/clear').then(close, (failure: unknown) => setError(`not sent · ${reason(failure)}`));
  if (!session) return null;
  const waiting = session.pending.length;
  return (
    <div
      className="cn-dialog cn-dialog--small dialog-keys"
      role="alertdialog"
      aria-label={`clear ${session.name}?`}
      tabIndex={-1}
      ref={box}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
        else if (event.key === 'Enter') void clear();
        else return;
        event.preventDefault();
      }}
    >
      <div className="cn-dialog__title">
        <span className="cn-msg--slash">{glyph('message', 'slash')}</span> <b>clear {session.name}?</b>
      </div>
      <div>The conversation starts empty. This one stays on disk: <b>/resume</b> brings it back.</div>
      {waiting ? (
        <div className="cn-status--waiting">
          {glyph('status', 'waiting')} it is waiting on {waiting} question{waiting > 1 ? 's' : ''}; they will go unanswered
        </div>
      ) : null}
      <ErrorLine text={error} />
      <div className="cn-dialog__foot">
        <span className="cn-fill" />
        <button type="button" className="cn-btn" onClick={close}>
          Cancel <span className="cn-btn__key">esc</span>
        </button>
        <button type="button" className="cn-btn cn-btn--primary" onClick={() => void clear()}>
          Clear <span className="cn-btn__key">enter</span>
        </button>
      </div>
    </div>
  );
}

// ── MCP servers (/mcp, or a click on the mcp segment) ─────────────────────

const MCP_STATE: Record<McpServer['status'], { glyph: string; className: string; word: string }> = {
  connected: { glyph: glyph('status', 'working'), className: 'cn-msg--answer', word: 'connected' },
  failed: { glyph: glyph('status', 'error'), className: 'cn-status--error', word: 'failed' },
  disabled: { glyph: glyph('status', 'idle'), className: 'cn-dim', word: 'disabled' },
  pending: { glyph: glyph('status', 'stale'), className: 'cn-dim', word: 'connecting' },
  'needs-auth': { glyph: glyph('status', 'waiting'), className: 'cn-level--warning', word: 'needs auth' },
};

export function McpPicker({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useAutofocus<HTMLDivElement>();

  useEffect(() => {
    api.mcp(id).then(setServers, (failure: unknown) => setError(reason(failure)));
  }, [id]);

  const act = async (kind: 'reconnect' | 'toggle', server: McpServer | undefined) => {
    if (!server || busy) return;
    setBusy(server.name);
    setError(null);
    try {
      setServers(
        kind === 'reconnect'
          ? await api.mcpReconnect(id, server.name)
          : await api.mcpToggle(id, server.name, server.status === 'disabled'),
      );
    } catch (failure) {
      setError(reason(failure));
    } finally {
      setBusy(null);
    }
  };

  const list = servers ?? [];
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'j') setHighlighted((h) => Math.min(list.length - 1, h + 1));
    else if (event.key === 'ArrowUp' || event.key === 'k') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'r') void act('reconnect', list[highlighted]);
    else if (event.key === ' ') void act('toggle', list[highlighted]);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  if (!session) return null;
  const up = list.filter((s) => s.status === 'connected').length;
  return (
    <div className="picker" tabIndex={-1} ref={box} onKeyDown={onKeyDown}>
      <div className="cn-menu cn-picker" role="dialog" aria-label="MCP servers">
        <div className="cn-menu__head">
          <b>mcp</b>
          <span className="cn-dim">{session.name}</span>
          <span className="cn-fill" />
          <span className="cn-dim">{servers ? `${up} of ${list.length} connected` : `reading${glyph('misc', 'ellipsis')}`}</span>
        </div>
        <div role="listbox" aria-label="servers">
          {list.map((server, i) => {
            const state = MCP_STATE[server.status];
            const on = i === highlighted;
            return (
              <div
                key={server.name}
                role="option"
                aria-selected={on}
                className={`cn-menu__item picker__row${on ? ' cn-menu__item--on' : ''}`}
                onClick={() => setHighlighted(i)}
              >
                <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
                <span className={state.className}>{busy === server.name ? <Spinner /> : state.glyph}</span>
                <span className="cn-menu__name" title={server.name}>{server.name}</span>
                <span className={`picker__state ${state.className}`}>{state.word}</span>
                <span className="cn-menu__desc">
                  {server.error ? (
                    <span className="cn-status--error" title={server.error}>{server.error}</span>
                  ) : server.status === 'connected' ? (
                    `${server.tools} tool${server.tools === 1 ? '' : 's'}`
                  ) : server.status === 'needs-auth' ? (
                    <i>sign in with /mcp in a terminal</i>
                  ) : (
                    ''
                  )}
                  {server.scope ? <span className="cn-dim"> · {server.scope}</span> : null}
                </span>
              </div>
            );
          })}
          {servers && !list.length ? <div className="cn-menu__item cn-dim picker__row">no MCP servers</div> : null}
        </div>
        <ErrorLine text={error} />
        <div className="cn-menu__foot">
          <KeyHints keys={[['↑↓', 'move'], ['r', 'reconnect'], ['space', 'enable or disable'], ['esc', 'close']]} />
        </div>
      </div>
    </div>
  );
}

// ── Resume (C-Space r, /resume) ──────────────────────────────────────────

const WINDOW = 14; // rows of the list shown at once

function windowed<T>(items: T[], highlighted: number): { shown: T[]; offset: number } {
  const offset = Math.max(0, Math.min(items.length - WINDOW, highlighted - Math.floor(WINDOW / 2)));
  return { shown: items.slice(offset, offset + WINDOW), offset };
}

function previewLines(preview: SessionPreview | undefined): string[] {
  if (!preview) return [`loading${glyph('misc', 'ellipsis')}`];
  return preview.lines.map((line) => `${glyph('message', line.kind === 'prompt' ? 'prompt' : 'reply')} ${line.text}`);
}

export function ResumeDialog() {
  const now = useStore((s) => s.now);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState<'search' | 'tag' | null>(null);
  const [tagText, setTagText] = useState('');
  const [list, setList] = useState<PastSession[] | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [previews, setPreviews] = useState<Record<string, SessionPreview>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useAutofocus<HTMLDivElement>();

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        api.history(query).then(
          (found) => {
            setList(found);
            setHighlighted(0);
          },
          (failure: unknown) => setError(reason(failure)),
        ),
      query ? 200 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  const current = list?.[highlighted];
  useEffect(() => {
    if (!current || previews[current.sessionId]) return;
    const timer = window.setTimeout(
      () =>
        api.preview(current.sessionId, current.cwd).then(
          (preview) => setPreviews((all) => ({ ...all, [preview.sessionId]: preview })),
          () => {},
        ),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [current?.sessionId]);

  const resume = async (fork: boolean) => {
    if (!current || busy) return;
    if (current.running && !fork) {
      store.focus(current.running); // one process per session: it's already on the map
      close();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.resume(current.sessionId, fork);
      close();
      store.open(id); // design system: resume opens in a new pane
    } catch (failure) {
      setError(reason(failure));
      setBusy(false);
    }
  };

  const saveTag = async () => {
    if (!current) return;
    try {
      await api.tag(current.sessionId, tagText.trim() || null);
      setList((all) => all?.map((s) => (s.sessionId === current.sessionId ? { ...s, tag: tagText.trim() || null } : s)) ?? null);
      setTyping(null);
      box.current?.focus();
    } catch (failure) {
      setError(reason(failure));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (typing) return; // the field below has the keys
    const count = list?.length ?? 0;
    if (event.key === 'ArrowDown' || event.key === 'j') setHighlighted((h) => Math.min(count - 1, h + 1));
    else if (event.key === 'ArrowUp' || event.key === 'k') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'Enter') void resume(false);
    else if (event.key === 'f') void resume(true);
    else if (event.key === 't' && current) {
      setTagText(current.tag ?? '');
      setTyping('tag');
    } else if (event.key === '/') setTyping('search');
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  };

  const { shown, offset } = windowed(list ?? [], highlighted);
  const sessions = shown.map((s) => {
    const preview = previews[s.sessionId];
    return {
      id: s.sessionId,
      name: s.name,
      project: s.project,
      when: ago(s.modified, now),
      turns: preview?.turns ?? 0,
      preview: previewLines(preview),
      tag: [s.running ? 'running' : null, s.tag].filter(Boolean).join(' · ') || undefined,
    };
  });

  return (
    <div
      className="picker picker--resume"
      tabIndex={-1}
      ref={box}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        const index = rowIndex(event, '.cn-menu__item');
        if (index < 0) return;
        setHighlighted(offset + index);
        if (event.detail === 2) void resume(false);
      }}
    >
      {list ? (
        <ResumePicker sessions={sessions} highlighted={highlighted - offset} query={query} />
      ) : (
        <div className="cn-menu cn-resume">
          <div className="cn-menu__head">
            <b>resume</b>
            <span className="cn-fill" />
            <span className="cn-dim">reading{glyph('misc', 'ellipsis')}</span>
          </div>
        </div>
      )}
      {current?.running ? (
        <div className="cn-dim picker__note">running now · enter goes to it, f forks it</div>
      ) : null}
      {typing ? (
        <div className="cn-input picker__input">
          <span className="cn-dim">{typing === 'search' ? '/' : 'tag: '}</span>
          <input
            autoFocus
            value={typing === 'search' ? query : tagText}
            spellCheck={false}
            aria-label={typing === 'search' ? 'search past sessions' : 'tag'}
            onChange={(event) => (typing === 'search' ? setQuery(event.target.value) : setTagText(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (typing === 'tag') void saveTag();
                else {
                  setTyping(null);
                  box.current?.focus();
                }
              } else if (event.key === 'Escape') {
                if (typing === 'search') setQuery('');
                setTyping(null);
                box.current?.focus();
              } else if (typing === 'search' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                setHighlighted((h) => Math.max(0, Math.min((list?.length ?? 1) - 1, h + (event.key === 'ArrowDown' ? 1 : -1))));
              } else return;
              event.preventDefault();
            }}
          />
          <span className="cn-dim">{typing === 'search' ? `${list?.length ?? 0} found` : 'enter save · empty clears'}</span>
        </div>
      ) : null}
      <ErrorLine text={error} />
    </div>
  );
}

// ── Rewind (esc esc in the prompt box, /rewind) ──────────────────────────

/** Inside the project: relative to it. Outside: shortened in the middle (design system: truncation). */
export function shortPath(path: string, cwd: string): string {
  const root = cwd.endsWith('/') ? cwd : `${cwd}/`;
  if (path.startsWith(root)) return path.slice(root.length);
  const parts = path.split('/');
  return parts.length > 4 ? [...parts.slice(0, 2), glyph('misc', 'ellipsis'), ...parts.slice(-2)].join('/') : path;
}

type Rewind = { files: boolean; conversation: boolean };
const REWINDS: Array<{ key: string; label: string; how: Rewind }> = [
  { key: 'enter', label: 'code and conversation', how: { files: true, conversation: true } },
  { key: 'c', label: 'conversation only', how: { files: false, conversation: true } },
  { key: 'f', label: 'files only', how: { files: true, conversation: false } },
];

export function RewindDialog({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const now = useStore((s) => s.now);
  const [prompts, setPrompts] = useState<Turn[] | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [previews, setPreviews] = useState<Record<string, RewindPreview>>({});
  const [confirm, setConfirm] = useState<Rewind | null>(null); // asked again: files outside the project change
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useAutofocus<HTMLDivElement>();

  useEffect(() => {
    api.turns(id).then(
      (turns) => setPrompts(turns.filter((t) => t.entry.kind === 'prompt' && !t.abandoned).reverse()),
      (failure: unknown) => setError(reason(failure)),
    );
  }, [id]);

  const current = prompts?.[highlighted];
  const preview = current ? previews[current.entry.id] : undefined;
  useEffect(() => {
    if (!current || previews[current.entry.id]) return;
    api.rewindPreview(id, current.entry.id).then(
      (found) => setPreviews((all) => ({ ...all, [current.entry.id]: found })),
      () => {},
    );
  }, [current?.entry.id]);

  const rewind = async (how: Rewind) => {
    if (!current || busy || !session) return;
    if (how.files && preview?.outside.length && !confirm) {
      setConfirm(how);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const text = (await api.content(id, current.entry.id).catch(() => null))?.text ?? current.entry.text;
      const { id: next } = await api.rewind(id, { entry: current.entry.id, ...how });
      close();
      if (how.conversation) {
        // As in Claude Code: the prompt you went back to waits in the box, to edit and send again.
        store.set({ draft: { session: next, text, nonce: Date.now() } });
        store.focus(next);
      }
    } catch (failure) {
      setError(reason(failure));
      setBusy(false);
      setConfirm(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = prompts?.length ?? 0;
    if (confirm) {
      if (event.key === 'Enter') void rewind(confirm);
      else if (event.key === 'Escape') setConfirm(null);
      else return;
    } else if (event.key === 'ArrowDown' || event.key === 'j') setHighlighted((h) => Math.min(count - 1, h + 1));
    else if (event.key === 'ArrowUp' || event.key === 'k') setHighlighted((h) => Math.max(0, h - 1));
    else if (event.key === 'Escape') close();
    else {
      const choice = REWINDS.find((r) => r.key === (event.key === 'Enter' ? 'enter' : event.key));
      if (!choice) return;
      void rewind(choice.how);
    }
    event.preventDefault();
  };

  if (!session) return null;
  const { shown, offset } = windowed(prompts ?? [], highlighted);
  return (
    <div className="picker" tabIndex={-1} ref={box} onKeyDown={onKeyDown}>
      <div className={`cn-menu cn-resume${confirm ? ' picker--danger' : ''}`} role="dialog" aria-label="rewind">
        <div className="cn-menu__head">
          <b>rewind</b>
          <span className="cn-dim">{session.name}</span>
          <span className="cn-fill" />
          <span className="cn-dim">{prompts ? `${prompts.length} prompts, newest first` : `reading${glyph('misc', 'ellipsis')}`}</span>
        </div>
        <div className="cn-resume__body">
          <div className="cn-resume__list" role="listbox" aria-label="prompts">
            {shown.map((turn, i) => {
              const on = offset + i === highlighted;
              return (
                <div
                  key={turn.entry.id}
                  role="option"
                  aria-selected={on}
                  className={`cn-menu__item picker__row${on ? ' cn-menu__item--on' : ''}`}
                  onClick={() => setHighlighted(offset + i)}
                >
                  <span className="cn-row__bar">{on ? glyph('tree', 'cursor') : ' '}</span>
                  <span className="cn-msg--prompt">{turn.turn}</span>
                  <span className="cn-ellipsis picker__prompt">{turn.entry.text}</span>
                  <span className="cn-fill" />
                  <span className="cn-dim">{ago(Date.parse(turn.entry.at ?? ''), now)}</span>
                </div>
              );
            })}
            {prompts && !prompts.length ? <div className="cn-menu__item cn-dim picker__row">no prompts yet</div> : null}
          </div>
          <div className="cn-resume__preview" aria-label="what it restores">
            {preview ? (
              <>
                <div className="cn-dim">
                  back to turn {current?.turn} · {preview.turns} turn{preview.turns === 1 ? '' : 's'} drop from the conversation
                </div>
                <div>
                  {preview.files.length ? `restores ${preview.files.length} file${preview.files.length === 1 ? '' : 's'}` : 'no file edits since'}
                </div>
                {preview.files.slice(0, 12).map((path) => (
                  <div key={path} className="cn-ellipsis picker__file" title={path}>
                    <span className="cn-level--warning">{preview.outside.includes(path) ? glyph('alert', 'warning') : ' '}</span>{' '}
                    {shortPath(path, session.cwd)}
                  </div>
                ))}
                {preview.files.length > 12 ? <div className="cn-dim">and {preview.files.length - 12} more</div> : null}
                {preview.outside.length ? (
                  <div className="cn-level--warning">
                    {glyph('alert', 'warning')} {preview.outside.length} outside the project
                  </div>
                ) : null}
              </>
            ) : current ? (
              <span className="cn-dim">reading{glyph('misc', 'ellipsis')}</span>
            ) : null}
          </div>
        </div>
        {confirm ? (
          <div className="cn-level--warning picker__confirm">
            {glyph('alert', 'warning')} files outside the project change too · <b>enter</b> again to rewind
          </div>
        ) : null}
        <ErrorLine text={error} />
        <div className="cn-menu__foot">
          <KeyHints keys={confirm ? [['enter', 'rewind'], ['esc', 'back']] : [...REWINDS.map((r) => [r.key, r.label] as [string, string]), ['esc', 'close']]} />
        </div>
      </div>
    </div>
  );
}

// ── Adopting a terminal session (A) ──────────────────────────────────────

export function AdoptDialog({ id }: { id: string }) {
  const session = useStore((s) => s.sessions[id]);
  const [error, setError] = useState<string | null>(null);
  const box = useAutofocus<HTMLDivElement>();
  const pane = session?.tmux?.split('.').pop();

  // Once it's adopted, the old node leaves the map and its managed copy takes focus: nothing left to show.
  useEffect(() => {
    if (!session) close();
  }, [session]);

  const adopt = () => api.adopt(id).catch((failure: unknown) => setError(reason(failure)));
  const cancel = () => {
    if (session?.adopting) void api.cancelAdopt(id).catch(() => {});
    close();
  };
  const terminal = () => api.terminal(id).catch((failure: unknown) => setError(reason(failure)));

  if (!session) return null;
  return (
    <div
      className="cn-dialog cn-dialog--small dialog-keys"
      role="dialog"
      aria-label={`adopt ${session.name}?`}
      tabIndex={-1}
      ref={box}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel();
        else if (event.key === 'Enter' && !session.adopting) void adopt();
        else if (event.key === 'g' && pane) void terminal();
        else return;
        event.preventDefault();
      }}
    >
      <div className="cn-dialog__title">
        <KindMarkGlyph external /> <b>adopt {session.name}?</b>
      </div>
      <div>
        Close it in its terminal first (<b>/exit</b>). Constellation then resumes it here by its id: the same conversation, now
        managed {glyph('kind', 'managed')}.
      </div>
      {pane ? <div className="cn-dim">it runs in tmux pane {pane}</div> : <div className="cn-dim">it isn't in tmux: close it where you started it</div>}
      {session.adopting ? (
        <div className="cn-status--working">
          <Spinner /> waiting for its terminal copy to exit{glyph('misc', 'ellipsis')}
        </div>
      ) : null}
      <ErrorLine text={error} />
      <div className="cn-dialog__foot">
        {pane ? <KeyHints keys={[['g', 'go to terminal']]} /> : null}
        <span className="cn-fill" />
        <button type="button" className="cn-btn" onClick={cancel}>
          {session.adopting ? 'Stop waiting' : 'Cancel'} <span className="cn-btn__key">esc</span>
        </button>
        {session.adopting ? null : (
          <button type="button" className="cn-btn cn-btn--primary" onClick={() => void adopt()}>
            Adopt <span className="cn-btn__key">enter</span>
          </button>
        )}
      </div>
    </div>
  );
}

function KindMarkGlyph({ external }: { external: boolean }) {
  return <span className={external ? 'cn-kind--external' : 'cn-kind--managed'}>{glyph('kind', external ? 'external' : 'managed')}</span>;
}

// ── Hooks for terminal sessions (roadmap 3.12) ───────────────────────────

export function HooksDialog() {
  const status = useStore((s) => s.hooks);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useAutofocus<HTMLDivElement>();

  const change = async (install: boolean) => {
    setBusy(true);
    setError(null);
    try {
      store.set({ hooks: install ? await api.installHooks() : await api.removeHooks() });
      close();
    } catch (failure) {
      setError(reason(failure));
    } finally {
      setBusy(false);
    }
  };

  const lines: ReactNode[] = useMemo(
    () => [
      <>adds two hooks to <b>{status?.settings ?? '~/.claude/settings.json'}</b>: PermissionRequest, and PreToolUse on AskUserQuestion</>,
      <>they run <b>{status?.script ?? 'a small script'}</b> in every Claude Code session, work ones too, open ones included</>,
      <>it only reports, in about 10 ms: it prints nothing, decides nothing, and does nothing while Constellation isn't running</>,
    ],
    [status],
  );

  return (
    <div
      className="cn-dialog dialog-keys"
      role="dialog"
      aria-label="hooks for terminal sessions"
      tabIndex={-1}
      ref={box}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
        else if (event.key === 'Enter' && !busy) void change(!status?.installed);
        else return;
        event.preventDefault();
      }}
    >
      <div className="cn-dialog__title">
        <b>see what terminal sessions ask</b>
        <span className="cn-fill" />
        <span className={status?.installed ? 'cn-msg--answer' : 'cn-dim'}>
          {status?.installed ? `${glyph('message', 'answer')} installed` : 'not installed'}
        </span>
      </div>
      <div>
        Without hooks, Constellation looks for what a terminal session asks in its transcript. Claude Code often writes the
        call there before it's answered, but not always, and several open calls can't be told apart. With these hooks the
        session tells Constellation itself, every time. Either way it shows read-only: you answer it in its terminal.
      </div>
      <div className="dialog-list">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <ErrorLine text={error} />
      <div className="cn-dialog__foot">
        <span className="cn-fill" />
        <button type="button" className="cn-btn" onClick={close}>
          Cancel <span className="cn-btn__key">esc</span>
        </button>
        <button type="button" className={`cn-btn ${status?.installed ? '' : 'cn-btn--primary'}`} disabled={busy} onClick={() => void change(!status?.installed)}>
          {status?.installed ? 'Remove' : 'Install'} <span className="cn-btn__key">enter</span>
        </button>
      </div>
    </div>
  );
}

// ── An image sent with a prompt (design system: sent images open in the web app) ─────────────

export function ImageDialog({ id, entry, n }: { id: string; entry: string; n: number }) {
  const session = useStore((s) => s.sessions[id]);
  const [failed, setFailed] = useState(false);
  const box = useAutofocus<HTMLDivElement>();
  // An <img> can't send a header: the token goes in the query, as the API allows.
  const src = `/api/sessions/${encodeURIComponent(id)}/entries/${encodeURIComponent(entry)}/images/${n}?token=${encodeURIComponent(TOKEN ?? '')}`;
  return (
    <div
      className="cn-menu picker image-view"
      role="dialog"
      aria-label={`image ${n + 1}`}
      tabIndex={-1}
      ref={box}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        close();
      }}
    >
      <div className="cn-menu__head">
        <span className="cn-dim">{glyph('misc', 'image')}</span>
        <b>image {n + 1}</b>
        <span className="cn-dim">{session?.name}</span>
        <span className="cn-fill" />
        <KeyHints keys={[['esc', 'close']]} />
      </div>
      <div className="image-view__body">
        {failed ? <ErrorLine text="not in the transcript any more" /> : <img src={src} alt={`image ${n + 1}`} onError={() => setFailed(true)} />}
      </div>
    </div>
  );
}
