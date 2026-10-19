import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";
import { GlobalUploadModal } from "./GlobalUploadModal";

type OpenOpts = {
  areaId?: string | null;
  albumId?: string | null;
  initialFiles?: File[];
};

type Ctx = {
  open: (opts?: OpenOpts) => void;
  isOpen: boolean;
};

const UploadModalCtx = createContext<Ctx | null>(null);

type ProviderProps = {
  projectId: string;
  onUploaded?: () => void;
  areas: { id: string; name: string }[];
  defaultAlbumId?: string | null;
  children: ReactNode;
};

/**
 * Project-scoped provider for the global upload modal. Any descendant can call
 * `useUploadModal().open()` to launch it. Mounted once per v2 shell so the
 * modal survives tab navigation.
 *
 * Background uploads: while an upload is running the user can minimise the
 * modal. The modal stays mounted (hidden) so the upload continues, and a
 * floating progress pill lets the user reopen it or watch progress.
 */
export function UploadModalProvider({
  projectId,
  onUploaded,
  areas,
  defaultAlbumId = null,
  children,
}: ProviderProps) {
  const [openState, setOpenState] = useState<
    | { open: true; areaId: string | null; albumId: string | null; initialFiles: File[] | null }
    | { open: false }
  >({ open: false });
  const [minimized, setMinimized] = useState(false);
  const [bgProgress, setBgProgress] = useState<{ done: number; total: number } | null>(null);

  const open = useCallback(
    (opts?: OpenOpts) => {
      setMinimized(false);
      setOpenState({
        open: true,
        areaId: opts?.areaId ?? null,
        albumId: opts?.albumId ?? defaultAlbumId,
        initialFiles: opts?.initialFiles ?? null,
      });
    },
    [defaultAlbumId]
  );

  const close = useCallback(() => {
    setOpenState({ open: false });
    setMinimized(false);
    setBgProgress(null);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => setMinimized(false), []);

  const handleProgress = useCallback((done: number, total: number) => {
    setBgProgress(total > 0 && done < total ? { done, total } : null);
  }, []);

  const value = useMemo<Ctx>(() => ({ open, isOpen: openState.open }), [open, openState.open]);

  return (
    <UploadModalCtx.Provider value={value}>
      {children}
      {openState.open && (
        <GlobalUploadModal
          projectId={projectId}
          areas={areas}
          initialAreaId={openState.areaId}
          albumId={openState.albumId}
          initialFiles={openState.initialFiles}
          onClose={close}
          onUploaded={onUploaded}
          hidden={minimized}
          onMinimize={minimize}
          onProgress={handleProgress}
        />
      )}
      {minimized && openState.open && (
        <button
          type="button"
          onClick={restore}
          aria-label="Upload in progress — click to view"
          className="fixed bottom-4 right-4 z-50 w-64 border border-border bg-background p-3 text-left shadow-lg transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Upload className="h-4 w-4" style={{ color: TERRACOTTA }} />
              {bgProgress
                ? `Uploading ${bgProgress.done} of ${bgProgress.total}`
                : "Upload in progress"}
            </span>
            {bgProgress && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {Math.round((bgProgress.done / bgProgress.total) * 100)}%
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden bg-muted">
            <div
              className="h-full transition-[width] duration-300 ease-out"
              style={{
                backgroundColor: TERRACOTTA,
                width: bgProgress
                  ? `${Math.max(4, (bgProgress.done / bgProgress.total) * 100)}%`
                  : "15%",
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Click to view upload</p>
        </button>
      )}
    </UploadModalCtx.Provider>
  );
}

export function useUploadModal(): Ctx {
  const ctx = useContext(UploadModalCtx);
  if (!ctx) throw new Error("useUploadModal must be used inside UploadModalProvider");
  return ctx;
}
