import { V2, parseISO } from "../tokens";

/**
 * Shared chrome for the filed (finalised) client record.
 *
 * The filed view is a *document*, not a dashboard: flat sections, hairline
 * rules, mono uppercase labels, square corners, no shadows. Everything here is
 * deliberately small and shared so the four tabs cannot drift apart.
 */

export const MONO_LABEL: React.CSSProperties = {
  fontFamily: V2.mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

/** Mono section label with a hairline rule and an optional right-hand note. */
export function RuleLabel({
  children,
  note,
  className = "",
}: {
  children: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      style={{ ...MONO_LABEL, color: V2.muted, marginBottom: 12 }}
    >
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1" style={{ backgroundColor: V2.rule }} />
      {note && <span className="shrink-0 text-right">{note}</span>}
    </div>
  );
}

/** Mono counted value that always carries the label of what it counts. */
export function Counted({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <span style={{ ...MONO_LABEL, color: V2.muted, fontWeight: 400 }}>
      {label}{" "}
      <span style={{ color: V2.ink, fontWeight: 700, letterSpacing: "0.04em" }}>{value}</span>
    </span>
  );
}

export const DATE_D_MON = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
export const DATE_D_MON_Y = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const DATE_WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long" });

export const fmtDay = (iso: string) => DATE_D_MON.format(parseISO(iso));
export const fmtDayYear = (iso: string) => DATE_D_MON_Y.format(parseISO(iso));

/** "8 Jul — 17 Aug 2026", collapsing a single-day range. */
export function fmtRange(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  if (!from) return fmtDayYear(to!);
  if (!to || from === to) return fmtDayYear(from);
  return `${fmtDay(from)} — ${fmtDayYear(to)}`;
}

/** Part-of-day from an "HH:MM" clock string rendered in the event's timezone. */
export function partOfDay(hhmm: string | null): string {
  const h = hhmm ? Number(hhmm.slice(0, 2)) : NaN;
  if (Number.isNaN(h)) return "";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

/** Letter markers A–Z(+) keyed to the area index below each map. */
export const areaLetter = (i: number) =>
  i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + Math.floor(i / 26) - 1)}${String.fromCharCode(65 + (i % 26))}`;

/** Square letter chip used on the map and in the area index. */
export function LetterChip({ letter, color, size = 20 }: { letter: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: "#fff",
        fontFamily: V2.mono,
        fontSize: size <= 18 ? 9.5 : 11,
        fontWeight: 700,
      }}
    >
      {letter}
    </span>
  );
}

/** Flat, square, ink-primary button used across the filed document. */
export function FlatButton({
  children,
  onClick,
  active = false,
  primary = false,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  primary?: boolean;
  title?: string;
  className?: string;
}) {
  const solid = active || primary;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`shrink-0 ${className}`}
      style={{
        ...MONO_LABEL,
        letterSpacing: "0.1em",
        padding: "6px 11px",
        border: `1px solid ${solid ? V2.ink : V2.rule}`,
        backgroundColor: solid ? V2.ink : V2.white,
        color: solid ? V2.bandFg : V2.soft,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/**
 * Planar area of a lat/lng ring in hectares (spherical excess is negligible at
 * site scale). Used for the "0.34 ha" column in the map's area index.
 */
export function ringHectares(points: Array<{ lat: number; lng: number }>): number {
  if (points.length < 3) return 0;
  const latRad = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const mPerDegLng = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += (a.lng * mPerDegLng) * (b.lat * mPerDegLat) - (b.lng * mPerDegLng) * (a.lat * mPerDegLat);
  }
  return Math.abs(sum / 2) / 10000;
}
