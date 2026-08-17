import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { V2, STATUS_SEVERITY, normaliseStatus, timeLabel } from "../tokens";
import type { ShareV2AreaMeta, ShareV2Photo } from "../types";
import { SectionLabel, StatusPill } from "./Primitives";
import { useSharePhotoUrl } from "../useSharePhotoUrl";
import { ShareLightboxV2 } from "./ShareLightboxV2";

/** Full-bleed hero for the Filed view — explicit pick, else server auto-pick. */
export function FiledHero({
  token,
  photoId,
  projectName,
}: {
  token: string;
  photoId: string | null;
  projectName: string;
}) {
  const url = useSharePhotoUrl(token, photoId ?? "", "lightbox");
  if (!photoId) return null;
  return (
    <div
      className="mb-8 overflow-hidden"
      style={{ backgroundColor: V2.paperDim, borderRadius: V2.radiusReport, aspectRatio: "16 / 9" }}
    >
      {url && (
        <img
          src={url}
          alt={`${projectName} — event record`}
          className="h-full w-full object-cover"
          decoding="async"
        />
      )}
    </div>
  );
}

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

function AreaCard({
  token,
  area,
  onOpen,
}: {
  token: string;
  area: ShareV2AreaMeta;
  onOpen?: (areaId: string) => void;
}) {
  const url = useSharePhotoUrl(token, area.cover_photo_id ?? "", "thumb");
  const interactive = !!onOpen;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onOpen?.(area.id) : undefined}
      className="overflow-hidden text-left"
      style={{
        border: `1px solid ${V2.rule}`,
        backgroundColor: V2.white,
        borderRadius: V2.radiusReport,
        cursor: interactive ? "pointer" : "default",
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
        <span style={{ fontFamily: V2.mono, fontSize: 10.5, letterSpacing: "0.06em", color: V2.muted }}>
          {area.photo_count} PHOTO{area.photo_count === 1 ? "" : "S"}
        </span>
      </div>
    </div>
  );
}

/** Areas grid — severity descending, then most-photographed, then name. */
export function FiledAreasGrid({
  token,
  areas,
  onOpenArea,
}: {
  token: string;
  areas: ShareV2AreaMeta[];
  onOpenArea?: (areaId: string) => void;
}) {
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
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {sorted.map((a) => (
        <AreaCard key={a.id} token={token} area={a} onOpen={onOpenArea} />
      ))}
    </div>
  );
}

export { SectionLabel };
