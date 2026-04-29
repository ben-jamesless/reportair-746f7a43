export type ProjectStatus =
  | "no_status"
  | "on_track"
  | "requires_discussion"
  | "concern"
  | "behind_schedule";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; dotClass: string }[] = [
  { value: "no_status", label: "No status", dotClass: "bg-muted-foreground/40" },
  { value: "on_track", label: "On track", dotClass: "bg-emerald-500" },
  { value: "requires_discussion", label: "Requires discussion", dotClass: "bg-amber-500" },
  { value: "concern", label: "Concern", dotClass: "bg-orange-500" },
  { value: "behind_schedule", label: "Behind schedule", dotClass: "bg-red-500" },
];

export const projectStatusMeta = (s: ProjectStatus | null | undefined) =>
  PROJECT_STATUSES.find((x) => x.value === (s ?? "no_status")) ?? PROJECT_STATUSES[0];
