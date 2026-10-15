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
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-lg transition-colors hover:bg-muted"
        >
          {bgProgress ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              Uploading {bgProgress.done} of {bgProgress.total}…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 text-muted-foreground" />
              Upload in progress
            </>
          )}
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
