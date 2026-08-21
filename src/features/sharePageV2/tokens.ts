import { formatCaptureTime, getAmbientEventTimeZone } from "@/lib/eventTime";
/**
 * Share page v2 — editorial design tokens.
 * Deliberately self-contained (copied, not extracted) while v2 settles, so
 * nothing here can regress the live v1 share page.
 */

/**
 * Colours resolve through CSS variables (see index.css) so the share page can
 * switch between light / dark without touching every inline style.
 */
export const V2 = {
  ink: "var(--v2-ink)",
  /** Foreground for anything filled with `ink` (flips with the theme). */
  inkFg: "var(--v2-ink-fg)",
  soft: "var(--v2-soft)",
  muted: "var(--v2-muted)",
  rule: "var(--v2-rule)",
  paper: "var(--v2-paper)",
  paperDim: "var(--v2-paper-dim)",
  white: "var(--v2-white)",
  band: "var(--v2-band)",
  bandFg: "var(--v2-band-fg)",
  bandFgSoft: "var(--v2-band-fg-soft)",
  signalRed: "var(--v2-signal-red)",
  radiusReport: 4,
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export type StatusKey = "not_started" | "in_progress" | "flagged" | "delayed" | "complete";

export const STATUS_V2: Record<StatusKey, { label: string; fg: string; bg: string }> = {
  in_progress: { label: "In progress", fg: "var(--v2-st-progress-fg)", bg: "var(--v2-st-progress-bg)" },
  flagged: { label: "Flagged", fg: "var(--v2-st-flagged-fg)", bg: "var(--v2-st-flagged-bg)" },
  delayed: { label: "Delayed", fg: "var(--v2-st-delayed-fg)", bg: "var(--v2-st-delayed-bg)" },
  complete: { label: "Complete", fg: "var(--v2-st-complete-fg)", bg: "var(--v2-st-complete-bg)" },
  not_started: { label: "Not started", fg: "var(--v2-st-none-fg)", bg: "var(--v2-st-none-bg)" },
};

/** Legacy values still present in older rows are normalised here. */
export const normaliseStatus = (s: string | null | undefined): StatusKey => {
  switch (s) {
    case "on_track":
    case "in_progress":
      return "in_progress";
    case "requires_discussion":
    case "flagged":
      return "flagged";
    case "concern":
    case "at_risk":
    case "behind_schedule":
    case "delayed":
      return "delayed";
    case "complete":
      return "complete";
    default:
      return "not_started";
  }
};

export const statusMeta = (s: string | null | undefined) => STATUS_V2[normaliseStatus(s)];

/** "No update today" is display-only — never an enum value. */
export const NO_UPDATE = { label: "No update today", fg: V2.muted, bg: V2.paperDim };

export const DATE_LONG = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
export const DATE_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

/**
 * Capture times render in the *event's* local timezone, never the viewer's,
 * so the same photo reads the same time for the site team and the client.
 */
export const timeLabel = (iso: string | null) =>
  formatCaptureTime(iso, getAmbientEventTimeZone());

/**
 * Client mirror of the DB function `derive_area_display_status`:
 * explicit status wins, otherwise photos captured that day mean "in progress".
 */
export const deriveAreaStatus = (
  explicit: string | null | undefined,
  photosToday: number
): StatusKey => {
  const s = explicit ? normaliseStatus(explicit) : null;
  if (s && s !== "not_started") return s;
  return photosToday > 0 ? "in_progress" : "not_started";
};

/**
 * Severity ordering for status rollups:
 * not_started < complete < in_progress < flagged < delayed.
 * Used by the header rollup and the build calendar's worst-status row.
 */
export const STATUS_SEVERITY: Record<StatusKey, number> = {
  not_started: 0,
  complete: 1,
  in_progress: 2,
  flagged: 3,
  delayed: 4,
};

/** MAX(status) by severity across a list of (possibly loose) status values. */
export const worstStatus = (values: Array<string | null | undefined>): StatusKey =>
  values.reduce<StatusKey>((worst, v) => {
    const s = normaliseStatus(v);
    return STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst;
  }, "not_started");

/**
 * Single source of truth for day ordering across the share page.
 *
 * Lists (the build timeline / mobile day picker) read newest-first so today is
 * the first row; visualisations (the build calendar heatmap) keep a
 * chronological left-to-right day axis.
 */
export const orderDays = <T extends { date: string }>(
  days: T[],
  direction: "chronological" | "reverse"
): T[] => {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return direction === "reverse" ? sorted.reverse() : sorted;
};

/** Lists: newest day first. */
export const orderDaysForList = <T extends { date: string }>(days: T[]): T[] =>
  orderDays(days, "reverse");

/** Visualisations: oldest day first (left-to-right). */
export const orderDaysForAxis = <T extends { date: string }>(days: T[]): T[] =>
  orderDays(days, "chronological");

/**
 * Literal hex fallbacks — required anywhere a CSS variable can't be resolved
 * (Google Maps polygon options, raw SVG fill/stroke attributes).
 */
export const STATUS_HEX: Record<StatusKey, string> = {
  in_progress: "#0B43D6",
  flagged: "#B4720F",
  delayed: "#A11616",
  complete: "#178A4C",
  not_started: "#85837B",
};
export const statusHex = (s: string | null | undefined) => STATUS_HEX[normaliseStatus(s)];
