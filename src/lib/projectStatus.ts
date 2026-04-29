// Note: `behind_schedule` is retained in the type for legacy DB rows but is no
// longer offered in the picker. New selections should use `complete` instead.
export type ProjectStatus =
  | "no_status"
  | "on_track"
  | "requires_discussion"
  | "concern"
  | "complete"
  | "behind_schedule";

type StatusMeta = {
  value: ProjectStatus;
  label: string;
  /** Tailwind background class for the colored dot. */
  dotClass: string;
  /** Tailwind classes for a colored pill (background + text + border). */
  pillClass: string;
};

export const PROJECT_STATUSES: StatusMeta[] = [
  {
    value: "no_status",
    label: "No status",
    dotClass: "bg-muted-foreground/40",
    pillClass: "bg-muted text-muted-foreground border-muted-foreground/30",
  },
  {
    value: "on_track",
    label: "On track",
    dotClass: "bg-blue-500",
    pillClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
  },
  {
    value: "requires_discussion",
    label: "Needs discussion",
    dotClass: "bg-orange-500",
    pillClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40",
  },
  {
    value: "concern",
    label: "Concern",
    dotClass: "bg-red-500",
    pillClass: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
  },
  {
    value: "complete",
    label: "Complete",
    dotClass: "bg-emerald-500",
    pillClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  },
];

// Legacy entry for any rows still set to `behind_schedule` — rendered as a
// red "Concern" so the UI stays consistent without dropping the DB value.
const LEGACY_BEHIND_SCHEDULE: StatusMeta = {
  value: "behind_schedule",
  label: "Concern",
  dotClass: "bg-red-500",
  pillClass: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
};

export const projectStatusMeta = (s: ProjectStatus | null | undefined): StatusMeta => {
  if (s === "behind_schedule") return LEGACY_BEHIND_SCHEDULE;
  return PROJECT_STATUSES.find((x) => x.value === (s ?? "no_status")) ?? PROJECT_STATUSES[0];
};
