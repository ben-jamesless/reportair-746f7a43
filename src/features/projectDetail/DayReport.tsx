import { EditableNote } from "@/components/EditableNote";
import { AreaStatusPicker, type AreaStatus } from "@/components/AreaStatusPicker";
import { areaStatusAccent, type Area, type DailyField } from "@/lib/projectDetailTypes";

type DayReportProps = {
  activeDay: string;
  areas: Area[];
  dayNotes: Map<string, string | null>;
  canEdit: boolean;
  getDailyField: (dateKey: string, field: DailyField) => string | null;
  getAreaDayNote: (areaId: string, dateKey: string) => string | null;
  getAreaDayStatus: (areaId: string, dateKey: string) => AreaStatus;
  onSaveDailyField: (dateKey: string, field: DailyField, value: string | null) => void;
  onSaveDayNote: (dateKey: string, value: string | null) => void;
  onSaveAreaDayNote: (areaId: string, dateKey: string, value: string | null) => void;
  onSaveAreaDayStatus: (areaId: string, dateKey: string, value: AreaStatus) => void;
};

const DAILY_BLOCKS: { key: DailyField; label: string }[] = [
  { key: "today_objectives", label: "Today's Objectives" },
  { key: "today_achievements", label: "Today's Achievements" },
  { key: "tomorrow_objectives", label: "Tomorrow's Objectives" },
  { key: "open_issues", label: "Open Issues / Risks" },
];

// Updates-view briefing block for a single dated day: 4 daily fields + legacy
// notes + per-area status/notes cards. Text-only — no photo grids here.
export function DayReport({
  activeDay,
  areas,
  dayNotes,
  canEdit,
  getDailyField,
  getAreaDayNote,
  getAreaDayStatus,
  onSaveDailyField,
  onSaveDayNote,
  onSaveAreaDayNote,
  onSaveAreaDayStatus,
}: DayReportProps) {
  const dayNoteVal = dayNotes.get(activeDay) ?? null;

  return (
    <div className="space-y-6">
      {/* Daily updates — 4 separate fields used by the report PDF cover.
          Headers use a color-coded band + left rail so they stay visible
          when the body fills with dense notes. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {DAILY_BLOCKS.map((b, idx) => {
          const value = getDailyField(activeDay, b.key);
          const accents = [
            "hsl(var(--primary))",       // Today's Objectives
            "hsl(var(--success))",       // Today's Achievements
            "hsl(var(--warning))",       // Tomorrow's Objectives
            "hsl(var(--destructive))",   // Open Issues / Risks
          ];
          const accent = accents[idx] ?? "hsl(var(--primary))";
          return (
            <div
              key={b.key}
              className="rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-[160px] border-l-4"
              style={{ borderLeftColor: accent }}
            >
              <div
                className="px-4 py-2 flex items-center gap-2 border-b border-border"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)` }}
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span
                  className="text-[11px] font-bold tracking-widest uppercase"
                  style={{ color: accent }}
                >
                  {b.label}
                </span>
              </div>
              <div className="px-4 py-3 flex-1 text-sm text-foreground">
                <EditableNote
                  value={value}
                  placeholder={`Add ${b.label.toLowerCase()}…`}
                  onSave={(next) => onSaveDailyField(activeDay, b.key, next)}
                  rich
                  rows={5}
                  readOnly={!canEdit}
                  className="h-full"
                />
              </div>
            </div>
          );
        })}
      </div>
      {dayNoteVal && dayNoteVal.trim() && (
        <div className="px-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Legacy notes
          </p>
          <EditableNote
            value={dayNoteVal}
            placeholder=""
            onSave={(next) => onSaveDayNote(activeDay, next)}
            rich
            rows={3}
            readOnly={!canEdit}
          />
        </div>
      )}

      {/* Per-area briefing — flush, no card */}
      {areas.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          No areas defined yet. Add areas in project settings.
        </p>
      ) : (
        <div>
          {areas.map((ar) => {
            const st = getAreaDayStatus(ar.id, activeDay);
            const note = getAreaDayNote(ar.id, activeDay);
            const accent = areaStatusAccent(st);
            return (
              <div key={ar.id}>
                <article
                  className="mb-3 rounded-xl border border-border bg-card overflow-hidden border-l-4"
                  style={{ borderLeftColor: accent }}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-semibold text-foreground">{ar.name}</span>
                    <AreaStatusPicker
                      value={st}
                      onChange={(s) => onSaveAreaDayStatus(ar.id, activeDay, s)}
                      readOnly={!canEdit}
                    />
                  </div>
                  <div className="px-4 pb-3">
                    <EditableNote
                      value={note}
                      placeholder="No notes for this area yet."
                      onSave={(next) => onSaveAreaDayNote(ar.id, activeDay, next)}
                      rich
                      rows={3}
                      readOnly={!canEdit}
                    />
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
