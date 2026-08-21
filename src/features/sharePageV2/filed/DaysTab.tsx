import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { V2, deriveAreaStatus, normaliseStatus, statusMeta } from "../tokens";
import { StatusPill } from "../components/Primitives";
import { ShareLightboxV2 } from "../components/ShareLightboxV2";
import type { ShareV2Day, ShareV2Phase, ShareV2Photo } from "../types";
import { Thumb } from "./Thumb";
import { DATE_WEEKDAY, MONO_LABEL, RuleLabel, fmtDay, fmtDayYear } from "./ui";
import type { FiledArea, FiledDay } from "./useFiledModel";
import { parseISO } from "../tokens";

/** The Days tab is a sample with a door to the full album, never the album. */
const AREA_THUMB_CAP = 7;

const PHASE_TONE: Record<string, string> = {
  pre_build: "#6B4FA8",
  build: "#0B43D6",
  on_show: "#178A4C",
  takedown: "#B4720F",
};

function PhaseChip({ phase }: { phase: ShareV2Phase | undefined }) {
  if (!phase) return null;
  const tone = PHASE_TONE[phase.kind] ?? V2.muted;
  return (
    <span style={{ ...MONO_LABEL, fontSize: 9.5, color: tone, backgroundColor: `${tone}1F`, padding: "3px 7px" }}>
      {(phase.label ?? phase.kind.replace("_", " ")).toUpperCase()}
    </span>
  );
}

/** Renders as "Day status · In progress" so it can never be read as a final area status. */
function DayStatus({ status, date }: { status: string | null | undefined; date?: string }) {
  const meta = statusMeta(status);
  return (
    <span className="inline-flex items-center gap-1.5" style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: meta.fg }} />
      {date ? `Status on ${fmtDay(date)}` : "Day status"}
      <span style={{ color: meta.fg, fontWeight: 700 }}>{meta.label}</span>
    </span>
  );
}

function Bullets({ text }: { text: string | null | undefined }) {
  if (!text?.trim()) return null;
  const lines = text
    .replace(/<[^>]*>/g, "\n")
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {lines.map((l, i) => (
        <li key={i} className="flex gap-2" style={{ fontSize: 13.5, color: V2.soft, marginBottom: 5 }}>
          <span style={{ width: 5, height: 5, backgroundColor: V2.muted, marginTop: 6, flexShrink: 0 }} />
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

function ExpandedDay({
  token,
  date,
  areas,
  phase,
  onOpenAlbum,
  onShowOnMap,
}: {
  token: string;
  date: string;
  areas: FiledArea[];
  phase: ShareV2Phase | undefined;
  onOpenAlbum: (areaId: string) => void;
  onShowOnMap?: (photo: ShareV2Photo) => void;
}) {
  const [day, setDay] = useState<ShareV2Day | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: ShareV2Photo[]; index: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setDay(null);
    (async () => {
      const { data } = await supabase.rpc("share_day" as never, { _token: token, _date: date } as never);
      const d = data as ShareV2Day | null;
      if (alive) setDay(d?.ok ? d : null);
    })();
    return () => {
      alive = false;
    };
  }, [token, date]);

  const photosByArea = useMemo(() => {
    const m = new Map<string, ShareV2Photo[]>();
    for (const p of day?.photos ?? []) {
      const k = p.area_id ?? "__unassigned";
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [day?.photos]);

  const dayAreas = day?.areas ?? [];
  const totalPhotos = (day?.photos ?? []).length;
  const worst = day?.worst_status ?? day?.day_status ?? null;

  return (
    <div style={{ border: `1px solid ${V2.ink}`, backgroundColor: V2.white }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ borderBottom: `1px solid ${V2.rule}` }}>
        <span style={{ fontFamily: V2.mono, fontSize: 14, fontWeight: 700, color: V2.ink }}>
          {fmtDayYear(date).toUpperCase()}
        </span>
        <span style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
          {DATE_WEEKDAY.format(parseISO(date)).toUpperCase()}
        </span>
        <PhaseChip phase={phase} />
        <DayStatus status={worst} date={date} />
        <span className="ml-auto" style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
          {dayAreas.filter((a) => (photosByArea.get(a.area_id)?.length ?? 0) > 0 || a.notes).length} of{" "}
          {dayAreas.length} areas · {totalPhotos} photos
        </span>
      </div>

      {day === null && (
        <p className="px-4 py-5" style={{ ...MONO_LABEL, color: V2.muted }}>
          Loading day record…
        </p>
      )}

      {day && (
        <>
          {(day.today_objectives || day.today_achievements || day.tomorrow_objectives || day.open_issues || day.notes) && (
            <div className="grid gap-x-8 gap-y-4 px-4 py-4 md:grid-cols-2" style={{ borderBottom: `1px solid ${V2.rule}` }}>
              <div>
                <div style={{ ...MONO_LABEL, color: V2.muted, marginBottom: 8 }}>Objectives set</div>
                <Bullets text={day.today_objectives} />
                {!day.today_objectives?.trim() && (
                  <p style={{ fontSize: 13, color: V2.muted }}>No objectives were recorded for this day.</p>
                )}
                {day.tomorrow_objectives?.trim() && (
                  <>
                    <div style={{ ...MONO_LABEL, color: V2.muted, margin: "14px 0 8px" }}>Tomorrow</div>
                    <Bullets text={day.tomorrow_objectives} />
                  </>
                )}
              </div>
              <div style={{ borderLeft: `1px solid ${V2.rule}`, paddingLeft: 20 }} className="max-md:border-l-0 max-md:pl-0">
                <div style={{ ...MONO_LABEL, color: V2.muted, marginBottom: 8 }}>What happened</div>
                <Bullets text={day.today_achievements || day.notes} />
                {!day.today_achievements?.trim() && !day.notes?.trim() && (
                  <p style={{ fontSize: 13, color: V2.muted }}>No outcome was recorded for this day.</p>
                )}
                {day.open_issues?.trim() && (
                  <>
                    <div style={{ ...MONO_LABEL, color: V2.signalRed, margin: "14px 0 8px" }}>Issue raised</div>
                    <div style={{ borderLeft: `2px solid ${V2.signalRed}`, paddingLeft: 10 }}>
                      <Bullets text={day.open_issues} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {dayAreas.map((a) => {
            const photos = photosByArea.get(a.area_id) ?? [];
            const status = a.display_status ?? deriveAreaStatus(a.status, photos.length);
            const idle = photos.length === 0 && !a.notes && normaliseStatus(status) === "not_started";
            const shown = photos.slice(0, AREA_THUMB_CAP);
            const rest = (areas.find((x) => x.id === a.area_id)?.photo_count ?? photos.length) - shown.length;
            if (idle) {
              return (
                <div key={a.area_id} className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${V2.rule}` }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: V2.muted }}>{a.name}</span>
                  <span style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
                    No photos captured in this area on {fmtDay(date)}
                  </span>
                </div>
              );
            }
            return (
              <div key={a.area_id} className="px-4 py-3.5" style={{ borderTop: `1px solid ${V2.rule}` }}>
                <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span style={{ fontSize: 14, fontWeight: 700, color: V2.ink }}>{a.name}</span>
                  <StatusPill status={status} small />
                  {a.notes && <span style={{ fontSize: 13, color: V2.soft }}>{a.notes}</span>}
                  <button
                    type="button"
                    onClick={() => onOpenAlbum(a.area_id)}
                    className="ml-auto"
                    style={{ fontSize: 13, color: V2.ink, textDecoration: "underline" }}
                  >
                    Open album →
                  </button>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-8">
                    {shown.map((p, i) => (
                      <Thumb
                        key={p.id}
                        token={token}
                        photoId={p.id}
                        alt={p.caption || p.file_name}
                        onClick={() => setLightbox({ photos, index: i })}
                      />
                    ))}
                    {rest > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenAlbum(a.area_id)}
                        className="flex flex-col items-center justify-center"
                        style={{
                          aspectRatio: "4 / 3",
                          border: `1px solid ${V2.rule}`,
                          backgroundColor: V2.paperDim,
                          ...MONO_LABEL,
                          fontSize: 9.5,
                          color: V2.soft,
                        }}
                      >
                        +{rest}
                        <span style={{ fontWeight: 400 }}>in album</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {lightbox && (
        <ShareLightboxV2
          token={token}
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
          onShowOnMap={onShowOnMap}
        />
      )}
    </div>
  );
}

/** Tab 2 — what was planned, what happened, what went wrong. */
export function DaysTab({
  token,
  days,
  allDays,
  areas,
  phases,
  activeDate,
  onSelectDay,
  filedAt,
  onOpenAlbum,
  onShowOnMap,
}: {
  token: string;
  days: FiledDay[];
  allDays: FiledDay[];
  areas: FiledArea[];
  phases: ShareV2Phase[];
  activeDate: string | null;
  onSelectDay: (d: string | null) => void;
  filedAt: string | null;
  onOpenAlbum: (areaId: string) => void;
  onShowOnMap?: (photo: ShareV2Photo) => void;
}) {
  const ordered = useMemo(() => [...days].sort((a, b) => (a.date < b.date ? 1 : -1)), [days]);
  const phaseFor = (d: string) =>
    phases.find((p) => p.start_date && d >= p.start_date && d <= (p.end_date ?? p.start_date!));

  /** Runs of undocumented days between two documented ones, newest first. */
  const rows = useMemo(() => {
    const out: Array<{ kind: "day"; day: FiledDay } | { kind: "gap"; from: string; to: string }> = [];
    for (let i = 0; i < ordered.length; i++) {
      out.push({ kind: "day", day: ordered[i] });
      const next = ordered[i + 1];
      if (!next) continue;
      const a = parseISO(next.date).getTime();
      const b = parseISO(ordered[i].date).getTime();
      const gapDays = Math.round((b - a) / 86400000) - 1;
      if (gapDays > 0) {
        const from = new Date(a + 86400000);
        const to = new Date(b - 86400000);
        const iso = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        out.push({ kind: "gap", from: iso(from), to: iso(to) });
      }
    }
    return out;
  }, [ordered]);

  const restDays = allDays.length - days.length;

  return (
    <>
      <RuleLabel note={`${days.length} of ${allDays.length} · newest first`}>Days with activity</RuleLabel>

      {/* Day chip rail — replaces both the calendar and the rail day list. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ordered.map((d) => {
          const on = d.date === activeDate;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDay(on ? null : d.date)}
              style={{
                ...MONO_LABEL,
                fontSize: 9.5,
                padding: "5px 9px",
                border: `1px solid ${on ? V2.ink : V2.rule}`,
                backgroundColor: on ? V2.ink : V2.white,
                color: on ? V2.inkFg : V2.soft,
              }}
            >
              {fmtDay(d.date).toUpperCase()}
            </button>
          );
        })}
      </div>

      {restDays > 0 && (
        <p style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted, marginBottom: 14 }}>
          Days with no activity are not listed. They appear as gaps in the timeline on the Overview.
        </p>
      )}

      {filedAt && (
        <div
          className="flex flex-wrap items-baseline gap-2 px-4 py-3"
          style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.paperDim, marginBottom: 6 }}
        >
          <span style={{ fontFamily: V2.mono, fontSize: 12, fontWeight: 700, color: V2.ink }}>
            {fmtDay(filedAt.slice(0, 10)).toUpperCase()}
          </span>
          <span style={{ fontSize: 13, color: V2.soft }}>
            <strong style={{ color: V2.ink }}>Record filed.</strong> No further entries can be added.
          </span>
        </div>
      )}

      {rows.map((r) => {
        if (r.kind === "gap") {
          const label = r.from === r.to ? fmtDay(r.from) : `${fmtDay(r.from)} — ${fmtDay(r.to)}`;
          return (
            <div
              key={`gap-${r.from}`}
              style={{
                ...MONO_LABEL,
                fontWeight: 400,
                color: V2.muted,
                border: `1px dashed ${V2.rule}`,
                padding: "6px 12px",
                margin: "6px 0",
              }}
            >
              {label.toUpperCase()} · No activity recorded
            </div>
          );
        }
        const d = r.day;
        const open = d.date === activeDate;
        if (open) {
          return (
            <div key={d.date} className="my-1.5" id={`day-${d.date}`} style={{ scrollMarginTop: 12 }}>
              <ExpandedDay
                token={token}
                date={d.date}
                areas={areas}
                phase={phaseFor(d.date)}
                onOpenAlbum={onOpenAlbum}
                onShowOnMap={onShowOnMap}
              />
            </div>
          );
        }
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onSelectDay(d.date)}
            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left"
            style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white, marginBottom: 6 }}
          >
            <span style={{ fontFamily: V2.mono, fontSize: 12, fontWeight: 700, color: V2.ink, minWidth: 58 }}>
              {fmtDay(d.date).toUpperCase()}
            </span>
            <PhaseChip phase={phaseFor(d.date)} />
            <DayStatus status={d.worst_status ?? d.day_status} />
            <span className="min-w-[160px] flex-1 truncate" style={{ fontSize: 13.5, color: V2.soft }}>
              {d.summary?.trim() || "No written summary for this day."}
            </span>
            <span style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
              {d.area_count ?? 0} areas · {d.photo_count} photos
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: V2.muted }} />
          </button>
        );
      })}

      {days.length === 0 && <p style={{ fontSize: 13, color: V2.muted }}>No days were documented for this event.</p>}
      {activeDate && (
        <button
          type="button"
          onClick={() => onSelectDay(null)}
          className="mt-3 flex items-center gap-1.5"
          style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}
        >
          <ChevronDown className="h-3.5 w-3.5" /> Collapse the open day
        </button>
      )}
    </>
  );
}
