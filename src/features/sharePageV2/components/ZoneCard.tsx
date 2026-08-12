import { RichNotes } from "@/components/RichNotes";
import { V2, timeLabel } from "../tokens";
import type { ShareV2Photo } from "../types";
import { StatusPill } from "./Primitives";
import { useSharePhotoUrl } from "../useSharePhotoUrl";

function PhotoCell({ token, photo, onOpen }: { token: string; photo: ShareV2Photo; onOpen: () => void }) {
  const url = useSharePhotoUrl(token, photo.id, "thumb");
  const t = timeLabel(photo.captured_at);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative overflow-hidden"
      style={{ aspectRatio: "4 / 3", borderRadius: 3, backgroundColor: V2.rule }}
    >
      {url && (
        <img
          src={url}
          alt={photo.caption || photo.file_name}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      {t && (
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
          {t}
        </span>
      )}
    </button>
  );
}

export function ZoneCard({
  token,
  name,
  status,
  notes,
  photos,
  onOpenPhoto,
  isToday = true,
}: {
  token: string;
  name: string;
  /** Derived display status (never null in practice). */
  status: string | null;
  notes: string | null;
  photos: ShareV2Photo[];
  onOpenPhoto: (photoId: string) => void;
  isToday?: boolean;
}) {
  const inactive = normaliseStatus(status) === "not_started" && !notes && photos.length === 0;
  const dayWord = isToday ? "today" : "this day";
  return (
    <article className="py-[18px]" style={{ borderTop: `1px solid ${V2.rule}`, opacity: inactive ? 0.55 : 1 }}>
      <div className="mb-2.5 flex items-center gap-2.5">
        <h3 className="flex-1" style={{ fontSize: 15, fontWeight: 700, color: V2.ink }}>
          {name}
        </h3>
        <StatusPill status={status} noUpdate={inactive} />
      </div>
      {notes ? (
        <div className="mb-3" style={{ fontSize: 13.5, color: V2.soft, lineHeight: 1.65 }}>
          <RichNotes value={notes} />
        </div>
      ) : (
        <p className="mb-3" style={{ fontSize: 13, color: V2.muted }}>
          {photos.length > 0
            ? `${photos.length} photo${photos.length === 1 ? "" : "s"} captured — no written update.`
            : `No update recorded for this area ${dayWord}.`}
        </p>
      )}
      {photos.length > 0 && (
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
          {photos.map((p) => (
            <PhotoCell key={p.id} token={token} photo={p} onOpen={() => onOpenPhoto(p.id)} />
          ))}
        </div>
      )}
    </article>
  );
}
