/**
 * Share page v2 — editorial design tokens.
 * Deliberately self-contained (copied, not extracted) while v2 settles, so
 * nothing here can regress the live v1 share page.
 */

export const V2 = {
  ink: "#0F1520",
  soft: "#3C4250",
  muted: "#85837B",
  rule: "#E3DCD3",
  paper: "#FBF7F5",
  paperDim: "#F3EEE8",
  white: "#FFFFFF",
  signalRed: "#FF3131",
  radiusReport: 4,
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export type StatusKey = "not_started" | "in_progress" | "flagged" | "delayed" | "complete";

export const STATUS_V2: Record<StatusKey, { label: string; fg: string; bg: string }> = {
  in_progress: { label: "In progress", fg: "#0B43D6", bg: "#E9EEFC" },
  flagged: { label: "Flagged", fg: "#B4720F", bg: "#FBF0DE" },
  delayed: { label: "Delayed", fg: "#A11616", bg: "#FBEAEA" },
  complete: { label: "Complete", fg: "#178A4C", bg: "#E3F3E9" },
  not_started: { label: "Not started", fg: "#85837B", bg: "#F3EEE8" },
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

export const timeLabel = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

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
