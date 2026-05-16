import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  reloading: boolean;
}

const STORAGE_KEY = "chunk-reload-attempted-at";
const RELOAD_COOLDOWN_MS = 10_000;

const isChunkLoadError = (error: unknown): boolean => {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  const msg = err.message || "";
  const name = err.name || "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
};

/**
 * Catches failed dynamic import errors (typical on Safari after the dev/CDN
 * connection drops) and auto-reloads once so the user isn't stuck on the
 * Suspense fallback spinner forever. Uses sessionStorage to avoid reload loops.
 */
export class ChunkLoadBoundary extends Component<Props, State> {
  state: State = { reloading: false };

  static getDerivedStateFromError(error: Error): State | null {
    if (!isChunkLoadError(error)) return null;
    try {
      const last = Number(sessionStorage.getItem(STORAGE_KEY) || "0");
      if (Date.now() - last < RELOAD_COOLDOWN_MS) {
        // Already tried recently — let the normal error boundary handle it.
        return null;
      }
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      window.location.reload();
      return { reloading: true };
    } catch {
      window.location.reload();
      return { reloading: true };
    }
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) throw error;
  }

  render() {
    if (this.state.reloading) {
      return (
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Reloading…
        </div>
      );
    }
    return this.props.children;
  }
}
