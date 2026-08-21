import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MapFeature } from "@/features/projectMap/useMapFeatures";
import { V2, statusHex, statusMeta } from "../tokens";
import { ShareMapV2 } from "../components/ShareMapV2";
import type { ShareV2MapProvenance, ShareV2Project } from "../types";
import { Thumb } from "./Thumb";
import { FlatButton, LetterChip, MONO_LABEL, RuleLabel, fmtDayYear, ringHectares } from "./ui";
import type { FiledArea } from "./useFiledModel";

type ShareFeature = MapFeature & { plan_color?: string | null; is_primary?: boolean | null };

type ColourMode = "status" | "coverage" | "plan";

const MODE_LABEL: Record<ColourMode, string> = {
  status: "Final status",
  coverage: "Photo coverage",
  plan: "Plan colours",
};

function points(f: ShareFeature): Array<{ lat: number; lng: number }> {
  if (f.kind === "pin") return [{ lat: f.geometry.lat, lng: f.geometry.lng }];
  if (f.kind === "rectangle") {
    const g = f.geometry;
    return [
      { lat: g.north, lng: g.west },
      { lat: g.north, lng: g.east },
      { lat: g.south, lng: g.east },
      { lat: g.south, lng: g.west },
    ];
  }
  return (f.geometry.paths ?? []) as Array<{ lat: number; lng: number }>;
}

/** Blue density ramp for the photo-coverage mode. */
function coverageColour(share: number): string {
  const stops = ["#DCE4F7", "#AFC1EF", "#7C97E2", "#4A6CD4", "#0B43D6"];
  return stops[Math.min(stops.length - 1, Math.max(0, Math.round(share * (stops.length - 1))))];
}

/** Tab 4 — where it all was. */
export function SiteMapTab({
  token,
  project,
  areas,
  provenance,
  onOpenAlbum,
  focusPoint,
  onFocusClear,
}: {
  token: string;
  project: ShareV2Project;
  areas: FiledArea[];
  provenance: ShareV2MapProvenance | null | undefined;
  onOpenAlbum: (areaId: string) => void;
  /** Pulsing marker for a photo located from a lightbox on another tab. */
  focusPoint?: { lat: number; lng: number; photoId: string; label?: string } | null;
  onFocusClear?: () => void;
}) {
  const [features, setFeatures] = useState<ShareFeature[] | null>(null);
  const [mode, setMode] = useState<ColourMode>("status");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("list_share_map_features" as never, { _token: token } as never);
      if (alive) setFeatures((data ?? []) as unknown as ShareFeature[]);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const letterOf = useMemo(() => new Map(areas.map((a) => [a.id, a.letter])), [areas]);
  const maxPhotos = Math.max(1, ...areas.map((a) => a.photo_count));

  const planColourByArea = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features ?? []) {
      if (f.plan_color && !m.has(f.area_id)) m.set(f.area_id, f.plan_color);
    }
    for (const a of areas) if (!m.get(a.id) && a.color) m.set(a.id, a.color);
    return m;
  }, [features, areas]);

  const hectaresByArea = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of features ?? []) {
      if (f.kind === "pin") continue;
      m.set(f.area_id, (m.get(f.area_id) ?? 0) + ringHectares(points(f)));
    }
    return m;
  }, [features]);

  const totalHa = [...hectaresByArea.values()].reduce((s, n) => s + n, 0);
  const mapped = areas.filter((a) => (features ?? []).some((f) => f.area_id === a.id));

  const colorFor = (areaId: string) => {
    const a = areas.find((x) => x.id === areaId);
    if (mode === "plan") return planColourByArea.get(areaId) ?? V2.muted;
    if (mode === "coverage") return coverageColour((a?.photo_count ?? 0) / maxPhotos);
    return statusHex(a?.latest_status ?? null);
  };

  const sel = areas.find((a) => a.id === selected) ?? null;

  return (
    <>
      <RuleLabel note={`${mapped.length} areas mapped · click an area to open its record`}>Site map</RuleLabel>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(Object.keys(MODE_LABEL) as ColourMode[]).map((m) => (
          <FlatButton key={m} active={mode === m} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </FlatButton>
        ))}
        <span className="ml-auto" style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
          {mode === "status"
            ? "Coloured by the area's status when the record was filed"
            : mode === "coverage"
              ? "Shaded by how many photographs each area holds"
              : "The operations team's own planning palette"}
        </span>
      </div>

      {token && (
        <ShareMapV2
          token={token}
          heightRatio="16 / 9"
          labelFor={(id) => letterOf.get(id) ?? ""}
          colorFor={colorFor}
          colorKey={mode}
          focusPoint={focusPoint}
          onFocusClear={onFocusClear}
          onAreaClick={(id) => setSelected(id)}
          areas={areas.map((a) => ({
            area_id: a.id,
            name: a.name,
            sort_order: a.sort_order,
            status: a.latest_status,
            notes: null,
          }))}
        />
      )}

      {sel && (
        <div className="mt-2 flex flex-wrap gap-3 p-3" style={{ border: `1px solid ${V2.ink}`, backgroundColor: V2.white }}>
          {sel.cover_photo_id && (
            <div style={{ width: 150 }}>
              <Thumb token={token} photoId={sel.cover_photo_id} alt={sel.name} ratio="4 / 3" />
            </div>
          )}
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center gap-2">
              <LetterChip letter={sel.letter} color={statusHex(sel.latest_status)} />
              <span style={{ fontSize: 16, fontWeight: 700, color: V2.ink }}>{sel.name}</span>
            </div>
            <div style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted, marginTop: 6, lineHeight: 1.7 }}>
              <div>
                Final status{" "}
                <span style={{ color: statusMeta(sel.latest_status).fg, fontWeight: 700 }}>
                  {statusMeta(sel.latest_status).label}
                </span>
              </div>
              <div>
                Photos <span style={{ color: V2.ink, fontWeight: 700 }}>{sel.photo_count}</span>
                {sel.rangeLabel ? ` · ${sel.rangeLabel}` : ""}
              </div>
              <div>
                Days with activity <span style={{ color: V2.ink, fontWeight: 700 }}>{sel.daysWithActivity}</span>
              </div>
              {hectaresByArea.get(sel.id) && (
                <div>
                  Footprint{" "}
                  <span style={{ color: V2.ink, fontWeight: 700 }}>
                    {hectaresByArea.get(sel.id)!.toFixed(2)} ha
                  </span>
                </div>
              )}
            </div>
            {sel.last_note && <p className="mt-2" style={{ fontSize: 13, color: V2.soft }}>{sel.last_note}</p>}
            <button
              type="button"
              onClick={() => onOpenAlbum(sel.id)}
              className="mt-2"
              style={{ fontSize: 13, fontWeight: 600, color: V2.ink, textDecoration: "underline" }}
            >
              Open album →
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted, alignSelf: "flex-start" }}
          >
            Close
          </button>
        </div>
      )}

      <RuleLabel className="mt-8" note="Matches the markers on the map">
        Area index
      </RuleLabel>
      <div style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white }}>
        {areas.map((a, i) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5"
            style={{ borderTop: i === 0 ? "none" : `1px solid ${V2.rule}` }}
          >
            <LetterChip letter={a.letter} color={statusHex(a.latest_status)} />
            <span style={{ fontSize: 14, fontWeight: 700, color: V2.ink, minWidth: 130 }}>{a.name}</span>
            <span style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted, minWidth: 66 }}>
              {hectaresByArea.get(a.id) ? `${hectaresByArea.get(a.id)!.toFixed(2)} ha` : "Not mapped"}
            </span>
            <span className="min-w-[160px] flex-1 truncate" style={{ fontSize: 13, color: V2.soft }}>
              {a.last_note ?? ""}
            </span>
            <span style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>{a.photo_count} photos</span>
            <button
              type="button"
              onClick={() => onOpenAlbum(a.id)}
              style={{ fontSize: 13, color: V2.ink, textDecoration: "underline" }}
            >
              Open album →
            </button>
          </div>
        ))}
      </div>

      <RuleLabel className="mt-8">Map provenance</RuleLabel>
      <div
        className="grid gap-4 p-3 sm:grid-cols-2 lg:grid-cols-4"
        style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
      >
        <Provenance label="Base imagery" value="Google satellite — imagery capture date not published" />
        <Provenance
          label="Site origin"
          value={
            project.geo_lat != null && project.geo_lng != null
              ? `${project.geo_lat.toFixed(4)}, ${project.geo_lng.toFixed(4)}`
              : "Not recorded"
          }
        />
        <Provenance
          label="Boundaries drawn"
          value={
            provenance?.first_drawn
              ? `${provenance.drawn_by ? `By ${provenance.drawn_by}, ` : ""}${fmtDayYear(
                  provenance.first_drawn.slice(0, 10)
                )}${provenance.last_edited ? ` · last edited ${fmtDayYear(provenance.last_edited.slice(0, 10))}` : ""}`
              : "No boundaries drawn"
          }
        />
        <Provenance
          label="Total footprint"
          value={totalHa > 0 ? `${totalHa.toFixed(2)} ha across ${hectaresByArea.size} areas` : "Not available"}
        />
      </div>
    </>
  );
}

function Provenance({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: V2.ink }}>{value}</div>
    </div>
  );
}
