// Event templates — UI-only constructs that seed zones, status vocabulary,
// day-label scheme and a recommended export layout when a project is created.
//
// These layer on top of the existing date-driven photo flow without changing
// it. `captured_at -> dayKey() -> DayBucket[]` (see projectDetailTypes.ts)
// remains the source of truth. Templates only add labels and seed defaults.

export type EventTemplateId =
  | "blank"
  | "pop_up"
  | "exhibition"
  | "brand_activation";

export type LayoutVariant =
  | "portrait_v1"
  | "horizontal_deck_v1"
  | "horizontal_log_v1";

/**
 * Day-label phase. Derived from project.build_start_date and project.event_date
 * at render time — not stored on photos.
 */
export type PhaseKind =
  | "pre"
  | "build"
  | "dress"
  | "show"
  | "strike";

export type EventTemplateDef = {
  id: EventTemplateId;
  title: string;
  description: string;
  /** Pre-seeded area/zone names inserted on project create (one row per item in `areas`). */
  areas: string[];
  /** Day-key word used as the label prefix for in-show days. e.g. "TRADING DAY", "SHOW DAY", "GO LIVE". */
  showDayKey: string;
  /** Status chip vocabulary surfaced in the UI. Maps to existing ProjectStatus internally. */
  statusSet: string[];
  /** Default layout chosen in ExportPdfDialog when this template is used. */
  recommendedLayout: LayoutVariant;
};

export const EVENT_TEMPLATE_DEFS: EventTemplateDef[] = [
  {
    id: "blank",
    title: "Blank",
    description: "Start clean. Add zones, status and labels as you go.",
    areas: [],
    showDayKey: "DAY",
    statusSet: ["On track", "Needs discussion", "Concern", "Complete"],
    recommendedLayout: "portrait_v1",
  },
  {
    id: "pop_up",
    title: "Pop-up",
    description: "Short retail or brand experience. 3–7 days on site.",
    areas: ["Load-in", "Fit-out", "Dressing", "Trading day", "Strike"],
    showDayKey: "TRADING DAY",
    statusSet: ["Pre-build", "Building", "Live", "Strike"],
    recommendedLayout: "horizontal_deck_v1",
  },
  {
    id: "exhibition",
    title: "Exhibition",
    description: "Trade show or expo stand. Multi-day show with client walks.",
    areas: [
      "Load-in",
      "Rigging",
      "Stand build",
      "AV+Lighting",
      "Dressing",
      "Client walk",
      "Show days",
      "Strike",
    ],
    showDayKey: "SHOW DAY",
    statusSet: ["Build", "Dress", "Show", "Strike"],
    recommendedLayout: "horizontal_log_v1",
  },
  {
    id: "brand_activation",
    title: "Brand activation",
    description: "Hero moment, doors-open event with talent and AV.",
    areas: [
      "Site prep",
      "Build",
      "Dressing",
      "Talent+AV",
      "Doors",
      "Live",
      "De-rig",
    ],
    showDayKey: "GO LIVE",
    statusSet: ["Prep", "Build", "Live", "Wrap"],
    recommendedLayout: "horizontal_deck_v1",
  },
];

export const getEventTemplate = (id: EventTemplateId | string | null | undefined): EventTemplateDef => {
  return (
    EVENT_TEMPLATE_DEFS.find((t) => t.id === id) ?? EVENT_TEMPLATE_DEFS[0]
  );
};

/**
 * Pure helper. Derive a phase-aware day label for a given date.
 * Falls back to a plain short date for the Blank template or when project
 * dates aren't set yet.
 */
export const phaseLabel = (
  date: Date,
  buildStartISO: string | null | undefined,
  eventISO: string | null | undefined,
  templateId: EventTemplateId | string | null | undefined
): string | null => {
  const tpl = getEventTemplate(templateId);
  if (tpl.id === "blank") return null;
  if (!buildStartISO || !eventISO) return null;

  const start = new Date(buildStartISO);
  const event = new Date(eventISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(event.getTime())) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const truncate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const target = truncate(date).getTime();
  const startDay = truncate(start).getTime();
  const eventDay = truncate(event).getTime();

  if (target < startDay) return "PRE-BUILD";
  if (target === eventDay) {
    // Doors-open day uses template's show-day key with index 1.
    return `${tpl.showDayKey} 01`;
  }
  if (target < eventDay) {
    const idx = Math.floor((target - startDay) / dayMs) + 1;
    return `BUILD DAY ${String(idx).padStart(2, "0")}`;
  }
  // After event day -> strike
  const idx = Math.floor((target - eventDay) / dayMs);
  if (idx === 0) return `${tpl.showDayKey} 01`;
  // multi-day shows: keep using showDayKey until... well, MVP: anything > event_date is strike
  return `STRIKE DAY ${String(idx).padStart(2, "0")}`;
};

/** localStorage key for storing the project's recommended export layout. */
export const RECOMMENDED_LAYOUT_KEY = (projectId: string) =>
  `bs:project:recommendedLayout:${projectId}`;

/** localStorage key for storing the chosen template id per project. */
export const TEMPLATE_ID_KEY = (projectId: string) =>
  `bs:project:templateId:${projectId}`;
