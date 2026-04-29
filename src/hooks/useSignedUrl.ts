import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL_SECONDS = 60 * 60; // 1 hour

export async function getSignedUrl(path: string): Promise<string | null> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from("photos").createSignedUrl(path, TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  return data.signedUrl;
}

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    getSignedUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}
