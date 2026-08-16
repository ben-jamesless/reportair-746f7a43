/**
 * Single source of truth for rendering photo capture times.
 *
 * The record is evidential: the same photo must read the same time on the
 * Library, the Daily Report, the client link and every PDF. Before this
 * helper existed each surface called `new Date(iso).getHours()`, which renders
 * in the *viewer's* browser timezone — so a photo captured at 15:29 on site in
 * London read 22:29 to someone opening the Library in Hong Kong.
 *
 * Every surface now renders the **event's** local time, resolved from the
 * project's geo coordinates. When a project has no coordinates we fall back to
 * UTC — deterministic and identical for every viewer — never browser local.
 */

import { useEffect, useState } from "react";

export const UTC = "UTC";

/** lat,lng (3dp) -> IANA zone. Populated lazily; survives re-renders. */
const tzCache = new Map<string, string>();
let tzLookup: ((lat: number, lng: number) => string) | null = null;
let tzLoading: Promise<void> | null = null;

const keyFor = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

async function ensureLookup(): Promise<void> {
  if (tzLookup) return;
  if (!tzLoading) {
    tzLoading = import("tz-lookup")
      .then((m) => {
        tzLookup = (m.default ?? m) as (lat: number, lng: number) => string;
      })
      .catch(() => {
        /* offline / chunk failure — callers stay on UTC */
      });
  }
  await tzLoading;
}

/** Synchronous read of an already-resolved zone. */
export function cachedEventTimeZone(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return UTC;
  return tzCache.get(keyFor(lat, lng)) ?? UTC;
}

/**
 * UTC is both a real answer and a failure answer, so the resolver reports
 * which one it gave. Surfaces must state the zone rather than imply one.
 */
export type EventZone = {
  tz: string;
  resolved: boolean;
  reason: "coords" | "no_coords" | "lookup_failed";
};

export async function resolveEventZone(
  lat?: number | null,
  lng?: number | null
): Promise<EventZone> {
  if (lat == null || lng == null) return { tz: UTC, resolved: false, reason: "no_coords" };
  const k = keyFor(lat, lng);
  const hit = tzCache.get(k);
  if (hit) return { tz: hit, resolved: true, reason: "coords" };
  await ensureLookup();
  if (!tzLookup) return { tz: UTC, resolved: false, reason: "lookup_failed" };
  try {
    const zone = tzLookup(lat, lng);
    if (!zone) return { tz: UTC, resolved: false, reason: "lookup_failed" };
    tzCache.set(k, zone);
    return { tz: zone, resolved: true, reason: "coords" };
  } catch {
    return { tz: UTC, resolved: false, reason: "lookup_failed" };
  }
}

/** The line a surface prints so the reader knows the basis of the times. */
export function timeZoneNote(z: { tz: string; resolved: boolean; reason: string }): string {
  if (z.resolved) return `Times shown in ${z.tz} (event local)`;
  return z.reason === "no_coords"
    ? "Times shown in UTC — no event location set"
    : "Times shown in UTC — event timezone could not be resolved";
}

export async function resolveEventTimeZone(
  lat?: number | null,
  lng?: number | null
): Promise<string> {
  return (await resolveEventZone(lat, lng)).tz;
}

/**
 * Resolves the event timezone for a project. Returns UTC until the lookup
 * table has loaded, then re-renders with the real zone.
 */
export function useEventTimeZone(lat?: number | null, lng?: number | null): string {
  const [tz, setTz] = useState<string>(() => cachedEventTimeZone(lat, lng));
  useEffect(() => {
    let cancelled = false;
    void resolveEventTimeZone(lat, lng).then((z) => {
      if (!cancelled) setTz(z);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);
  return tz;
}

const timeFmtCache = new Map<string, Intl.DateTimeFormat>();
function timeFmt(tz: string) {
  let f = timeFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
    timeFmtCache.set(tz, f);
  }
  return f;
}

/** "15:29" in event-local time. Null when there is no usable timestamp. */
export function formatCaptureTime(iso: string | null | undefined, tz: string = UTC): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return timeFmt(tz).format(d);
  } catch {
    return timeFmt(UTC).format(d);
  }
}

/** "2026-08-13" in event-local time — the day a photo belongs to. */
export function eventDayKey(iso: string | null | undefined, tz: string = UTC): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    // en-CA gives YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: UTC }).format(d);
  }
}

/**
 * Absolute stamp for records — "Today, 09:14" / "13 Aug 2026, 09:14".
 * Relative time ("2 days ago") has no evidential value and is banned here.
 */
export function formatAbsoluteStamp(iso: string | null | undefined, tz: string = UTC): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = formatCaptureTime(iso, tz) ?? "";
  const today = eventDayKey(new Date().toISOString(), tz);
  const day = eventDayKey(iso, tz);
  if (day && day === today) return `Today, ${time}`;
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz,
  }).format(d);
  return `${date}, ${time}`;
}

/**
 * Ambient event timezone for the share page. The client report renders one
 * event per document, so the zone is set once when the report loads and every
 * nested component (zone cards, lightbox, stat strip) formats against it
 * instead of threading a prop through every level.
 */
let ambientTz: string = UTC;
export const setAmbientEventTimeZone = (tz: string) => {
  ambientTz = tz || UTC;
};
export const getAmbientEventTimeZone = () => ambientTz;
