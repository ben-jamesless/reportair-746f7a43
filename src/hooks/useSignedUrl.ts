import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 60 * 60; // 1 hour
// If less than this remains on a cached URL, treat as stale and refetch.
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Per-path subscribers, so when we refresh on tab focus all mounted thumbs update.
const subscribers = new Map<string, Set<(url: string | null) => void>>();
const subscribe = (path: string, fn: (u: string | null) => void) => {
  let set = subscribers.get(path);
  if (!set) { set = new Set(); subscribers.set(path, set); }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) subscribers.delete(path);
  };
};
const notify = (path: string, url: string | null) => {
  subscribers.get(path)?.forEach((fn) => fn(url));
};

const isFresh = (e: Entry | undefined): e is Entry =>
  !!e && e.expiresAt > Date.now() + REFRESH_THRESHOLD_MS;

async function fetchSignedUrl(path: string): Promise<string | null> {
  const existing = inflight.get(path);
  if (existing) return existing;
  const p = (async () => {
    const { data, error } = await supabase.storage.from("photos").createSignedUrl(path, TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    notify(path, data.signedUrl);
    return data.signedUrl;
  })().finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const cached = cache.get(path);
  if (isFresh(cached)) return cached.url;
  return fetchSignedUrl(path);
}

/** Force-refresh all currently-tracked signed URLs (e.g. on tab focus). */
export function refreshAllSignedUrls() {
  const now = Date.now();
  for (const [path, entry] of cache.entries()) {
    // Only refresh entries near expiry; skip ones still very fresh.
    if (entry.expiresAt - now < REFRESH_THRESHOLD_MS * 2) {
      cache.delete(path);
      // Trigger refetch only if some component still wants it.
      if (subscribers.has(path)) fetchSignedUrl(path);
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

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    const c = cache.get(path);
    return isFresh(c) ? c.url : null;
  });

  useEffect(() => {
    installFocusListeners();
    if (!path) { setUrl(null); return; }
    let cancelled = false;
    const cached = cache.get(path);
    if (isFresh(cached)) setUrl(cached.url);
    else fetchSignedUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    const unsub = subscribe(path, (u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; unsub(); };
  }, [path]);

  return url;
}
