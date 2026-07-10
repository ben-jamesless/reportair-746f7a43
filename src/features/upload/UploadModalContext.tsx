import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
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

  const open = useCallback(
    (opts?: OpenOpts) =>
      setOpenState({
        open: true,
        areaId: opts?.areaId ?? null,
        albumId: opts?.albumId ?? defaultAlbumId,
        initialFiles: opts?.initialFiles ?? null,
      }),
    [defaultAlbumId]
  );

  const close = useCallback(() => setOpenState({ open: false }), []);

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
        />
      )}
    </UploadModalCtx.Provider>
  );
}

export function useUploadModal(): Ctx {
  const ctx = useContext(UploadModalCtx);
  if (!ctx) throw new Error("useUploadModal must be used inside UploadModalProvider");
  return ctx;
}
