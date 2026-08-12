// Note: `behind_schedule` is retained in the type for legacy DB rows but is no
// longer offered in the picker. New selections render as `Delayed`.
export type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "flagged"
  | "delayed"
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

// BuildFolder v5 brand colors:
// NONE      #9C9A93   ON TRACK  #3A6EA5   DELAYED  #C7382A
// FLAGGED   #D4A017   COMPLETE  #3A7D44
export const PROJECT_STATUSES: StatusMeta[] = [
  {
    value: "not_started",
    label: "None",
    dotClass: "bg-[#9C9A93]",
    pillClass: "bg-muted text-muted-foreground border-muted-foreground/30",
  },
  {
    value: "in_progress",
    label: "On track",
    dotClass: "bg-[#3A6EA5]",
    pillClass: "bg-[#3A6EA5]/15 text-[#3A6EA5] dark:text-blue-300 border-[#3A6EA5]/40",
  },
  {
    value: "flagged",
    label: "Flagged",
    dotClass: "bg-[#D4A017]",
    pillClass: "bg-[#D4A017]/15 text-[#D4A017] dark:text-yellow-300 border-[#D4A017]/40",
  },
  {
    value: "delayed",
    label: "Delayed",
    dotClass: "bg-[#C7382A]",
    pillClass: "bg-[#C7382A]/15 text-[#C7382A] dark:text-red-300 border-[#C7382A]/40",
  },
  {
    value: "complete",
    label: "Complete",
    dotClass: "bg-[#3A7D44]",
    pillClass: "bg-[#3A7D44]/15 text-[#3A7D44] dark:text-emerald-300 border-[#3A7D44]/40",
  },
];

// Legacy entry for any rows still set to `behind_schedule` — rendered as
// "Delayed" so the UI stays consistent without dropping the DB value.
const LEGACY_BEHIND_SCHEDULE: StatusMeta = {
  value: "behind_schedule",
  label: "Delayed",
  dotClass: "bg-[#C7382A]",
  pillClass: "bg-[#C7382A]/15 text-[#C7382A] dark:text-red-300 border-[#C7382A]/40",
};

export const projectStatusMeta = (s: ProjectStatus | null | undefined): StatusMeta => {
  if (s === "behind_schedule") return LEGACY_BEHIND_SCHEDULE;
  return PROJECT_STATUSES.find((x) => x.value === (s ?? "not_started")) ?? PROJECT_STATUSES[0];
};
