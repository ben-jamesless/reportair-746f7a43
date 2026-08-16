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

export async function resolveEventTimeZone(
  lat?: number | null,
  lng?: number | null,
): Promise<string> {
  if (lat == null || lng == null) return UTC;
  try {
    if (!tzLookup) {
      const m = await import("https://esm.sh/tz-lookup@6.1.25");
      tzLookup = (m.default ?? m) as (lat: number, lng: number) => string;
    }
    return tzLookup(Number(lat), Number(lng)) || UTC;
  } catch {
    return UTC;
  }
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
