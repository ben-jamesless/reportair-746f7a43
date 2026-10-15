import { V2 } from "../tokens";

type Stat = { label: string; value: string; unit?: string; sub?: string; tone?: string };

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div
      className="mb-7 grid overflow-hidden"
      style={{
        gap: 1,
        backgroundColor: V2.rule,
        border: `1px solid ${V2.rule}`,
        borderRadius: V2.radiusReport,
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      }}
    >
      {stats.map((s) => (
        <div key={s.label} style={{ backgroundColor: V2.white, padding: "14px 16px" }}>
          <div
            className="uppercase"
            style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: V2.muted, marginBottom: 5 }}
          >
            {s.label}
          </div>
          <div
            style={{ fontFamily: V2.mono, fontSize: 24, fontWeight: 700, lineHeight: 1, color: s.tone ?? V2.ink }}
          >
            {s.value}
            {s.unit && (
              <small style={{ fontSize: 13, fontWeight: 500, color: V2.muted, fontFamily: "inherit" }}> {s.unit}</small>
            )}
          </div>
          {s.sub && <div style={{ fontSize: 11, color: V2.muted, marginTop: 3 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Vertical stat table for the right rail — one row per metric. */
export function StatTable({ stats }: { stats: Stat[] }) {
  return (
    <div
      className="overflow-hidden"
      style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport, backgroundColor: V2.white }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="flex items-baseline justify-between gap-3 px-4 py-2.5"
          style={i > 0 ? { borderTop: `1px solid ${V2.rule}` } : undefined}
        >
          <div className="min-w-0">
            <div
              className="uppercase"
              style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: V2.muted }}
            >
              {s.label}
            </div>
            {s.sub && <div style={{ fontSize: 11, color: V2.muted, marginTop: 2 }}>{s.sub}</div>}
          </div>
          <div
            className="shrink-0"
            style={{ fontFamily: V2.mono, fontSize: 18, fontWeight: 700, lineHeight: 1, color: s.tone ?? V2.ink }}
          >
            {s.value}
            {s.unit && (
              <small style={{ fontSize: 11, fontWeight: 500, color: V2.muted, fontFamily: "inherit" }}> {s.unit}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
