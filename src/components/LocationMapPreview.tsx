import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

interface Props {
  lat: number;
  lng: number;
  className?: string;
}

// Small static-ish map preview. Uses google.maps.Map (no mapId) + Marker so
// no Cloud console setup is needed. Re-centers on prop change.
export function LocationMapPreview({ lat, lng, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        const center = { lat, lng };
        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(containerRef.current, {
            center,
            zoom: 14,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "cooperative",
            clickableIcons: false,
          });
        } else {
          mapRef.current.setCenter(center);
        }
        if (!markerRef.current) {
          markerRef.current = new g.maps.Marker({ position: center, map: mapRef.current });
        } else {
          markerRef.current.setPosition(center);
        }
      })
      .catch((e) => console.warn("Map preview unavailable:", e));
    return () => { cancelled = true; };
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-48 w-full overflow-hidden rounded-md border bg-muted/40"}
      aria-label="Event location map"
    />
  );
}
