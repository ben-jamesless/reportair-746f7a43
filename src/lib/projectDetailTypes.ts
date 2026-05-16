import type { LightboxPhoto } from "@/components/PhotoLightbox";
import type { AreaStatus } from "@/components/AreaStatusPicker";
import type { ProjectStatus } from "@/lib/projectStatus";

export type ProjectView = "report" | "gallery";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  color: string | null;
  event_date: string | null;
  build_start_date: string | null;
  event_location: string | null;
  overall_status: ProjectStatus | null;
  event_type: string | null;
  client_name: string | null;
  archived_at: string | null;
  default_view: ProjectView | null;
};

export type Album = { id: string; name: string; slug: string; position: number };
export type Area = { id: string; name: string; sort_order: number };
export type DayNote = {
  date: string;
  notes: string | null;
  today_objectives: string | null;
  today_achievements: string | null;
  tomorrow_objectives: string | null;
  open_issues: string | null;
};
export type DailyField =
  | "today_objectives"
  | "today_achievements"
  | "tomorrow_objectives"
  | "open_issues";
export type DailyFields = { [K in DailyField]: string | null };

export const NO_AREA = "__no_area__";
export const ALL_DAYS = "__all__";
export const ALBUM_PREFIX = "album:";
export const isAlbumKey = (k: string) => k.startsWith(ALBUM_PREFIX);
export const albumIdFromKey = (k: string) =>
  isAlbumKey(k) ? k.slice(ALBUM_PREFIX.length) : null;
export const albumKey = (id: string) => `${ALBUM_PREFIX}${id}`;

// Legacy URL value preserved so old shared links keep working until we can
// resolve the slug to an album id (handled in an effect in ProjectDetail).
export const LEGACY_PRE_EVENT_DAY = "__pre_event__";
export const LEGACY_PRE_EVENT_SLUG = "pre-event";

export const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const SHORT_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Hex accent for the 3px left bar on area blocks (matches share view). */
export const areaStatusAccent = (s: AreaStatus | null | undefined): string => {
  switch (s) {
    case "on_track":
      return "#3b82f6";
    case "requires_discussion":
      return "#f97316";
    case "concern":
      return "#ef4444";
    case "complete":
      return "#10b981";
    default:
      return "#e5e7eb";
  }
};

export const dayKey = (p: LightboxPhoto): string => {
  const raw = p.captured_at || p.created_at;
  const d = raw ? new Date(raw) : new Date(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
