import { KindMark, StatusBadge, StatusBar, glyph } from '@ds';
import { type MouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Boundary } from './Boundary';
import { Conversation } from './Conversation';
import { Launcher, StopDialog } from './Dialogs';
import { ago, task } from './format';
import { HideButton } from './Hide';
import { SessionMap } from './Map';
import { AdoptDialog, ClearDialog, ContextCard, HooksDialog, McpPicker, ModeMenu, ModelDialog, ResumeDialog, RewindDialog } from './Pickers';
import { step } from './Star';
import { numbered, store, useStore } from './store';
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

function Bar({ prefix }: { prefix: boolean }) {
  const sessions = useStore((s) => s.sessions);
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
        windows={[{ n: 0, name: 'map', active: true }]}
        sessions={items.map(({ n, session }) => ({ n, name: session.name, status: session.status, current: session.id === focused }))}
        clock={new Date(now).toTimeString().slice(0, 5)}
        maxName={6}
        prefix={prefix}
      />
    </div>
  );
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

/** The prefix (design system: C-Space, then one key). The rest of the bindings come with panes (5.1). */
function usePrefix(): boolean {
  const [armed, setArmed] = useState(false);
  const live = useRef(false);
  useEffect(() => {
    const arm = (on: boolean) => {
      live.current = on;
      setArmed(on);
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
      if (event.key === 't') store.toggle('tree');
      else if (event.key === 'x') store.toggle('pane');
      else if (event.key === 'c') store.set({ dialog: { kind: 'launcher' } });
      else if (event.key === 'r') store.set({ dialog: { kind: 'resume' } });
      else if (event.key === '0') store.set({ mapFocus: Date.now() });
      else if (event.key === 'a') store.attend();
      else if (event.key === '&') forFocused((id) => store.set({ dialog: { kind: 'stop', session: id } }));
      else if (event.key === ',') forFocused((id) => store.set({ renaming: id }));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return armed;
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
  useAdoptKey();

  useEffect(() => store.start(), []);

  const columns = hidden.tree ? '3ch 0 minmax(0, 1fr)' : `${sizes.tree}px 4px minmax(0, 1fr)`;
  const rows = hidden.pane ? 'minmax(0, 1fr) 0 auto' : `${sizes.map * 100}% 4px minmax(0, 1fr)`;

  return (
    <div className="app" style={{ gridTemplateColumns: columns }}>
      {hidden.tree ? (
        <aside className="app__tree app__tree--hidden">
          <button type="button" className="show-btn" onClick={() => store.toggle('tree')} title="show the message tree · C-Space t" aria-label="show the message tree">
            {glyph('tree', 'collapsed')}
          </button>
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
          <Boundary name="map">
            <SessionMap />
          </Boundary>
        </section>
        {hidden.pane ? (
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
              <Boundary name="pane" key={focused ?? 'none'}>
                {focused ? <Conversation id={focused} /> : <div className="conv-empty cn-dim">no session</div>}
              </Boundary>
            </section>
          </>
        )}
        <Layer />
      </main>
      <Bar prefix={prefix} />
    </div>
  );
}
