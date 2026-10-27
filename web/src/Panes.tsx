// The panes below the map (design system: a CSS grid of Panes, split with the tmux keys, gutters that drag). Each pane
// shows one session; the focused one takes the keys. C-Space z zooms it over the map and the other panes.
import { glyph } from '@ds';
import { type PointerEvent, useRef } from 'react';
import { Boundary } from './Boundary';
import { Conversation } from './Conversation';
import { HideButton } from './Hide';
import { PaneContext, closeLabel, closePane, usePane } from './paneContext';
import { type Layout, type Split, find, panes } from './panes';
import { store, useStore } from './store';

/** A 4 px gutter between the two sides of a split; dragging it moves the split. */
function SplitGutter({ split }: { split: Split }) {
  const box = useRef<HTMLDivElement>(null);
  const ratioAt = (event: PointerEvent<HTMLDivElement>) => {
    const parent = box.current?.parentElement?.getBoundingClientRect();
    if (!parent) return split.ratio;
    return split.dir === 'row' ? (event.clientX - parent.left) / parent.width : (event.clientY - parent.top) / parent.height;
  };
  return (
    <div
      ref={box}
      className={`gutter gutter--${split.dir === 'row' ? 'x' : 'y'} split__gutter`}
      role="separator"
      aria-orientation={split.dir === 'row' ? 'vertical' : 'horizontal'}
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) store.resizeSplit(split.id, ratioAt(event));
      }}
      onPointerUp={(event) => store.resizeSplit(split.id, ratioAt(event), true)}
    />
  );
}

function EmptyPane({ id, gone }: { id: string; gone: string | null | undefined }) {
  const { focused } = usePane();
  return (
    <section className={`cn-pane pane${focused ? ' cn-pane--focused' : ''}`} aria-label="empty pane">
      <header className="cn-pane__head">
        <span className="cn-pane__index">{glyph('misc', 'ellipsis')}</span>
        <span className="cn-dim">{gone ? 'its session ended' : 'no session'}</span>
        <span className="cn-fill" />
        <HideButton label={closeLabel()} chord="C-Space x" onClick={() => closePane(id)} />
      </header>
      <div className="conv-empty cn-dim">
        C-Space &apos; picks a session for this pane, or open one from the map or the tree
      </div>
    </section>
  );
}

function Slot({ id, session, gone }: { id: string; session: string | null; gone?: string | null }) {
  const focused = useStore((s) => s.pane === id);
  return (
    <div className="pane-slot" data-pane={id} onMouseDown={() => !focused && store.focusPane(id)}>
      <PaneContext.Provider value={{ id, focused }}>
        <Boundary name="pane" key={session ?? 'empty'}>
          {session ? <Conversation id={session} /> : <EmptyPane id={id} gone={gone} />}
        </Boundary>
      </PaneContext.Provider>
    </div>
  );
}

/** Zoomed, every pane stays mounted (no reload): the sides without the zoomed one are hidden. */
function Tree({ layout, zoomed }: { layout: Layout; zoomed: string | null }) {
  if (layout.kind === 'pane') return <Slot id={layout.id} session={layout.session} gone={layout.gone} />;
  const inA = zoomed ? !!find(layout.a, zoomed) : false;
  const inB = zoomed ? !!find(layout.b, zoomed) : false;
  const side = (here: boolean, other: boolean, basis: string | undefined) =>
    here ? { flex: '1 1 0' } : other ? { display: 'none' } : basis ? { flexBasis: basis } : undefined;
  return (
    <div className={`split split--${layout.dir}`}>
      <div className="split__side" style={side(inA, inB, `calc(${layout.ratio * 100}% - 2px)`)}>
        <Tree layout={layout.a} zoomed={zoomed} />
      </div>
      {inA || inB ? null : <SplitGutter split={layout} />}
      <div className="split__side split__side--rest" style={side(inB, inA, undefined)}>
        <Tree layout={layout.b} zoomed={zoomed} />
      </div>
    </div>
  );
}

/** The current window's panes; zoomed (C-Space z), only the focused one shows. */
export function Panes() {
  const layout = useStore((s) => s.windows[s.win].layout);
  // Below 960 px only the focused pane shows (design system: one pane at a time), as zoomed.
  const zoomed = useStore((s) => (s.zoomed || s.screen === 'narrow' ? s.pane : null));
  return (
    <div className="panes">
      <Tree layout={layout} zoomed={zoomed} />
    </div>
  );
}

/** The window's name in the status bar: the project of the pane it has focused. */
export function windowName(layout: Layout, focus: string | undefined, project: (session: string) => string | undefined): string {
  const order = panes(layout);
  const first = (focus && order.find((p) => p.id === focus)) || order.find((p) => p.session) || order[0];
  const name = (first?.session && project(first.session)) || 'empty';
  return name.length > 12 ? `${name.slice(0, 11)}${glyph('misc', 'ellipsis')}` : name; // tmux keeps window names short
}

