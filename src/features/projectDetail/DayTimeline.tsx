import { useState } from "react";
import { Calendar, ChevronDown, FileDown, ImagePlus, Layers, MapPinned } from "lucide-react";

import { AreaStatusDot, type AreaStatus } from "@/components/AreaStatusPicker";
import type { LightboxPhoto } from "@/components/PhotoLightbox";
import { cn } from "@/lib/utils";
import {
  ALL_DAYS,
  NO_AREA,
  SHORT_FMT,
  albumKey,
  type Album,
  type Area,
} from "@/lib/projectDetailTypes";

export type DayBucket = {
  key: string;
  label: string;
  date: Date;
  photos: LightboxPhoto[];
};

type Props = {
  // Data
  days: DayBucket[];
  albums: Album[];
  albumPhotos: Map<string, LightboxPhoto[]>;
  areas: Area[];
  photos: LightboxPhoto[];

  // Selection state (owned by parent)
  activeDay: string;
  activeArea: string | null;
  openDays: Set<string>;

  // Capability
  canEdit: boolean;
  isMobileViewport: boolean;

  // Callbacks
  onSetActiveDay: (key: string) => void;
  onSetActiveArea: (id: string | null) => void;
  onSetOpenDays: (updater: (prev: Set<string>) => Set<string>) => void;
  onSelectDayArea: (dayKey: string, areaId: string | null) => void;
  onOpenDayExport: (e: React.MouseEvent, day: DayBucket) => void;
  onAddArea: (name: string) => Promise<void> | void;

  // Helpers from parent (kept here to avoid duplicating logic shared with other tabs)
  getAreaDayStatus: (areaId: string, dateKey: string) => AreaStatus;
  areaCountsForDay: (dayPhotos: LightboxPhoto[]) => {
    counts: Map<string, number>;
    unassigned: number;
  };
};

export function DayTimeline({
  days,
  albums,
  albumPhotos,
  areas,
  photos,
  activeDay,
  activeArea,
  openDays,
  canEdit,
  isMobileViewport,
  onSetActiveDay,
  onSetActiveArea,
  onSetOpenDays,
  onSelectDayArea,
  onOpenDayExport,
  onAddArea,
  getAreaDayStatus,
  areaCountsForDay,
}: Props) {
  // UI-only state local to the sidebar
  const [datesOpenTablet, setDatesOpenTablet] = useState(false);
  const [areasOpenMobile, setAreasOpenMobile] = useState(false);
  const [galleryListOpen, setGalleryListOpen] = useState(false);
  const [addingArea, setAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");

  const createArea = async () => {
    const name = newAreaName.trim();
    if (!name) return;
    await onAddArea(name);
    setNewAreaName("");
    setAddingArea(false);
  };

  return (
    <aside className="space-y-1 rounded-lg xl:border-r xl:border-[#E8E6DF] dark:bg-card dark:p-2 px-[8px] py-[10px] pr-[3px] pb-[10px] pl-[3px] my-0 mx-0">
      {days.length === 0 && albumPhotos.size === 0 && (
        <p className="px-3 py-4 text-xs text-muted-foreground">No photos yet.</p>
      )}

      {days.length > 0 && (
        <button
          type="button"
          onClick={() => setDatesOpenTablet((o) => !o)}
          className="flex xl:hidden w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-secondary"
          aria-expanded={datesOpenTablet}
        >
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            Dates
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", datesOpenTablet && "rotate-180")} />
        </button>
      )}

      <div className={cn(!datesOpenTablet && "hidden xl:block")}>

      <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Daily Log</p>

      {days.map((day) => {
        const isOpen = openDays.has(day.key);
        const dayActive = activeDay === day.key && activeArea === null;
        const { counts, unassigned } = areaCountsForDay(day.photos);
        return (
          <div key={day.key} className="rounded-lg">
            <div className="flex items-stretch gap-1 py-[8px]">
              <button
                onClick={() => { onSetActiveDay(day.key); onSetActiveArea(null); onSetOpenDays((p) => { const n = new Set(p); n.has(day.key) ? n.delete(day.key) : n.add(day.key); return n; }); }}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/40",
                )}
              >
                <span className={cn(
                  "flex flex-col items-center justify-center shrink-0 w-9 h-9 rounded-md text-[9px] font-bold uppercase leading-none",
                  dayActive ? "bg-[#1A6EFF] text-white" : "bg-[#F0EFEA] text-muted-foreground"
                )}>
                  <span className="text-[12px] leading-none">{day.date.getDate()}</span>
                  <span className="mt-0.5">{day.date.toLocaleString(undefined, { month: "short" }).toUpperCase()}</span>
                </span>
                <span className={cn("flex-1 min-w-0", dayActive ? "text-foreground font-semibold" : "text-foreground")}>{SHORT_FMT.format(day.date)}</span>
                <span className={cn(
                  "ml-auto inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[10px] font-semibold bg-[#F0EFEA] text-muted-foreground"
                )}>
                  {day.photos.length}
                </span>
              </button>
              <button
                onClick={(e) => onOpenDayExport(e, day)}
                className="flex items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                title={`Export ${day.label} as PDF`}
                aria-label={`Export ${day.label} as PDF`}
              >
                <FileDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {isOpen && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {areas.map((ar) => {
                  const c = counts.get(ar.id) ?? 0;
                  if (c === 0) return null;
                  const sel = activeDay === day.key && activeArea === ar.id;
                  const st = getAreaDayStatus(ar.id, day.key);
                  return (
                    <button
                      key={ar.id}
                      onClick={() => onSelectDayArea(day.key, ar.id)}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-md px-2 text-left text-xs transition-colors py-[8px]",
                        sel
                          ? "bg-[#1A6EFF]/10 text-[#1A6EFF] font-medium"
                          : "text-foreground hover:bg-muted/40",
                      )}
                    >
                      <AreaStatusDot status={st} className="shrink-0" />
                      <span className="flex-1 truncate">{ar.name}</span>
                      <span className={cn("ml-1 text-[10px]", sel ? "text-[#1A6EFF]" : "text-muted-foreground")}>{c}</span>
                    </button>
                  );
                })}
                {unassigned > 0 && (
                  <button
                    onClick={() => onSelectDayArea(day.key, NO_AREA)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 text-left text-xs transition-colors py-[8px]",
                      activeDay === day.key && activeArea === NO_AREA
                        ? "bg-[#1A6EFF]/10 text-[#1A6EFF] font-medium"
                        : "text-foreground hover:bg-muted/40",
                    )}
                  >
                    <span>Unassigned</span>
                    <span className={cn(
                      "ml-2 text-[10px]",
                      activeDay === day.key && activeArea === NO_AREA ? "text-[#1A6EFF]" : "text-muted-foreground"
                    )}>{unassigned}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      </div>

      {/* Areas section */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-center justify-between px-3 mb-1 py-[5px]">
          {areas.length > 1 ? (
            <button
              type="button"
              onClick={() => setAreasOpenMobile((o) => !o)}
              className="flex xl:hidden items-center gap-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground"
              aria-expanded={areasOpenMobile}
            >
              Areas
              <ChevronDown className={cn("h-3 w-3 transition-transform", areasOpenMobile && "rotate-180")} />
            </button>
          ) : null}
          <p className={cn(
            "text-[10px] font-semibold tracking-widest uppercase text-muted-foreground",
            areas.length > 1 ? "hidden xl:block" : "block"
          )}>Areas</p>
          {canEdit && (
            addingArea ? (
              <input
                autoFocus
                type="text"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createArea();
                  if (e.key === "Escape") { setAddingArea(false); setNewAreaName(""); }
                }}
                onBlur={() => {
                  if (newAreaName.trim()) {
                    createArea();
                  } else {
                    setAddingArea(false);
                  }
                }}
                placeholder="Area name..."
                className="w-full px-2 h-7 text-xs rounded-lg border border-[#1A6EFF] bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1A6EFF]/30"
              />
            ) : (
              <button
                onClick={() => setAddingArea(true)}
                className="flex items-center gap-0.5 text-[10px] text-[#1A6EFF] hover:text-[#1A6EFF]/80 font-medium"
              >
                <span className="text-base leading-none">+</span> New area
              </button>
            )
          )}
        </div>
        {areas.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">No areas yet.</p>
        ) : (
          <div className={cn(
            "space-y-0.5",
            areas.length > 1 && !areasOpenMobile && "hidden xl:block"
          )}>
            {areas.map((ar) => {
              const isActive = activeArea === ar.id;
              return (
                <button
                  key={ar.id}
                  onClick={() => onSetActiveArea(isActive ? null : ar.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 text-sm transition-colors py-[8px]",
                    isActive ? "bg-[#1A6EFF]/10 text-[#1A6EFF] font-medium" : "text-foreground hover:bg-muted/40"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-[#D4D1CA]" />
                    {ar.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1 border-t pt-3">

        {isMobileViewport && (albums.length > 0 || photos.length > 0) && (
          <button
            type="button"
            onClick={() => setGalleryListOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-secondary"
            aria-expanded={galleryListOpen}
          >
            <span className="flex items-center gap-1.5">
              <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
              Gallery
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", galleryListOpen && "rotate-180")} />
          </button>
        )}
        {(!isMobileViewport || galleryListOpen) && (
        <div className="space-y-1">
        {albums.map((al) => {
          const count = albumPhotos.get(al.id)?.length ?? 0;
          const key = albumKey(al.id);
          const sel = activeDay === key && activeArea === null;
          return (
            <button
              key={al.id}
              onClick={() => { onSetActiveDay(key); onSetActiveArea(null); }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                sel ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
              )}
            >
              <span className="flex items-center gap-1.5">
                <Layers className={cn("h-3.5 w-3.5", sel ? "" : "text-muted-foreground")} />
                <span className="font-medium">{al.name}</span>
              </span>
              <span className={cn("text-xs", sel ? "opacity-80" : "text-muted-foreground")}>
                {count}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => { onSetActiveDay(ALL_DAYS); onSetActiveArea(null); }}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
            activeDay === ALL_DAYS && activeArea === null
              ? "bg-primary text-primary-foreground"
              : "hover:bg-secondary"
          )}
        >
          <span className="flex items-center gap-1.5">
            <ImagePlus className={cn(
              "h-3.5 w-3.5",
              activeDay === ALL_DAYS && activeArea === null ? "" : "text-muted-foreground"
            )} />
            <span className="font-medium">Event Gallery</span>
          </span>
          <span className={cn(
            "text-xs",
            activeDay === ALL_DAYS && activeArea === null ? "opacity-80" : "text-muted-foreground"
          )}>
            {photos.length}
          </span>
        </button>
        {(() => {
          const totalUnassigned = photos.filter((p) => !p.area_id).length;
          if (totalUnassigned === 0) return null;
          const sel = activeDay === ALL_DAYS && activeArea === NO_AREA;
          return (
            <button
              onClick={() => { onSetActiveDay(ALL_DAYS); onSetActiveArea(NO_AREA); }}
              className={cn(
                "ml-5 flex w-[calc(100%-1.25rem)] items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                sel
                  ? "border-l-[3px] border-primary bg-primary/15 text-foreground dark:text-white"
                  : "hover:bg-secondary dark:hover:bg-[#1E3050]",
              )}
              title="Photos without an assigned area — open to reassign"
            >
              <span className="flex items-center gap-1.5">
                <MapPinned className={cn("h-3 w-3 shrink-0", sel ? "text-primary" : "text-muted-foreground")} />
                Unassigned
              </span>
              <span className={cn(
                "ml-2 text-[10px]",
                sel ? "text-primary" : "text-muted-foreground"
              )}>{totalUnassigned}</span>
            </button>
          );
        })()}
        </div>
        )}
      </div>
    </aside>
  );
}
