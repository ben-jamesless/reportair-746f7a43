import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SignedUrlTransform = {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
};

export const THUMB_TRANSFORM: SignedUrlTransform = { width: 600, height: 600, resize: "cover", quality: 75 };
export const LIGHTBOX_TRANSFORM: SignedUrlTransform = { width: 2400, resize: "contain", quality: 82 };

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 60 * 60; // 1 hour
// If less than this remains on a cached URL, treat as stale and refetch.
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const cacheKey = (path: string, transform?: SignedUrlTransform) =>
  transform ? `${path}::${transform.width ?? ""}x${transform.height ?? ""}:${transform.resize ?? ""}:${transform.quality ?? ""}` : path;

// Per-key subscribers, so when we refresh on tab focus all mounted thumbs update.
const subscribers = new Map<string, Set<(url: string | null) => void>>();
const subscribe = (key: string, fn: (u: string | null) => void) => {
  let set = subscribers.get(key);
  if (!set) { set = new Set(); subscribers.set(key, set); }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) subscribers.delete(key);
  };
};
const notify = (key: string, url: string | null) => {
  subscribers.get(key)?.forEach((fn) => fn(url));
};

const isFresh = (e: Entry | undefined): e is Entry =>
  !!e && e.expiresAt > Date.now() + REFRESH_THRESHOLD_MS;

async function fetchSignedUrl(path: string, transform?: SignedUrlTransform): Promise<string | null> {
  const key = cacheKey(path, transform);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const opts = transform ? { transform } : undefined;
    const { data, error } = await supabase.storage
      .from("photos")
      .createSignedUrl(path, TTL_SECONDS, opts as { transform?: SignedUrlTransform } | undefined);
    if (error || !data?.signedUrl) return null;
    cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    notify(key, data.signedUrl);
    return data.signedUrl;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function getSignedUrl(path: string, transform?: SignedUrlTransform): Promise<string | null> {
  const cached = cache.get(cacheKey(path, transform));
  if (isFresh(cached)) return cached.url;
  return fetchSignedUrl(path, transform);
}

/** Force-refresh all currently-tracked signed URLs (e.g. on tab focus). */
export function refreshAllSignedUrls() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt - now < REFRESH_THRESHOLD_MS * 2) {
      const path = key.split("::")[0];
      // Reconstruct transform from key suffix
      const suffix = key.slice(path.length + 2);
      let transform: SignedUrlTransform | undefined;
      if (suffix) {
        const [wh, resize, quality] = suffix.split(":");
        const [w, h] = wh.split("x");
        transform = {
          width: w ? Number(w) : undefined,
          height: h ? Number(h) : undefined,
          resize: (resize || undefined) as SignedUrlTransform["resize"],
          quality: quality ? Number(quality) : undefined,
        };
      }
      cache.delete(key);
      if (subscribers.has(key)) fetchSignedUrl(path, transform);
    }
  }
}

let listenersInstalled = false;
function installFocusListeners() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  const onFocus = () => refreshAllSignedUrls();
  const onVisibility = () => { if (document.visibilityState === "visible") refreshAllSignedUrls(); };
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
}

export function useSignedUrl(path: string | null | undefined, transform?: SignedUrlTransform) {
  const key = path ? cacheKey(path, transform) : null;
  const [url, setUrl] = useState<string | null>(() => {
    if (!key) return null;
    const c = cache.get(key);
    return isFresh(c) ? c.url : null;
  });

  useEffect(() => {
    installFocusListeners();
    if (!path || !key) { setUrl(null); return; }
    let cancelled = false;
    const cached = cache.get(key);
    if (isFresh(cached)) setUrl(cached.url);
    else fetchSignedUrl(path, transform).then((u) => { if (!cancelled) setUrl(u); });
    const unsub = subscribe(key, (u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);

  return url;
}

export function useThumbSignedUrl(path: string | null | undefined) {
  return useSignedUrl(path, THUMB_TRANSFORM);
}

export function useLightboxSignedUrl(path: string | null | undefined) {
  return useSignedUrl(path, LIGHTBOX_TRANSFORM);
}

export function clearSignedUrlCache(): void {
  cache.clear();
  inflight.clear();
}
