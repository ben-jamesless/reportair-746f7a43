import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSharePassword } from "../sharePassword";
import { V2 } from "../tokens";
import { StatusPill } from "../components/Primitives";
import { ShareLightboxV2 } from "../components/ShareLightboxV2";
import type { ShareV2Photo } from "../types";
import { Thumb } from "./Thumb";
import { FlatButton, MONO_LABEL, RuleLabel } from "./ui";
import { groupIntoVisits, visitHeader, type FiledArea } from "./useFiledModel";

/** Two rows of the widest album grid. */
const GROUP_CAP = 10;

function AlbumCard({
  token,
  area,
  onOpen,
}: {
  token: string;
  area: FiledArea;
  onOpen: () => void;
}) {
  return (
    <div style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white }}>
      {area.cover_photo_id ? (
        <Thumb token={token} photoId={area.cover_photo_id} alt={area.name} onClick={onOpen} ratio="16 / 10" />
      ) : (
        <div style={{ aspectRatio: "16 / 10", backgroundColor: V2.paperDim }} />
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: V2.ink }}>{area.name}</div>
        <div style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted, marginTop: 4 }}>
          {area.photo_count} photos{area.rangeLabel ? ` · ${area.rangeLabel}` : ""}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <StatusPill status={area.latest_status} small />
          <button
            type="button"
            onClick={onOpen}
            style={{ fontSize: 13, fontWeight: 600, color: V2.ink, textDecoration: "underline" }}
          >
            Open album →
          </button>
        </div>
      </div>
    </div>
  );
}

/** The full photographic record for one area, grouped into capture visits. */
function Album({ token, area, onClose, onShowOnMap }: { token: string; area: FiledArea; onClose: () => void; onShowOnMap?: (photo: ShareV2Photo) => void }) {
  const [photos, setPhotos] = useState<ShareV2Photo[] | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<{ photos: ShareV2Photo[]; index: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setPhotos(null);
    setExpanded({});
    (async () => {
      const { data } = await supabase.rpc("share_area" as never, { _token: token, _password: getSharePassword(), _area_id: area.id } as never);
      const res = data as { ok?: boolean; photos?: ShareV2Photo[] } | null;
      if (alive) setPhotos(res?.ok ? res.photos ?? [] : []);
    })();
    return () => {
      alive = false;
    };
  }, [token, area.id]);

  const visits = useMemo(() => (photos ? groupIntoVisits(photos, newestFirst) : []), [photos, newestFirst]);

  return (
    <div id="album" style={{ border: `1px solid ${V2.ink}`, backgroundColor: V2.white, scrollMarginTop: 12 }}>
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3"
        style={{ borderBottom: `1px solid ${V2.rule}` }}
      >
        <div className="min-w-0 flex-1">
          <div style={{ fontSize: 19, fontWeight: 700, color: V2.ink }}>{area.name}</div>
          <div style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted, marginTop: 3 }}>
            {area.photo_count} photos{area.rangeLabel ? ` · ${area.rangeLabel}` : ""} · {area.daysWithActivity} days
            with activity
          </div>
        </div>
        <FlatButton onClick={() => setNewestFirst((v) => !v)}>
          {newestFirst ? "Newest first" : "Oldest first"}
        </FlatButton>
        <FlatButton onClick={onClose}>Close album</FlatButton>
      </div>

      <p className="px-4 pt-3" style={{ fontSize: 13, color: V2.soft }}>
        Photos are grouped into the visits they were taken on. Each group is one walk of the area.
      </p>

      {photos === null && (
        <p className="px-4 py-6" style={{ ...MONO_LABEL, color: V2.muted }}>
          Loading album…
        </p>
      )}
      {photos?.length === 0 && (
        <p className="px-4 py-6" style={{ fontSize: 13, color: V2.muted }}>
          No photos were recorded in this area.
        </p>
      )}

      {visits.map((v) => {
        const head = visitHeader(v);
        const open = expanded[v.key];
        const shown = open ? v.photos : v.photos.slice(0, GROUP_CAP);
        const rest = v.photos.length - shown.length;
        return (
          <section key={v.key} className="px-4 pb-4 pt-4" style={{ borderTop: `1px solid ${V2.rule}` }}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span style={{ fontFamily: V2.mono, fontSize: 12, fontWeight: 700, color: V2.ink }}>
                {head.date.toUpperCase()}
              </span>
              <span style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>{head.detail}</span>
              <span className="ml-auto" style={{ ...MONO_LABEL, fontWeight: 400, color: V2.muted }}>
                {v.photos.length} photos
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {shown.map((p) => (
                <Thumb
                  key={p.id}
                  token={token}
                  photoId={p.id}
                  alt={p.caption || p.file_name}
                  onClick={() => setLightbox({ photos: v.photos, index: v.photos.indexOf(p) })}
                />
              ))}
            </div>
            {rest > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [v.key]: true }))}
                className="mt-1.5 w-full py-2"
                style={{ border: `1px solid ${V2.rule}`, fontSize: 13, color: V2.ink, backgroundColor: V2.paperDim }}
              >
                Show the remaining {rest} photos from this visit
              </button>
            )}
          </section>
        );
      })}

      {lightbox && (
        <ShareLightboxV2
          token={token}
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
          onShowOnMap={onShowOnMap}
        />
      )}
    </div>
  );
}

/** Tab 3 — the photographic record in full. */
export function AreasTab({
  token,
  areas,
  openAreaId,
  onOpenArea,
  onShowOnMap,
}: {
  token: string;
  areas: FiledArea[];
  openAreaId: string | null;
  onOpenArea: (id: string | null) => void;
  onShowOnMap?: (photo: ShareV2Photo) => void;
}) {
  const open = areas.find((a) => a.id === openAreaId) ?? null;
  const albumRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const el = albumRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open?.id]);

  return (
    <>
      <RuleLabel note={`${areas.length} albums`}>Albums</RuleLabel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((a) => (
          <AlbumCard key={a.id} token={token} area={a} onOpen={() => onOpenArea(a.id)} />
        ))}
      </div>
      {areas.length === 0 && (
        <p style={{ fontSize: 13, color: V2.muted }}>No areas were defined for this event.</p>
      )}
      {open && (
        <div className="mt-8" ref={albumRef} style={{ scrollMarginTop: 12 }}>
          <Album key={open.id} token={token} area={open} onClose={() => onOpenArea(null)} onShowOnMap={onShowOnMap} />
        </div>
      )}
    </>
  );
}
