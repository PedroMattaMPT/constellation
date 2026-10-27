import { Component, type ReactNode } from 'react';

/** Keeps one view's crash inside that view: the map, the tree and the pane fail separately. */
export class Boundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="conv-empty">
        <span className="cn-status--error">{this.props.name} failed</span>
        <span className="cn-dim"> · {this.state.error.message} · </span>
        <button type="button" className="cn-btn" onClick={() => this.setState({ error: null })}>
          retry
        </button>
      </div>
    );
  }
}
