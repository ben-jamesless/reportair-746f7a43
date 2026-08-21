import { V2, statusHex } from "../tokens";
import { StatusPill } from "../components/Primitives";
import { ShareMapV2 } from "../components/ShareMapV2";
import type { ShareV2GridCell, ShareV2Phase } from "../types";
import { Thumb } from "./Thumb";
import { LetterChip, MONO_LABEL, RuleLabel } from "./ui";
import { TimelineGrid } from "./TimelineGrid";
import type { FiledArea } from "./useFiledModel";

/** Tab 1 — the shape of the build. No photos beyond area cover thumbnails. */
export function OverviewTab({
  token,
  summary,
  areas,
  grid,
  phases,
  activityDates,
  onOpenDay,
  onOpenAlbum,
  onOpenMap,
}: {
  token: string;
  summary: string;
  areas: FiledArea[];
  grid: ShareV2GridCell[];
  phases: ShareV2Phase[];
  activityDates: string[];
  onOpenDay: (date: string) => void;
  onOpenAlbum: (areaId: string) => void;
  onOpenMap: () => void;
}) {
  return (
    <>
      <p className="mb-8" style={{ fontSize: 18, lineHeight: 1.6, color: V2.soft, maxWidth: "68ch" }}>
        {summary}
      </p>

      <RuleLabel note="Click a day to open its record">Build timeline</RuleLabel>
      <TimelineGrid
        areas={areas}
        grid={grid}
        phases={phases}
        activityDates={activityDates}
        onSelect={onOpenDay}
      />

      <RuleLabel className="mt-9" note={<button type="button" onClick={onOpenMap}>Open site map →</button>}>
        Site map
      </RuleLabel>
      <ShareMapV2
        token={token}
        heightRatio="21 / 9"
        labelFor={(id) => areas.find((a) => a.id === id)?.letter ?? ""}
        onAreaClick={(id) => onOpenAlbum(id)}
        areas={areas.map((a) => ({
          area_id: a.id,
          name: a.name,
          sort_order: a.sort_order,
          status: a.latest_status,
          notes: null,
        }))}
      />

      <RuleLabel className="mt-9" note={`${areas.length} areas`}>
        Areas
      </RuleLabel>
      <div style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white }}>
        {areas.map((a, i) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2.5"
            style={{ borderTop: i === 0 ? "none" : `1px solid ${V2.rule}` }}
          >
            <div style={{ width: 78 }}>
              {a.cover_photo_id ? (
                <Thumb token={token} photoId={a.cover_photo_id} alt={a.name} ratio="4 / 3" onClick={() => onOpenAlbum(a.id)} />
              ) : (
                <div style={{ aspectRatio: "4 / 3", backgroundColor: V2.paperDim }} />
              )}
            </div>
            <LetterChip letter={a.letter} color={statusHex(a.latest_status)} size={18} />
            <span style={{ fontSize: 14.5, fontWeight: 700, color: V2.ink, minWidth: 140 }}>{a.name}</span>
            <StatusPill status={a.latest_status} small />
            <span className="flex-1" style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
              {a.photo_count} photos{a.rangeLabel ? ` · ${a.rangeLabel}` : ""}
            </span>
            <button
              type="button"
              onClick={() => onOpenAlbum(a.id)}
              style={{ fontSize: 13, fontWeight: 600, color: V2.ink, textDecoration: "underline" }}
            >
              View album →
            </button>
          </div>
        ))}
        {areas.length === 0 && (
          <p className="p-3" style={{ fontSize: 13, color: V2.muted }}>
            No areas were defined for this event.
          </p>
        )}
      </div>
    </>
  );
}
