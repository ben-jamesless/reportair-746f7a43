import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { V2, STATUS_SEVERITY, normaliseStatus, timeLabel } from "../tokens";
import type { ShareV2AreaMeta, ShareV2Photo } from "../types";
import { SectionLabel, StatusPill } from "./Primitives";
import { useSharePhotoUrl } from "../useSharePhotoUrl";
import { ShareLightboxV2 } from "./ShareLightboxV2";

/**
 * The single most editorial piece of copy on the Filed view: no card, no
 * heading — just a large soft-ink paragraph sitting between hero and map.
 */
export function EventSummary({ text }: { text: string | null | undefined }) {
  if (!text?.trim()) return null;
  return (
    <div className="mb-9">
      {text
        .split(/\n{2,}/)
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para, i) => (
          <p
            key={i}
            className="mb-4 last:mb-0"
            style={{ fontSize: 19, lineHeight: 1.62, color: V2.soft, maxWidth: "62ch" }}
          >
            {para}
          </p>
        ))}
    </div>
  );
}

function AreaThumb({ token, photoId, alt }: { token: string; photoId: string; alt: string }) {
  const url = useSharePhotoUrl(token, photoId, "thumb");
  return url ? <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null;
}

function AreaCard({
  token,
  area,
  expanded,
  onToggle,
}: {
  token: string;
  area: ShareV2AreaMeta;
  expanded: boolean;
  onToggle: () => void;
}) {
  const url = useSharePhotoUrl(token, area.cover_photo_id ?? "", "thumb");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="overflow-hidden text-left"
      style={{
        border: `1px solid ${expanded ? V2.ink : V2.rule}`,
        backgroundColor: V2.white,
        borderRadius: V2.radiusReport,
      }}
    >
      <div style={{ aspectRatio: "4 / 3", backgroundColor: V2.paperDim }}>
        {area.cover_photo_id && url && (
          <img src={url} alt={area.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        )}
      </div>
      <div style={{ padding: "11px 13px 13px" }}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <span style={{ fontSize: 14, fontWeight: 700, color: V2.ink, lineHeight: 1.3 }}>{area.name}</span>
          <StatusPill status={area.latest_status} small />
        </div>
        <span className="flex items-center justify-between">
          <span style={{ fontFamily: V2.mono, fontSize: 10.5, letterSpacing: "0.06em", color: V2.muted }}>
            {area.photo_count} PHOTO{area.photo_count === 1 ? "" : "S"}
          </span>
          <ChevronDown
            className="h-4 w-4 transition-transform"
            style={{ color: V2.muted, transform: expanded ? "rotate(180deg)" : "none" }}
          />
        </span>
      </div>
    </button>
  );
}

/** The full photo set for one area, fetched on demand from share_area. */
function AreaGallery({ token, area }: { token: string; area: ShareV2AreaMeta }) {
  const [photos, setPhotos] = useState<ShareV2Photo[] | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setPhotos(null);
    (async () => {
      const { data } = await supabase.rpc("share_area" as never, {
        _token: token,
        _area_id: area.id,
      } as never);
      const res = data as { ok?: boolean; photos?: ShareV2Photo[] } | null;
      if (alive) setPhotos(res?.ok ? res.photos ?? [] : []);
    })();
    return () => {
      alive = false;
    };
  }, [token, area.id]);

  return (
    <div
      className="mt-2"
      style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport, backgroundColor: V2.white, padding: 10 }}
    >
      <div
        className="mb-2 uppercase"
        style={{ fontFamily: V2.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: V2.soft }}
      >
        {area.name} · {photos ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : "loading…"}
      </div>
      {photos && photos.length === 0 && (
        <p style={{ fontSize: 12.5, color: V2.muted }}>No photos recorded for this area.</p>
      )}
      {photos && photos.length > 0 && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              className="relative overflow-hidden"
              style={{ aspectRatio: "4 / 3", backgroundColor: V2.rule, borderRadius: 3 }}
            >
              <AreaThumb token={token} photoId={p.id} alt={p.caption || p.file_name} />
              {timeLabel(p.captured_at) && (
                <span
                  className="absolute"
                  style={{
                    bottom: 4,
                    right: 5,
                    fontFamily: V2.mono,
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#fff",
                    background: "rgba(15,21,32,.68)",
                    padding: "1px 5px",
                    borderRadius: 2,
                  }}
                >
                  {timeLabel(p.captured_at)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {index !== null && photos && (
        <ShareLightboxV2
          token={token}
          photos={photos}
          index={index}
          onClose={() => setIndex(null)}
          onIndexChange={setIndex}
        />
      )}
    </div>
  );
}

/** Areas grid — severity descending, then most-photographed, then name. */
export function FiledAreasGrid({ token, areas }: { token: string; areas: ShareV2AreaMeta[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (areas.length === 0) {
    return <p style={{ fontSize: 13, color: V2.muted }}>No areas were defined for this event.</p>;
  }
  const sorted = [...areas].sort((a, b) => {
    const sa = STATUS_SEVERITY[normaliseStatus(a.latest_status)];
    const sb = STATUS_SEVERITY[normaliseStatus(b.latest_status)];
    if (sa !== sb) return sb - sa;
    if (a.photo_count !== b.photo_count) return b.photo_count - a.photo_count;
    return a.name.localeCompare(b.name);
  });
  const open = sorted.find((a) => a.id === openId) ?? null;
  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {sorted.map((a) => (
          <AreaCard
            key={a.id}
            token={token}
            area={a}
            expanded={a.id === openId}
            onToggle={() => setOpenId((v) => (v === a.id ? null : a.id))}
          />
        ))}
      </div>
      {open && <AreaGallery key={open.id} token={token} area={open} />}
    </>
  );
}

export { SectionLabel };
