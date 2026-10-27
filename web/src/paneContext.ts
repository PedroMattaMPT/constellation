// Which pane a component is in, and whether that pane has focus (roadmap 5.1). Outside the panes: focused.
import { createContext, useContext } from 'react';
import { panes } from './panes';
import { store } from './store';

export const PaneContext = createContext<{ id: string | null; focused: boolean }>({ id: null, focused: true });

export function usePane() {
  return useContext(PaneContext);
}

/** The header's x: closes the pane, or puts the panes away when it's the last one (web). */
export function closeLabel(): string {
  const { windows, win } = store.state;
  return windows.length > 1 || panes(windows[win].layout).length > 1 ? 'close the pane: the session keeps running' : 'minimize the pane';
}

export function closePane(id: string | null) {
  if (id) store.focusPane(id);
  store.closePane();
}
