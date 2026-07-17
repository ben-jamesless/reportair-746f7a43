import { useTeamSeatSummary } from "@/hooks/useTeamSeatSummary";
import { AlertTriangle } from "lucide-react";

const LABEL_INK = "#5C5850";
const WARN = "#D4A017";

/**
 * Compact seat counters strip: shows Core (used / cap) and External (used / cap)
 * with a below-ratio warning when externalCount > 5 × coreCount.
 * Reads exclusively from the `team_seat_summary` RPC so the numbers match
 * what the DB trigger enforces on insert.
 */
export function TeamSeatStrip({ teamId }: { teamId: string | null }) {
  const s = useTeamSeatSummary(teamId);
  if (!teamId || s.loading) return null;

  const cap = (n: number) => (n === -1 ? "∞" : String(n));

  return (
    <div
      className="mb-4 border"
      style={{ borderColor: "#E3DFD4", background: "#FAF8F2" }}
    >
      <div className="grid grid-cols-2 divide-x" style={{ borderColor: "#E3DFD4" }}>
        <Cell label="Core seats" value={`${s.coreCount} / ${cap(s.coreCap)}`} hint={s.addonSeats ? `${s.addonSeats} add-on` : undefined} />
        <Cell
          label="External"
          value={`${s.externalCount} / ${cap(s.externalCap)}`}
          hint={s.externalCap === 0 ? "not on plan" : undefined}
        />
      </div>
      {s.underRatio && (
        <div
          className="flex items-start gap-2 border-t px-3 py-2 text-xs"
          style={{ borderColor: "#E3DFD4", color: WARN }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            External members exceed the 5:1 ratio to core members. New external
            invites will be blocked until you add a core seat or remove an external.
          </span>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-3 py-2">
      <div
        className="font-semibold uppercase"
        style={{ fontSize: 10, letterSpacing: "0.08em", color: LABEL_INK }}
      >
        {label}
      </div>
      <div className="mt-0.5 text-sm tabular-nums" style={{ color: "#1a1a1a" }}>
        {value}
        {hint && <span className="ml-1.5 text-xs" style={{ color: LABEL_INK }}>({hint})</span>}
      </div>
    </div>
  );
}
