import { useMemo } from "react";
import {
  V2,
  STATUS_V2,
  daysBetween,
  deriveAreaStatus,
  isoToday,
  normaliseStatus,
  parseISO,
  statusMeta,
  worstStatus,
} from "../tokens";
import type { ShareV2AreaMeta, ShareV2GridCell, ShareV2Phase } from "../types";

const PHASE_TONE: Record<string, string> = {
  pre_build: "#6B4FA8",
  build: "#0B43D6",
  on_show: "#178A4C",
  takedown: "#B4720F",
};

const MAX_COLUMNS = 120;

const isoAdd = (start: string, i: number) => {
  const d = new Date(parseISO(start).getTime() + i * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

type Segment = { label: string; kind: string | null; span: number };

/**
 * Phases x areas x days heatmap.
 *
 * Day axis is always chronological left-to-right; area rows are sorted worst
 * status first so flagged/delayed areas sit at the top of the client's eye.
 * Renders usefully when phases are empty, partial, or entirely in the past.
 */
export function BuildHeatmap({
  areas,
  grid,
  phases,
  activeDate,
  activityDates,
  onSelect,
  onSelectArea,
}: {
  areas: ShareV2AreaMeta[];
  grid: ShareV2GridCell[];
  phases: ShareV2Phase[];
  activeDate: string | null;
  activityDates: string[];
  onSelect: (d: string) => void;
  onSelectArea?: (areaId: string) => void;
}) {
  const today = isoToday();
  const definedPhases = useMemo(
    () => phases.filter((p) => p.start_date).sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1)),
    [phases]
  );

  const dates = useMemo(() => {
    const activity = [...activityDates].sort();
    const candidatesStart = [
      ...activity.slice(0, 1),
      ...definedPhases.map((p) => p.start_date!).slice(0, 1),
    ].sort();
    const candidatesEnd = [
      ...activity.slice(-1),
      ...definedPhases.map((p) => p.end_date ?? p.start_date!),
      today,
    ].sort();
    const start = candidatesStart[0];
    const end = candidatesEnd[candidatesEnd.length - 1];
    if (!start || !end) return [] as string[];
    let len = daysBetween(start, end) + 1;
    if (len <= 0) return [start];
    let from = start;
    if (len > MAX_COLUMNS) {
      from = isoAdd(end, -(MAX_COLUMNS - 1));
      len = MAX_COLUMNS;
    }
    return Array.from({ length: len }, (_, i) => isoAdd(from, i));
  }, [activityDates, definedPhases, today]);

  const cellMap = useMemo(() => {
    const m = new Map<string, ShareV2GridCell>();
    for (const c of grid) m.set(`${c.area_id}|${c.date}`, c);
    return m;
  }, [grid]);

  const statusFor = (areaId: string, date: string) => {
    const c = cellMap.get(`${areaId}|${date}`);
    if (!c) return "not_started" as const;
    return deriveAreaStatus(c.status, c.photo_count ?? 0);
  };

  const rows = useMemo(() => {
    return [...areas]
      .map((a) => ({
        area: a,
        worst: worstStatus(dates.map((d) => statusFor(a.id, d))),
      }))
      .sort((x, y) => {
        const sx = STATUS_SEVERITY_DESC(x.worst);
        const sy = STATUS_SEVERITY_DESC(y.worst);
        if (sx !== sy) return sx - sy;
        return x.area.sort_order - y.area.sort_order;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, dates, cellMap]);

  const segments = useMemo<Segment[]>(() => {
    if (dates.length === 0) return [];
    const labelFor = (date: string) => {
      const p = definedPhases.find(
        (ph) => date >= ph.start_date! && date <= (ph.end_date ?? ph.start_date!)
      );
      return p ? { label: p.label ?? p.kind.replace("_", " "), kind: p.kind } : { label: "", kind: null };
    };
    const out: Segment[] = [];
    for (const d of dates) {
      const { label, kind } = labelFor(d);
      const last = out[out.length - 1];
      if (last && last.label === label && last.kind === kind) last.span += 1;
      else out.push({ label, kind, span: 1 });
    }
    return out;
  }, [dates, definedPhases]);

  if (dates.length === 0 || areas.length === 0) return null;

  const colWidth = 18;
  const nameWidth = 132;

  return (
    <div
      className="overflow-hidden"
      style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport, backgroundColor: V2.white }}
    >
      <div className="overflow-x-auto">
        <div style={{ minWidth: nameWidth + dates.length * colWidth + 8, padding: 10 }}>
          {/* Phase band — solid, labelled sections across the day axis */}
          {definedPhases.length > 0 ? (
            <div className="flex" style={{ marginLeft: nameWidth, marginBottom: 4 }}>
              {segments.map((s, i) => {
                const tone = s.kind ? PHASE_TONE[s.kind] ?? V2.muted : null;
                return (
                  <div
                    key={i}
                    className="truncate text-center uppercase"
                    style={{
                      width: s.span * colWidth,
                      fontFamily: V2.mono,
                      fontSize: 8.5,
                      letterSpacing: "0.08em",
                      fontWeight: 700,
                      padding: "3px 2px",
                      color: tone ?? V2.muted,
                      backgroundColor: tone ? `${tone}1F` : "transparent",
                      borderTop: tone ? `2px solid ${tone}` : `1px dashed ${V2.rule}`,
                      borderRight: i < segments.length - 1 ? `1px solid ${V2.white}` : undefined,
                    }}
                    title={s.label || undefined}
                  >
                    {s.label}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="uppercase"
              style={{
                marginLeft: nameWidth,
                marginBottom: 4,
                fontFamily: V2.mono,
                fontSize: 8.5,
                letterSpacing: "0.08em",
                fontWeight: 700,
                color: V2.muted,
                borderBottom: `1px dashed ${V2.rule}`,
                paddingBottom: 2,
              }}
            >
              Phases not set
            </div>
          )}

          {/* Day axis */}
          <div className="flex items-end" style={{ marginLeft: nameWidth, marginBottom: 4 }}>
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onSelect(d)}
                className="text-center"
                style={{
                  width: colWidth,
                  fontFamily: V2.mono,
                  fontSize: 8,
                  color: d === today ? V2.ink : V2.muted,
                  fontWeight: d === today || d === activeDate ? 700 : 400,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                {DOW[parseISO(d).getDay()]}
                <div
                  style={{
                    fontSize: 8.5,
                    margin: "1px 1px 0",
                    padding: "1px 0",
                    color: d === activeDate ? V2.white : undefined,
                    backgroundColor: d === activeDate ? V2.ink : "transparent",
                  }}
                >
                  {Number(d.slice(-2))}
                </div>
              </button>
            ))}
          </div>

          {/* Rows */}
          {rows.map(({ area }) => (
            <div key={area.id} className="flex items-center" style={{ marginBottom: 2 }}>
              <div
                className="truncate pr-2"
                style={{ width: nameWidth, fontSize: 11, color: V2.soft }}
                title={area.name}
              >
                {area.name}
              </div>
              {dates.map((d) => {
                const s = statusFor(area.id, d);
                const meta = STATUS_V2[s];
                const blank = s === "not_started";
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      onSelect(d);
                      onSelectArea?.(area.id);
                    }}
                    title={`${area.name} · ${d} · ${meta.label}`}
                    style={{
                      width: colWidth - 2,
                      height: 14,
                      marginRight: 2,
                      backgroundColor: blank ? V2.paperDim : meta.fg,
                      border: blank ? `1px solid ${V2.rule}` : "none",
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </div>
          ))}

          {/* Worst status per day */}
          <div className="flex items-center" style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${V2.rule}` }}>
            <div
              className="uppercase pr-2"
              style={{
                width: nameWidth,
                fontFamily: V2.mono,
                fontSize: 8.5,
                letterSpacing: "0.08em",
                fontWeight: 700,
                color: V2.muted,
              }}
            >
              Worst status
            </div>
            {dates.map((d) => {
              const w = worstStatus(rows.map((r) => statusFor(r.area.id, d)));
              const meta = statusMeta(w);
              const blank = normaliseStatus(w) === "not_started";
              return (
                <div
                  key={d}
                  title={`${d} · ${meta.label}`}
                  style={{
                    width: colWidth - 2,
                    height: 6,
                    marginRight: 2,
                    backgroundColor: blank ? V2.paperDim : meta.fg,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Higher = worse; used to sort area rows worst-first. */
function STATUS_SEVERITY_DESC(s: string) {
  const order: Record<string, number> = {
    delayed: 0,
    flagged: 1,
    in_progress: 2,
    complete: 3,
    not_started: 4,
  };
  return order[normaliseStatus(s)] ?? 4;
}
