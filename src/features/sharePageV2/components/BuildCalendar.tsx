import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { V2, parseISO, statusMeta } from "../tokens";
import { PanelHeader } from "./Primitives";
import type { ShareV2DayMeta, ShareV2Phase } from "../types";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

const PHASE_TONE: Record<string, string> = {
  pre_build: "#6B4FA8",
  build: "#0B43D6",
  on_show: "#178A4C",
  takedown: "#B4720F",
};

/**
 * Month calendar for the share page. Shows the build window, phase bands and
 * per-day report status; clicking a day with a report switches the view.
 */
export function BuildCalendar({
  days,
  phases,
  activeDate,
  buildStart,
  buildEnd,
  onSelect,
}: {
  days: ShareV2DayMeta[];
  phases: ShareV2Phase[];
  activeDate: string | null;
  buildStart: string | null;
  buildEnd: string | null;
  onSelect: (d: string) => void;
}) {
  const anchor = activeDate ?? buildStart ?? days[0]?.date ?? iso(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = parseISO(anchor);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const phaseFor = (date: string): ShareV2Phase | undefined =>
    phases.find((p) => p.start_date && date >= p.start_date && date <= (p.end_date ?? p.start_date));

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: startOffset }, () => null);
    for (let i = 1; i <= total; i++) out.push(iso(new Date(cursor.getFullYear(), cursor.getMonth(), i)));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const inWindow = (date: string) =>
    !!buildStart && date >= buildStart && (!buildEnd || date <= buildEnd);

  const shift = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const activePhases = phases.filter((p) => p.start_date);

  return (
    <div className="mb-7 overflow-hidden" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}>
      <div
        className="flex items-center justify-between"
        style={{ padding: "8px 10px 8px 16px", backgroundColor: V2.band }}
      >
        <span
          className="uppercase"
          style={{ fontFamily: V2.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: V2.bandFgSoft }}
        >
          {MONTH_LABEL.format(cursor)}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="flex h-6 w-6 items-center justify-center"
            style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white, color: V2.soft }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shift(1)}
            className="flex h-6 w-6 items-center justify-center"
            style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white, color: V2.soft }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div style={{ backgroundColor: V2.white, padding: 10 }}>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              className="text-center"
              style={{ fontFamily: V2.mono, fontSize: 9, fontWeight: 700, color: V2.muted, paddingBottom: 6 }}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[2px]">
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} style={{ aspectRatio: "1 / 1" }} />;
            const meta = dayMap.get(date);
            const status = meta ? statusMeta(meta.worst_status ?? meta.day_status) : null;
            const active = date === activeDate;
            const phase = phaseFor(date);
            const within = inWindow(date);
            return (
              <button
                key={date}
                type="button"
                disabled={!meta}
                onClick={() => meta && onSelect(date)}
                title={phase?.label ?? phase?.kind ?? undefined}
                className="relative flex flex-col items-center justify-center"
                style={{
                  aspectRatio: "1 / 1",
                  cursor: meta ? "pointer" : "default",
                  backgroundColor: active ? V2.band : within ? V2.paperDim : "transparent",
                  border: `1px solid ${active ? V2.band : within ? V2.rule : "transparent"}`,
                }}
              >
                <span
                  style={{
                    fontFamily: V2.mono,
                    fontSize: 11,
                    fontWeight: active ? 700 : meta ? 600 : 400,
                    color: active ? V2.bandFg : meta ? V2.ink : V2.muted,
                  }}
                >
                  {Number(date.slice(-2))}
                </span>
                <span
                  style={{
                    marginTop: 2,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: status ? status.fg : "transparent",
                  }}
                />
                {phase && (
                  <span
                    style={{
                      position: "absolute",
                      left: 2,
                      right: 2,
                      bottom: 1,
                      height: 2,
                      backgroundColor: PHASE_TONE[phase.kind] ?? V2.muted,
                      opacity: active ? 0.9 : 0.6,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activePhases.length > 0 && (
        <div
          className="flex flex-wrap gap-x-3 gap-y-1"
          style={{ padding: "8px 12px", borderTop: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
        >
          {activePhases.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5" style={{ fontSize: 10.5, color: V2.soft }}>
              <span style={{ width: 10, height: 2, backgroundColor: PHASE_TONE[p.kind] ?? V2.muted }} />
              {p.label ?? p.kind.replace("_", " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
