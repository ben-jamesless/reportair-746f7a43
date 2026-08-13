import { V2, DATE_LONG, parseISO } from "../tokens";
import type { ShareMode, ShareV2Project } from "../types";

const MODE_KICKER: Record<ShareMode, string> = {
  build: "Build report",
  on_show: "Event report",
  takedown: "Takedown report",
  filed: "Event record",
};

export function Masthead({
  project,
  mode,
  activeDate,
  buildDay,
  buildTotal,
  logoUrl,
  filedRange,
}: {
  project: ShareV2Project;
  mode: ShareMode;
  activeDate: string | null;
  buildDay: number | null;
  buildTotal: number | null;
  logoUrl: string | null;
  /** Filed mode: "12 Jun — 4 Jul 2026" replaces "Day X / Y". */
  filedRange?: string | null;
}) {
  const filed = mode === "filed";
  const org = project.client_name || project.event_type || null;
  return (
    <header
      className="grid items-end gap-4 py-6 md:grid-cols-[1fr_auto_1fr]"
      style={{ borderBottom: `2px solid ${V2.ink}` }}
    >
      <div className="flex flex-col gap-1">
        <h1
          className="uppercase"
          style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15, color: V2.ink }}
        >
          {project.name}
        </h1>
      </div>

      <div
        className="hidden text-center md:block"
        style={{ borderLeft: `1px solid ${V2.rule}`, borderRight: `1px solid ${V2.rule}`, padding: "0 28px" }}
      >
        <div
          className="mx-auto mb-1.5 flex items-center justify-center overflow-hidden"
          style={{ width: 72, height: 72, borderRadius: 4, backgroundColor: logoUrl ? "transparent" : V2.band }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={org ?? project.name} className="h-full w-full object-contain" />
          ) : (
            <span style={{ color: V2.bandFg, fontWeight: 800, fontSize: 20 }}>
              {(org ?? project.name).slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        {org && (
          <div className="uppercase" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: V2.ink }}>
            {org}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 md:items-end md:text-right">
        {!filed && (
          <div style={{ fontSize: 11, fontWeight: 600, color: V2.muted, letterSpacing: "0.03em" }}>
            {DATE_LONG.format(new Date())}
          </div>
        )}
        {filed ? (
          filedRange && (
            <div style={{ fontFamily: V2.mono, fontSize: 16, fontWeight: 700, color: V2.ink }}>{filedRange}</div>
          )
        ) : (
          buildDay !== null && (
            <div style={{ fontFamily: V2.mono, fontSize: 20, fontWeight: 700, color: V2.ink }}>
              Day {buildDay}
              {buildTotal ? ` / ${buildTotal}` : ""}
            </div>
          )
        )}
        {project.event_location && <div style={{ fontSize: 11, color: V2.muted }}>{project.event_location}</div>}
      </div>
    </header>
  );
}
