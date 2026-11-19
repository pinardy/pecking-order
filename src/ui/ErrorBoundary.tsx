import { Component, type ReactNode } from "react";
import { clearAll } from "./store";

/**
 * If something goes wrong anywhere in the game, this is shown instead of a blank page: what
 * happened, a way to carry on, and, since saved data is the likeliest culprit after an update,
 * a way to start afresh. It catches errors from the game loop as well as from the screens.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  private caught = (e: ErrorEvent) => {
    // Browser notices that carry no error (a resize observer running late, say) are not failures.
    if (e.error) this.setState({ error: e.error instanceof Error ? e.error.message : String(e.error) });
  };

  componentDidMount() {
    window.addEventListener("error", this.caught);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.caught);
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <main className="screen crashed" role="alert">
        <h1>Something went wrong</h1>
        <p className="lede">The game hit a problem it could not recover from. Reloading usually sorts it out.</p>
        <p className="fine">{this.state.error}</p>
        <div className="result-actions">
          <button type="button" onClick={() => location.reload()}>Reload</button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              clearAll();
              location.reload();
            }}
          >
            Erase saved data and reload
          </button>
        </div>
        <p className="fine">Erasing forgets your settings, records, unlocks and any arcade run on this device. Try a plain reload first.</p>
      </main>
    );
  }
}
