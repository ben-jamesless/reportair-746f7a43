import { ChevronDown } from "lucide-react";

import { AreaStatusPicker, type AreaStatus } from "@/components/AreaStatusPicker";
import { PhotoThumb } from "@/components/PhotoThumb";
import type { LightboxPhoto } from "@/components/PhotoLightbox";
import { cn } from "@/lib/utils";
import { NO_AREA, type Area } from "@/lib/projectDetailTypes";

type Props = {
  // Selection (which day + which area filter is active)
  activeDay: string;
  activeArea: string | null;

  // Data
  dayPhotos: LightboxPhoto[];
  areas: Area[];

  // Selection mode
  selectMode: boolean;
  selectedIds: Set<string>;
  photoIndexById: Map<string, number>;

  // Capability
  canEdit: boolean;

  // Per-area collapse state
  isAreaOpen: (key: string) => boolean;
  onToggleAreaOpen: (key: string) => void;

  // Status helpers
  getAreaDayStatus: (areaId: string, dateKey: string) => AreaStatus;
  onSaveAreaDayStatus: (areaId: string, dayKey: string, status: AreaStatus) => void;

  // Selection callbacks
  onToggleSelect: (photoId: string) => void;
  onSetLightboxIndex: (index: number) => void;
};

export function AreaGrid({
  activeDay,
  activeArea,
  dayPhotos,
  areas,
  selectMode,
  selectedIds,
  photoIndexById,
  canEdit,
  isAreaOpen,
  onToggleAreaOpen,
  getAreaDayStatus,
  onSaveAreaDayStatus,
  onToggleSelect,
  onSetLightboxIndex,
}: Props) {
  const filtered = activeArea === null
    ? dayPhotos
    : activeArea === NO_AREA
      ? dayPhotos.filter((p) => !p.area_id)
      : dayPhotos.filter((p) => p.area_id === activeArea);

  const byArea = new Map<string, LightboxPhoto[]>();
  const unassigned: LightboxPhoto[] = [];
  for (const p of filtered) {
    if (!p.area_id) unassigned.push(p);
    else {
      const arr = byArea.get(p.area_id) ?? [];
      arr.push(p);
      byArea.set(p.area_id, arr);
    }
  }

  const orderedAreas = areas.filter((a) => (byArea.get(a.id)?.length ?? 0) > 0);

  return (
    <div>
      {orderedAreas.map((ar) => {
        const list = byArea.get(ar.id) ?? [];
        const st = getAreaDayStatus(ar.id, activeDay);
        const areaKey = `gallery|${ar.id}|${activeDay}`;
        const open = isAreaOpen(areaKey);
        return (
          <div key={ar.id}>
            <article
              className={cn(
                "rounded-xl border border-border bg-card overflow-hidden border-l-4 py-4 pl-4 pr-4 mb-3",
                st === "complete" && "border-l-[#3A7D44]",
                st === "on_track" && "border-l-[#3A6EA5]",
                st === "requires_discussion" && "border-l-[#D94F2A]",
                st === "concern" && "border-l-[#C7382A]",
                !st && "border-l-[#9C9A93]",
              )}
            >
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleAreaOpen(areaKey)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={open ? "Collapse area" : "Expand area"}
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
                </button>
                <h3 className="text-sm font-semibold text-foreground">{ar.name}</h3>
                <span className="text-xs text-muted-foreground">
                  {list.length} photo{list.length === 1 ? "" : "s"}
                </span>
                <AreaStatusPicker
                  value={st}
                  onChange={(s) => onSaveAreaDayStatus(ar.id, activeDay, s)}
                  className="ml-auto"
                  readOnly={!canEdit}
                />
              </header>
              {open && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {list.map((p) => (
                    <PhotoThumb
                      key={p.id}
                      path={p.storage_path}
                      alt={p.caption || p.file_name}
                      selectable={selectMode}
                      selected={selectedIds.has(p.id)}
                      gpsAuto={p.assignment_source === 'gps_auto'}
                      onClick={() =>
                        selectMode
                          ? onToggleSelect(p.id)
                          : onSetLightboxIndex(photoIndexById.get(p.id) ?? 0)
                      }
                    />

                  ))}
                </div>
              )}
            </article>
          </div>
        );
      })}
      {unassigned.length > 0 && (() => {
        const areaKey = `gallery|__unassigned__|${activeDay}`;
        const open = isAreaOpen(areaKey);
        return (
          <article className="py-4 pl-4" style={{ borderLeft: `3px solid #e5e7eb` }}>
            <header className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleAreaOpen(areaKey)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={open ? "Collapse area" : "Expand area"}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} />
              </button>
              <h3 className="text-sm font-medium" style={{ color: "#1a1a1a" }}>Unassigned</h3>
              <span className="text-xs" style={{ color: "#6b7280" }}>
                {unassigned.length} photo{unassigned.length === 1 ? "" : "s"}
              </span>
            </header>
            {open && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {unassigned.map((p) => (
                  <PhotoThumb
                    key={p.id}
                    path={p.storage_path}
                    alt={p.caption || p.file_name}
                    selectable={selectMode}
                    selected={selectedIds.has(p.id)}
                    onClick={() =>
                      selectMode
                        ? onToggleSelect(p.id)
                        : onSetLightboxIndex(photoIndexById.get(p.id) ?? 0)
                    }
                  />
                ))}
              </div>
            )}
          </article>
        );
      })()}
    </div>
  );
}
