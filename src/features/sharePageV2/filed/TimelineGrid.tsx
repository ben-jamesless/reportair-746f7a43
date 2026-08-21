import { useMemo } from "react";
import { V2, STATUS_V2, daysBetween, deriveAreaStatus, parseISO } from "../tokens";
import type { ShareV2GridCell, ShareV2Phase } from "../types";
import type { FiledArea } from "./useFiledModel";
import { MONO_LABEL } from "./ui";

const PHASE_TONE: Record<string, string> = {
  pre_build: "#6B4FA8",
  build: "#0B43D6",
  on_show: "#178A4C",
  takedown: "#B4720F",
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const COL = 20;
const GUTTER = 5;
const NAME_W = 150;

const isoAdd = (start: string, i: number) => {
  const d = new Date(parseISO(start).getTime() + i * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The build timeline — areas on Y, days on X. This is the desktop navigator
 * for the filed record and the component the deleted month calendar could
 * never replace: it has an area axis, so it answers "when was this area
 * worked on" directly.
 *
 * Days with activity get a full labelled column; runs of dead days collapse to
 * a 5px gutter, which is what keeps a six-month build legible. Long builds
 * scroll horizontally with the area-name column pinned.
 */
export function TimelineGrid({
  areas,
  grid,
  phases,
  activityDates,
  activeDate,
  onSelect,
}: {
  areas: FiledArea[];
  grid: ShareV2GridCell[];
  phases: ShareV2Phase[];
  activityDates: string[];
  activeDate?: string | null;
  onSelect?: (date: string) => void;
}) {
  const activity = useMemo(() => new Set(activityDates), [activityDates]);

  const dates = useMemo(() => {
    const sorted = [...activityDates].sort();
    const phaseDates = phases.filter((p) => p.start_date).flatMap((p) => [p.start_date!, p.end_date ?? p.start_date!]);
    const all = [...sorted, ...phaseDates].sort();
    const start = all[0];
    const end = all[all.length - 1];
    if (!start || !end) return [] as string[];
    const len = daysBetween(start, end) + 1;
    if (len <= 0 || len > 800) return sorted;
    return Array.from({ length: len }, (_, i) => isoAdd(start, i));
  }, [activityDates, phases]);

  const cellMap = useMemo(() => {
    const m = new Map<string, ShareV2GridCell>();
    for (const c of grid) m.set(`${c.area_id}|${c.date}`, c);
    return m;
  }, [grid]);

  const photosPerDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of grid) m.set(c.date, (m.get(c.date) ?? 0) + (c.photo_count ?? 0));
    return m;
  }, [grid]);

  const phaseFor = (d: string) =>
    phases.find((p) => p.start_date && d >= p.start_date && d <= (p.end_date ?? p.start_date!));

  const segments = useMemo(() => {
    const out: Array<{ kind: string | null; label: string; width: number }> = [];
    for (const d of dates) {
      const p = phaseFor(d);
      const kind = p?.kind ?? null;
      const label = p ? p.label ?? p.kind.replace("_", " ") : "";
      const w = activity.has(d) ? COL : GUTTER;
      const last = out[out.length - 1];
      if (last && last.kind === kind && last.label === label) last.width += w;
      else out.push({ kind, label, width: w });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, phases, activity]);

  if (dates.length === 0 || areas.length === 0) return null;

  const widthOf = (d: string) => (activity.has(d) ? COL : GUTTER);
  const total = dates.reduce((s, d) => s + widthOf(d), 0);

  const nameCell: React.CSSProperties = {
    width: NAME_W,
    minWidth: NAME_W,
    position: "sticky",
    left: 0,
    zIndex: 2,
    backgroundColor: V2.white,
    borderRight: `1px solid ${V2.rule}`,
    paddingRight: 10,
  };

  return (
    <div style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: NAME_W + total + 12, padding: "10px 6px 10px 10px" }}>
          {/* Phase bands */}
          <div className="flex">
            <div style={nameCell} />
            {segments.map((s, i) => {
              const tone = s.kind ? PHASE_TONE[s.kind] ?? V2.muted : null;
              return (
                <div
                  key={i}
                  className="truncate text-center"
                  title={s.label || undefined}
                  style={{
                    ...MONO_LABEL,
                    fontSize: 8.5,
                    letterSpacing: "0.1em",
                    width: s.width,
                    padding: "3px 2px",
                    color: tone ?? "transparent",
                    backgroundColor: tone ? `${tone}22` : "transparent",
                    borderTop: tone ? `2px solid ${tone}` : "none",
                  }}
                >
                  {s.width > 44 ? s.label : ""}
                </div>
              );
            })}
          </div>

          {/* Day axis — labels only where there was activity */}
          <div className="flex items-end" style={{ marginTop: 4, marginBottom: 5 }}>
            <div style={nameCell} />
            {dates.map((d) => {
              const on = activity.has(d);
              if (!on) return <div key={d} style={{ width: GUTTER }} />;
              const isActive = d === activeDate;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSelect?.(d)}
                  className="text-center"
                  title={d}
                  style={{
                    width: COL,
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: onSelect ? "pointer" : "default",
                    fontFamily: V2.mono,
                    fontSize: 8.5,
                    color: V2.muted,
                  }}
                >
                  {DOW[parseISO(d).getDay()]}
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      margin: "1px 1px 0",
                      padding: "1px 0",
                      color: isActive ? V2.bandFg : V2.soft,
                      backgroundColor: isActive ? V2.ink : "transparent",
                    }}
                  >
                    {Number(d.slice(-2))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Status rows */}
          {areas.map((a) => (
            <div key={a.id} className="flex items-center" style={{ marginBottom: 3 }}>
              <div className="truncate" style={{ ...nameCell, fontSize: 11.5, color: V2.soft }} title={a.name}>
                {a.name}
              </div>
              {dates.map((d) => {
                const on = activity.has(d);
                if (!on) return <div key={d} style={{ width: GUTTER }} />;
                const c = cellMap.get(`${a.id}|${d}`);
                const s = deriveAreaStatus(c?.status ?? null, c?.photo_count ?? 0);
                const blank = s === "not_started";
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSelect?.(d)}
                    title={`${a.name} · ${d} · ${blank ? "No activity" : STATUS_V2[s].label}`}
                    style={{
                      width: COL - 3,
                      height: 15,
                      marginRight: 3,
                      border: blank ? `1px solid ${V2.rule}` : "none",
                      backgroundColor: blank ? V2.paperDim : STATUS_V2[s].fg,
                      cursor: onSelect ? "pointer" : "default",
                    }}
                  />
                );
              })}
            </div>
          ))}

          {/* Photos per day */}
          <div className="flex items-center" style={{ marginTop: 7, paddingTop: 6, borderTop: `1px dashed ${V2.rule}` }}>
            <div style={{ ...nameCell, ...MONO_LABEL, fontSize: 8.5, color: V2.muted, textAlign: "right" }}>
              Photos
            </div>
            {dates.map((d) => {
              const on = activity.has(d);
              if (!on) return <div key={d} style={{ width: GUTTER }} />;
              const n = photosPerDay.get(d) ?? 0;
              return (
                <div
                  key={d}
                  className="text-center"
                  style={{
                    width: COL,
                    fontFamily: V2.mono,
                    fontSize: 8.5,
                    fontWeight: n > 0 ? 700 : 400,
                    color: n > 0 ? V2.soft : V2.muted,
                  }}
                >
                  {n || "·"}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1"
        style={{ borderTop: `1px solid ${V2.rule}`, padding: "8px 12px" }}
      >
        {(["in_progress", "complete", "flagged", "delayed"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5" style={{ ...MONO_LABEL, color: V2.muted }}>
            <span style={{ width: 8, height: 8, backgroundColor: STATUS_V2[k].fg }} />
            {STATUS_V2[k].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5" style={{ ...MONO_LABEL, color: V2.muted }}>
          <span style={{ width: 8, height: 8, backgroundColor: V2.paperDim, border: `1px solid ${V2.rule}` }} />
          No activity
        </span>
        <span className="ml-auto" style={{ ...MONO_LABEL, color: V2.muted, fontWeight: 400 }}>
          Narrow gaps are days with no activity
        </span>
      </div>
    </div>
  );
}
