import { RichNotes } from "@/components/RichNotes";
import { V2, DATE_SHORT, orderDaysForList, parseISO, statusMeta } from "../tokens";
import type { ShareV2Day, ShareV2DayMeta } from "../types";
import { StatusPill } from "./Primitives";

function TodaySection({ title, value, tone }: { title: string; value: string | null | undefined; tone: string }) {
  if (!value) return null;
  return (
    <div className="mb-4 last:mb-0" style={{ borderLeft: `2px solid ${tone}`, paddingLeft: 10 }}>
      <h4
        className="mb-1 uppercase"
        style={{ fontFamily: V2.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: tone }}
      >
        {title}
      </h4>
      <div style={{ fontSize: 13, color: V2.soft, lineHeight: 1.6 }}>
        <RichNotes value={value} />
      </div>
    </div>
  );
}

export function TodayBox({ day }: { day: ShareV2Day }) {
  const empty =
    !day.today_objectives && !day.today_achievements && !day.open_issues && !day.tomorrow_objectives && !day.notes;
  return (
    <div className="mb-7 overflow-hidden" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}>
      <div
        className="flex items-center justify-between"
        style={{ backgroundColor: V2.ink, padding: "12px 16px" }}
      >
        <span
          className="uppercase"
          style={{ fontFamily: V2.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,.65)" }}
        >
          Day summary
        </span>
        <span style={{ fontFamily: V2.mono, fontSize: 14, fontWeight: 700, color: "#fff" }}>
          {day.date ? DATE_SHORT.format(parseISO(day.date)) : ""}
        </span>
      </div>
      <div style={{ padding: 16, backgroundColor: V2.white }}>
        {empty ? (
          <p style={{ fontSize: 13, color: V2.muted }}>No written summary recorded for this day.</p>
        ) : (
          <>
            <TodaySection title="Objectives" value={day.today_objectives} tone="#0B43D6" />
            <TodaySection title="Progress" value={day.today_achievements} tone="#178A4C" />
            <TodaySection title="Open issues" value={day.open_issues} tone="#B4720F" />
            <TodaySection title="Tomorrow" value={day.tomorrow_objectives} tone={V2.muted} />
            <TodaySection title="Notes" value={day.notes} tone={V2.muted} />
          </>
        )}
      </div>
    </div>
  );
}

export function AreaGlance({
  rows,
}: {
  rows: { id: string; name: string; status: string | null; noUpdate: boolean; photos: number }[];
}) {
  return (
    <div className="mb-7 overflow-hidden" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}>
      <div
        className="uppercase"
        style={{
          fontFamily: V2.mono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,.65)",
          padding: "12px 16px",
          backgroundColor: V2.ink,
        }}
      >
        Area status at a glance
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 px-3.5 py-2.5"
          style={{ borderTop: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
        >
          <span className="flex-1 truncate" style={{ fontSize: 12.5, fontWeight: 600, color: V2.ink }}>
            {r.name}
          </span>
          <StatusPill status={r.status} noUpdate={r.noUpdate} small />
          <span style={{ fontFamily: V2.mono, fontSize: 11, color: V2.muted, minWidth: 20, textAlign: "right" }}>
            {r.photos}
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="px-3.5 py-4" style={{ fontSize: 12.5, color: V2.muted, backgroundColor: V2.white }}>
          No areas defined.
        </div>
      )}
    </div>
  );
}

export function DayTimeline({
  days,
  activeDate,
  onSelect,
}: {
  days: ShareV2DayMeta[];
  activeDate: string | null;
  onSelect: (d: string) => void;
}) {
  return (
    <div className="overflow-hidden" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}>
      <div
        className="uppercase"
        style={{
          fontFamily: V2.mono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,.65)",
          padding: "12px 16px",
          backgroundColor: V2.ink,
        }}
      >
        <span className="flex items-center justify-between">
          <span>Build timeline</span>
          <span style={{ letterSpacing: "0.08em" }}>Photos</span>
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {/* Reverse-chronological: today first, so clients never scan past empty days. */}
        {orderDaysForList(days).map((d) => {
          const meta = statusMeta(d.worst_status ?? d.day_status);
          const active = d.date === activeDate;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelect(d.date)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
              style={{
                borderTop: `1px solid ${V2.rule}`,
                backgroundColor: active ? V2.paperDim : V2.white,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: meta.fg }} />
              <span
                className="flex-1"
                style={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: V2.ink }}
              >
                {DATE_SHORT.format(parseISO(d.date))}
              </span>
              <span style={{ fontFamily: V2.mono, fontSize: 11, color: V2.muted }}>{d.photo_count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
