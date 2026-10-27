import { KeyHints, KindMark, StatusBadge, StatusBar, glyph } from '@ds';
import { type MouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Boundary } from './Boundary';
import { BroadcastDialog } from './Broadcast';
import { Launcher, StopDialog } from './Dialogs';
import { ago, cost, task } from './format';
import { HideButton } from './Hide';
import { useNotifications } from './Notify';
import { type Direction } from './panes';
import { Panes, windowName } from './Panes';
import { CommandPrompt, FindDialog, GoToDialog, KeysDialog, PREFIX_GROUPS, WaitingDialog, WhichKeyOverlay } from './Keys';
import { SessionMap } from './Map';
import { AdoptDialog, ClearDialog, ContextCard, HooksDialog, ImageDialog, McpPicker, ModeMenu, ModelDialog, ResumeDialog, RewindDialog, UsageCard } from './Pickers';
import type { Session } from './protocol';
import { step } from './Star';
import { type Dialog, numbered, screenFor, store, useStore } from './store';
import { MessageTree } from './Tree';

const SIZES_KEY = 'constellation.layout';

interface Sizes {
  tree: number;
  map: number; // share of the main column, 0–1
}

function loadSizes(): Sizes {
  try {
    const saved = JSON.parse(localStorage.getItem(SIZES_KEY) ?? 'null') as Sizes | null;
    if (saved && saved.tree > 0 && saved.map > 0) return saved;
  } catch {
    // no storage: use the defaults
  }
  return { tree: 280, map: 0.5 };
}

function saveSizes(sizes: Sizes) {
  try {
    localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
  } catch {
    // not remembered, still works
  }
}

/** A 4px gutter dragged with the pointer; reports the pointer position. */
function Gutter({ axis, onDrag, onDone }: { axis: 'x' | 'y'; onDrag: (at: number) => void; onDone: () => void }) {
  const down = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) onDrag(axis === 'x' ? event.clientX : event.clientY);
  };
  return (
    <div
      className={`gutter gutter--${axis}`}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={onDone}
    />
  );
}

function Banner() {
  const connection = useStore((s) => s.connection);
  if (connection === 'live') return null;
  const text = {
    'no-token': 'no token · open the link the server printed',
    unauthorized: 'token refused · open the link the server printed',
    connecting: `connecting${glyph('misc', 'ellipsis')}`,
    offline: `server lost · reconnecting${glyph('misc', 'ellipsis')}`,
  }[connection];
  return <div className={`banner banner--${connection}`}>{text}</div>;
}

/** What the server did on its own and failed at (adopting a session): over the map until you dismiss it. */
function Notices() {
  const notices = useStore((s) => s.notices);
  if (!notices.length) return null;
  const dismiss = (at: number) => store.set({ notices: store.state.notices.filter((n) => n.at !== at) });
  return (
    <div className="notices" role="alert">
      {notices.map((notice) => (
        <div key={notice.at} className="notice">
          <span className="cn-status--error">{glyph('status', 'error')}</span>
          <span className="notice__text">{notice.text}</span>
          <button type="button" className="hide-btn" onClick={() => dismiss(notice.at)} title="dismiss" aria-label="dismiss">
            x
          </button>
        </div>
      ))}
    </div>
  );
}

/** While the prefix waits for its key, the bar shows what the key can be (design system: prefix indicator). */
const BAR_HINTS = PREFIX_GROUPS.flatMap((group) => group.keys);

function Bar({ prefix }: { prefix: boolean }) {
  const command = useStore((s) => s.command);
  const sessions = useStore((s) => s.sessions);
  const today = useStore((s) => s.totals.todayUsd);
  const windows = useStore((s) => s.windows);
  const win = useStore((s) => s.win);
  const onMap = useStore((s) => s.screen === 'narrow' && s.mapShown);
  const focused = useStore((s) => s.focused);
  const now = useStore((s) => s.now);
  const items = useMemo(() => numbered(sessions), [sessions]);
  const [tip, setTip] = useState<{ n: number; left: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  // StatusBar draws plain spans; find the session under the pointer by the number it shows.
  const hit = (target: EventTarget) => {
    const entry = (target as HTMLElement).closest('.cn-bar__s, .cn-bar__sessions .cn-chip--waiting');
    const number = entry?.querySelector('.cn-bar__n')?.textContent ?? entry?.textContent?.match(/^\d+/)?.[0];
    const found = items.find((x) => String(x.n) === number);
    return found && entry ? { found, entry } : null;
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const tab = (event.target as HTMLElement).closest('.cn-bar__win');
    if (tab) {
      const n = Number(tab.textContent?.match(/^\d+/)?.[0]);
      if (n === 0) store.showMap();
      else store.selectWindow(n);
      return;
    }
    const found = hit(event.target)?.found;
    if (found) store.focus(found.session.id);
  };
  // Hovering a session shows its task and latest step (design system: web layout); the bar's own titles stay out.
  const onOver = (event: MouseEvent<HTMLDivElement>) => {
    const over = hit(event.target);
    if (!over) return setTip(null);
    const box = over.entry.getBoundingClientRect();
    setTip({ n: over.found.n, left: Math.max(8, Math.min(box.left, window.innerWidth - 480)) });
  };
  useEffect(() => {
    bar.current?.querySelectorAll('.cn-bar__sessions [title]').forEach((el) => el.removeAttribute('title'));
  });
  const shown = tip ? items.find((x) => x.n === tip.n)?.session : null;

  if (command) return <div className="app__bar"><CommandPrompt /></div>;
  if (prefix) {
    return (
      <div className="app__bar">
        <footer className="cn-bar" role="status">
          <span className="cn-chip cn-chip--brand">C-Space</span>
          <KeyHints keys={BAR_HINTS} />
          <span className="cn-fill" />
          <span className="cn-dim">esc cancel</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="app__bar" ref={bar} onClick={onClick} onMouseOver={onOver} onMouseLeave={() => setTip(null)}>
      {shown && tip ? (
        <div className="bar-tip" style={{ left: tip.left }} role="tooltip">
          <span className="cn-b">{tip.n} {shown.name}</span>
          <StatusBadge status={shown.status} compact />
          <span className="cn-ellipsis">{task(shown)}</span>
          {step(shown) ? (
            <>
              <span className="cn-sep">{glyph('misc', 'separator')}</span>
              <span className="cn-dim cn-ellipsis">{step(shown)}</span>
            </>
          ) : null}
        </div>
      ) : null}
      <StatusBar
        windows={[
          { n: 0, name: 'map', active: onMap },
          ...windows.map((w, i) => ({ n: i + 1, name: windowName(w.layout, w.focus, (id) => sessions[id]?.project), active: !onMap && i === win })),
        ]}
        sessions={items.map(({ n, session }) => ({ n, name: session.name, status: session.status, current: session.id === focused }))}
        clock={new Date(now).toTimeString().slice(0, 5)}
        maxName={6}
        prefix={prefix}
        cost={cost(today)}
        warnings={warnings(items.map((x) => x.session))}
      />
    </div>
  );
}

/** The status bar's `△ n` (design system): every alert on every session. */
export function warnings(sessions: Session[]): number {
  return sessions.reduce((n, s) => n + s.alerts.length, 0);
}

/** After C-Space, the keys for the focused session that only a managed one takes. */
function forFocused(act: (id: string) => void) {
  const { focused, sessions } = store.state;
  if (focused && sessions[focused]?.kind === 'managed') act(focused);
}

/** A for adopt (design system): on the focused external session, when no field or dialog has the keys. */
function useAdoptKey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'A' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [role="dialog"], [role="alertdialog"], .picker, .dialog-keys') || store.state.dialog) return;
      const { focused, sessions } = store.state;
      if (focused && sessions[focused]?.kind === 'external') {
        event.preventDefault();
        store.set({ dialog: { kind: 'adopt', session: focused } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const WHICH_KEY_MS = 600;

/**
 * The prefix (design system: C-Space, then one key). If no key comes within 600 ms the which-key overlay shows what
 * the key can be. Splits, zoom and windows come with panes (5.1).
 */
function usePrefix(): { armed: boolean; overlay: boolean } {
  const [armed, setArmed] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const live = useRef(false);
  useEffect(() => {
    let timer = 0;
    const arm = (on: boolean) => {
      live.current = on;
      setArmed(on);
      setOverlay(false);
      window.clearTimeout(timer);
      if (on) timer = window.setTimeout(() => setOverlay(true), WHICH_KEY_MS);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === 'Space') {
        event.preventDefault();
        arm(!live.current); // pressed twice: back to normal
        return;
      }
      if (!live.current || ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
      // The key after the prefix belongs to the prefix: keep it from the map and tree.
      event.preventDefault();
      event.stopPropagation();
      arm(false);
      prefixKey(event.key);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(timer);
    };
  }, []);
  return { armed, overlay };
}

/** What each key after the prefix does (esc and unknown keys do nothing). */
const MOVES: Record<string, Direction> = {
  h: 'left', j: 'down', k: 'up', l: 'right', ArrowLeft: 'left', ArrowDown: 'down', ArrowUp: 'up', ArrowRight: 'right',
};

function split(dir: 'row' | 'column') {
  if (store.splitPane(dir)) return;
  store.set({ notices: [...store.state.notices, { text: 'no room to split this pane: close one, or zoom one in (C-Space z)', at: Date.now() }] });
}

function prefixKey(key: string) {
  const dialog = (d: Dialog) => store.set({ dialog: d, command: false });
  if (key === 't') store.toggleTree();
  else if (key === 'x') store.closePane();
  else if (key === '%') split('row');
  else if (key === '"') split('column');
  else if (key === 'z') store.zoom();
  else if (MOVES[key]) store.movePane(MOVES[key]);
  else if (key === 'o') store.nextPane();
  else if (/^[1-9]$/.test(key)) store.selectWindow(Number(key));
  else if (key === 'n') store.nextWindow(1);
  else if (key === 'p') store.nextWindow(-1);
  else if (key === 'g') store.toggleMap();
  else if (key === 'c') dialog({ kind: 'launcher' });
  else if (key === 'r') dialog({ kind: 'resume' });
  else if (key === '0') store.showMap();
  else if (key === 'a') store.attend();
  else if (key === 'A') dialog({ kind: 'waiting' });
  else if (key === "'") dialog({ kind: 'goto' });
  else if (key === 'f') dialog({ kind: 'find' });
  else if (key === 'b') dialog({ kind: 'broadcast' });
  else if (key === '[') store.set({ scroll: store.state.pane });
  else if (key === '?') dialog({ kind: 'keys' });
  else if (key === ':') store.set({ command: true, dialog: null });
  else if (key === '&') forFocused((id) => dialog({ kind: 'stop', session: id }));
  else if (key === ',') forFocused((id) => store.set({ renaming: id }));
}

/** The pane put away: its header stays at the bottom of the map. A click brings the pane back. */
function PaneBar({ id }: { id: string | null }) {
  const sessions = useStore((s) => s.sessions);
  const now = useStore((s) => s.now);
  const item = useMemo(() => numbered(sessions).find((x) => x.session.id === id), [sessions, id]);
  return (
    <button type="button" className="cn-pane__head pane-bar" onClick={() => store.toggle('pane')} title="open the pane · C-Space x">
      {item ? (
        <>
          <span className="cn-pane__index">{item.n}</span>
          <span className="cn-pane__name">{item.session.name}</span>
          <KindMark kind={item.session.kind} />
          <span className="cn-dim cn-ellipsis">{item.session.project}</span>
          <span className="cn-fill" />
          <StatusBadge status={item.session.status} age={ago(item.session.lastActivityAt, now)} />
        </>
      ) : (
        <span className="cn-fill cn-dim">no session</span>
      )}
      <span className="cn-keys__key">C-Space x</span> <span className="cn-keys__label">open</span>
    </button>
  );
}

/** Floating layer (design system): menus, pickers and dialogs open centered over the panes, never full screen. */
function Layer() {
  const dialog = useStore((s) => s.dialog);
  if (!dialog) return null;
  let content;
  switch (dialog.kind) {
    case 'launcher':
      content = <Launcher />;
      break;
    case 'resume':
      content = <ResumeDialog />;
      break;
    case 'hooks':
      content = <HooksDialog />;
      break;
    case 'stop':
      content = <StopDialog id={dialog.session} />;
      break;
    case 'model':
      content = <ModelDialog id={dialog.session} />;
      break;
    case 'mode':
      content = <ModeMenu id={dialog.session} />;
      break;
    case 'context':
      content = <ContextCard id={dialog.session} />;
      break;
    case 'mcp':
      content = <McpPicker id={dialog.session} />;
      break;
    case 'rewind':
      content = <RewindDialog id={dialog.session} />;
      break;
    case 'adopt':
      content = <AdoptDialog id={dialog.session} />;
      break;
    case 'clear':
      content = <ClearDialog id={dialog.session} />;
      break;
    case 'image':
      content = <ImageDialog id={dialog.session} entry={dialog.entry} n={dialog.n} />;
      break;
    case 'usage':
      content = <UsageCard id={dialog.session} />;
      break;
    case 'waiting':
      content = <WaitingDialog />;
      break;
    case 'goto':
      content = <GoToDialog />;
      break;
    case 'keys':
      content = <KeysDialog />;
      break;
    case 'find':
      content = <FindDialog />;
      break;
    case 'broadcast':
      content = <BroadcastDialog />;
      break;
  }
  return (
    <div className="layer" onMouseDown={(event) => event.target === event.currentTarget && store.set({ dialog: null })}>
      {content}
    </div>
  );
}

export function App() {
  const focused = useStore((s) => s.focused);
  const hidden = useStore((s) => s.hidden);
  const [sizes, setSizes] = useState(loadSizes);
  const prefix = usePrefix();
  const dialogOpen = useStore((s) => s.dialog !== null);
  useAdoptKey();
  useNotifications();

  useEffect(() => store.start(), []);

  const zoomed = useStore((s) => s.zoomed);
  const screen = useStore((s) => s.screen);
  const treeOpen = useStore((s) => s.treeOpen);
  const mapShown = useStore((s) => s.mapShown);
  useEffect(() => {
    const onResize = () => {
      const next = screenFor(window.innerWidth);
      if (next !== store.state.screen) store.set({ screen: next, treeOpen: false });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Below 1280 px the tree is a strip that opens over the map (design system: the three layouts).
  const treeAside = screen === 'wide' && !hidden.tree;
  const columns = treeAside ? `${sizes.tree}px 4px minmax(0, 1fr)` : '3ch 0 minmax(0, 1fr)';
  // The map gives way to a zoomed pane, or when put away (C-Space g); the panes, when put away (C-Space x). Below
  // 960 px one of them shows at a time: the map is window 0.
  const rows =
    screen === 'narrow'
      ? mapShown
        ? 'minmax(0, 1fr) 0 0'
        : '0 0 minmax(0, 1fr)'
      : hidden.pane
        ? 'minmax(0, 1fr) 0 auto'
        : zoomed || hidden.map
          ? '0 0 minmax(0, 1fr)'
          : `${sizes.map * 100}% 4px minmax(0, 1fr)`;

  return (
    <div className="app" style={{ gridTemplateColumns: columns }}>
      {!treeAside ? (
        <aside className="app__tree app__tree--hidden">
          <button type="button" className="show-btn" onClick={() => store.toggleTree()} title="show the message tree · C-Space t" aria-label="show the message tree">
            {glyph('tree', 'collapsed')}
          </button>
          {treeOpen && screen !== 'wide' ? (
            <div className="app__tree app__tree--overlay">
              <header className="cn-pane__head side-head">
                <span className="cn-dim">message tree</span>
                <span className="cn-fill" />
                <HideButton label="close the tree" chord="C-Space t" onClick={() => store.toggleTree()} />
              </header>
              <Boundary name="tree">
                <MessageTree />
              </Boundary>
            </div>
          ) : null}
        </aside>
      ) : (
        <>
          <aside className="app__tree">
            <header className="cn-pane__head side-head">
              <span className="cn-dim">message tree</span>
              <span className="cn-fill" />
              <HideButton label="minimize the tree" chord="C-Space t" onClick={() => store.toggle('tree')} />
            </header>
            <Boundary name="tree">
              <MessageTree />
            </Boundary>
          </aside>
          <Gutter axis="x" onDrag={(x) => setSizes((s) => ({ ...s, tree: Math.min(420, Math.max(220, x)) }))} onDone={() => saveSizes(sizes)} />
        </>
      )}
      <main className="app__main" style={{ gridTemplateRows: rows }}>
        <section className="app__map" aria-label="session map">
          <Banner />
          <Notices />
          <Boundary name="map">
            <SessionMap />
          </Boundary>
        </section>
        {hidden.pane && screen !== 'narrow' ? (
          <>
            <div />
            <PaneBar id={focused} />
          </>
        ) : (
          <>
            <Gutter
              axis="y"
              onDrag={(y) => setSizes((s) => ({ ...s, map: Math.min(0.8, Math.max(0.2, y / window.innerHeight)) }))}
              onDone={() => saveSizes(sizes)}
            />
            <section className="app__panes">
              <Panes />
            </section>
          </>
        )}
        <Layer />
        {prefix.armed && prefix.overlay && !dialogOpen ? (
          <div className="layer layer--which">
            <WhichKeyOverlay />
          </div>
        ) : null}
      </main>
      <Bar prefix={prefix.armed} />
    </div>
  );
}
