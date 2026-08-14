import { STATUS_HEX, STATUS_V2, V2, type StatusKey } from "../tokens";

const ORDER: StatusKey[] = ["not_started", "in_progress", "flagged", "delayed", "complete"];

/**
 * Key for the share map. The map is tinted by derived area status — the same
 * field the area pills read — so the key must describe statuses, never area
 * names or the ops planning colours (which never reach a share link).
 */
export function StatusMapKey() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5"
      style={{ padding: "10px 12px", borderTop: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
    >
      <span
        className="uppercase"
        style={{ fontFamily: V2.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", color: V2.muted }}
      >
        Status key
      </span>
      {ORDER.map((k) => (
        <span key={k} className="flex items-center gap-1.5" style={{ fontSize: 11, color: V2.soft }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: STATUS_HEX[k] }} />
          {STATUS_V2[k].label}
        </span>
      ))}
    </div>
  );
}
