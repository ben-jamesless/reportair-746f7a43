import { useEffect, useState } from "react";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-photo-url`;

const cache = new Map<string, string>();

/** Signed URL for a share photo, via the public edge function (bucket stays private). */
export function useSharePhotoUrl(
  token: string,
  photoId: string,
  variant: "thumb" | "lightbox" | "original" = "thumb"
) {
  const key = `${token}|${photoId}|${variant}`;
  const [url, setUrl] = useState<string | null>(cache.get(key) ?? null);

  useEffect(() => {
    const hit = cache.get(key);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(FN_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, photo_id: photoId, variant }),
        });
        const json = await res.json();
        if (alive && typeof json?.url === "string") {
          cache.set(key, json.url);
          setUrl(json.url);
        }
      } catch {
        /* leave placeholder */
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, token, photoId, variant]);

  return url;
}
