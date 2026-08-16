/**
 * Single day-bucketing helper, shared by every server-side surface.
 *
 * The UI (src/lib/eventTime.ts) buckets a photo into the day it was taken in
 * the EVENT's local timezone. The PDF used to bucket in UTC, so a photo taken
 * at 23:30 BST landed on 16 August on the share link and 17 August in the PDF.
 * Both now call the same logic with the same zone.
 */

export const UTC = "UTC";

let tzLookup: ((lat: number, lng: number) => string) | null = null;

/**
 * Why this returns a reason and not just a zone: UTC is both a real answer
 * (an event in Greenwich in winter) and a failure answer (no coordinates on
 * the project). Callers must be able to tell them apart, because every
 * surface has to SAY which zone it is rendering in rather than guess quietly.
 */
export type EventZone = {
  tz: string;
  /** false when the zone is a fallback, not a lookup result. */
  resolved: boolean;
  reason: "coords" | "no_coords" | "lookup_failed";
};

export async function resolveEventZone(
  lat?: number | null,
  lng?: number | null,
): Promise<EventZone> {
  if (lat == null || lng == null) {
    return { tz: UTC, resolved: false, reason: "no_coords" };
  }
  try {
    if (!tzLookup) {
      const m = await import("https://esm.sh/tz-lookup@6.1.25");
      tzLookup = (m.default ?? m) as (lat: number, lng: number) => string;
    }
    const zone = tzLookup(Number(lat), Number(lng));
    if (!zone) return { tz: UTC, resolved: false, reason: "lookup_failed" };
    return { tz: zone, resolved: true, reason: "coords" };
  } catch {
    return { tz: UTC, resolved: false, reason: "lookup_failed" };
  }
}

/** The line every document prints so the reader knows the basis of the times. */
export function timeZoneNote(z: EventZone): string {
  if (z.resolved) return `Times shown in ${z.tz} (event local)`;
  return z.reason === "no_coords"
    ? "Times shown in UTC — no event location set"
    : "Times shown in UTC — event timezone could not be resolved";
}

export async function resolveEventTimeZone(
  lat?: number | null,
  lng?: number | null,
): Promise<string> {
  return (await resolveEventZone(lat, lng)).tz;
}

/** "2026-08-16" in event-local time. Null when there is no usable timestamp. */
export function eventDayKey(
  iso: string | null | undefined,
  tz: string = UTC,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: UTC }).format(d);
  }
}
