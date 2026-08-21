import { useMemo } from "react";
import { eventDayKey, getAmbientEventTimeZone } from "@/lib/eventTime";
import { STATUS_SEVERITY, normaliseStatus, statusMeta, timeLabel } from "../tokens";
import type { ShareV2AreaMeta, ShareV2DayMeta, ShareV2GridCell, ShareV2Meta, ShareV2Photo } from "../types";
import { fmtDay, fmtRange, partOfDay } from "./ui";

/** Per-area rollup derived entirely from data already in `share_meta`. */
export type FiledArea = ShareV2AreaMeta & {
  letter: string;
  firstDate: string | null;
  lastDate: string | null;
  rangeLabel: string | null;
  daysWithActivity: number;
};

export type FiledDay = ShareV2DayMeta & { hasActivity: boolean };

/**
 * Everything the filed record derives from `share_meta`. Kept in one place so
 * the four tabs read from a single model and can never disagree on a count.
 */
export function useFiledModel(meta: ShareV2Meta | null) {
  return useMemo(() => {
    const areas = meta?.areas ?? [];
    const grid: ShareV2GridCell[] = meta?.grid ?? [];
    const allDays = [...(meta?.days ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1));

    const byArea = new Map<string, ShareV2GridCell[]>();
    for (const c of grid) {
      const arr = byArea.get(c.area_id) ?? [];
      arr.push(c);
      byArea.set(c.area_id, arr);
    }

    const filedAreas: FiledArea[] = areas.map((a, i) => {
      const cells = (byArea.get(a.id) ?? []).filter((c) => (c.photo_count ?? 0) > 0);
      const dates = cells.map((c) => c.date).sort();
      const firstDate = dates[0] ?? null;
      const lastDate = dates[dates.length - 1] ?? null;
      return {
        ...a,
        letter: String.fromCharCode(65 + i),
        firstDate,
        lastDate,
        rangeLabel: fmtRange(firstDate, lastDate),
        daysWithActivity: dates.length,
      };
    });

    const activeDays: FiledDay[] = allDays
      .map((d) => ({ ...d, hasActivity: d.photo_count > 0 || d.has_notes }))
      .filter((d) => d.hasActivity);

    const totals = {
      areas: areas.length,
      photos: meta?.photo_count ?? 0,
      daysDocumented: activeDays.length,
    };

    const complete = filedAreas.filter((a) => normaliseStatus(a.latest_status) === "complete").length;
    const flagged = filedAreas.filter((a) =>
      ["flagged", "delayed"].includes(normaliseStatus(a.latest_status))
    ).length;

    /** Newest day with photos — never a rest day. */
    const defaultDay =
      [...activeDays].reverse().find((d) => d.photo_count > 0)?.date ??
      activeDays[activeDays.length - 1]?.date ??
      null;

    const spanFrom = activeDays[0]?.date ?? meta?.project?.build_start_date ?? null;
    const spanTo = activeDays[activeDays.length - 1]?.date ?? meta?.project?.build_end_date ?? null;

    return { areas: filedAreas, activeDays, allDays, totals, complete, flagged, defaultDay, spanFrom, spanTo };
  }, [meta]);
}

/**
 * The closing summary a record should lead with — derived, never authored,
 * so it is always true of the data below it.
 */
export function closingSummary(
  m: ReturnType<typeof useFiledModel>,
  filedAt: string | null,
  authored?: string | null
): string {
  if (authored?.trim()) return authored.trim();
  const range = fmtRange(m.spanFrom, m.spanTo);
  const parts: string[] = [];
  parts.push(
    `${range ? `Between ${range}, this` : "This"} site was documented across ${m.totals.daysDocumented} ${
      m.totals.daysDocumented === 1 ? "day" : "days"
    } of activity, in ${m.totals.areas} ${m.totals.areas === 1 ? "area" : "areas"}, with ${
      m.totals.photos
    } ${m.totals.photos === 1 ? "photograph" : "photographs"} filed.`
  );
  parts.push(
    m.complete === m.totals.areas
      ? `All ${m.totals.areas} areas closed as complete.`
      : `${m.complete} of ${m.totals.areas} areas closed as complete.`
  );
  parts.push(
    m.flagged === 0
      ? "No issues were left open at filing."
      : `${m.flagged} ${m.flagged === 1 ? "area was" : "areas were"} still carrying an issue at filing.`
  );
  if (filedAt) parts.push(`The record was filed on ${fmtDay(filedAt.slice(0, 10))}.`);
  return parts.join(" ");
}

/** Photos grouped into the capture visit they were taken on. */
export type Visit = {
  key: string;
  date: string | null;
  from: string | null;
  to: string | null;
  photos: ShareV2Photo[];
};

const GAP_MS = 45 * 60 * 1000;

/**
 * Group an album's photos into capture visits: a gap of more than ~45 minutes
 * between consecutive captures starts a new visit. Undated photos are pooled
 * into a single trailing group rather than dropped.
 */
export function groupIntoVisits(photos: ShareV2Photo[], newestFirst = true): Visit[] {
  const tz = getAmbientEventTimeZone();
  const dated = photos.filter((p) => p.captured_at);
  const undated = photos.filter((p) => !p.captured_at);
  dated.sort((a, b) => (a.captured_at! < b.captured_at! ? -1 : 1));

  const groups: ShareV2Photo[][] = [];
  for (const p of dated) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    const gap = prev ? new Date(p.captured_at!).getTime() - new Date(prev.captured_at!).getTime() : Infinity;
    const sameDay = prev ? eventDayKey(prev.captured_at, tz) === eventDayKey(p.captured_at, tz) : false;
    if (!last || gap > GAP_MS || !sameDay) groups.push([p]);
    else last.push(p);
  }

  const visits: Visit[] = groups.map((g) => ({
    key: g[0].id,
    date: eventDayKey(g[0].captured_at, tz),
    from: timeLabel(g[0].captured_at),
    to: timeLabel(g[g.length - 1].captured_at),
    photos: g,
  }));

  if (newestFirst) visits.reverse();
  if (undated.length > 0) visits.push({ key: "undated", date: null, from: null, to: null, photos: undated });
  return visits;
}

/** "13 AUG · AFTERNOON · 15:02 — 15:19" */
export function visitHeader(v: Visit): { date: string; detail: string } {
  if (!v.date) return { date: "Undated", detail: "No capture time recorded" };
  const time = v.from && v.to ? (v.from === v.to ? v.from : `${v.from} — ${v.to}`) : "";
  return {
    date: fmtDay(v.date),
    detail: [partOfDay(v.from), time].filter(Boolean).join(" · "),
  };
}

export const statusLabel = (s: string | null | undefined) => statusMeta(s).label;
export const severityOf = (s: string | null | undefined) => STATUS_SEVERITY[normaliseStatus(s)];
