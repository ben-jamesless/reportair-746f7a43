import { V2 } from "../tokens";
import { useSharePhotoUrl } from "../useSharePhotoUrl";

/**
 * A photo tile. Deliberately carries no overlaid text: per-thumbnail
 * timestamps were the single largest source of visual noise on the filed
 * record, so time now lives in the visit header and the lightbox only.
 */
export function Thumb({
  token,
  photoId,
  alt,
  onClick,
  ratio = "4 / 3",
}: {
  token: string;
  photoId: string;
  alt: string;
  onClick?: () => void;
  ratio?: string;
}) {
  const url = useSharePhotoUrl(token, photoId, "thumb");
  const inner = url ? (
    <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" decoding="async" />
  ) : null;
  const style: React.CSSProperties = { aspectRatio: ratio, backgroundColor: V2.paperDim, overflow: "hidden" };
  if (!onClick) return <div style={style}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} style={{ ...style, cursor: "pointer", padding: 0, border: "none" }}>
      {inner}
    </button>
  );
}
