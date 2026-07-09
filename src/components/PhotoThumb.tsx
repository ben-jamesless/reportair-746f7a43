import { useEffect, useRef, useState } from "react";
import { useThumbSignedUrl } from "@/hooks/useSignedUrl";
import { Check, ImageIcon, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  path: string;
  alt: string;
  onClick?: () => void;
  /** Render priority — if true, loads eagerly (e.g. above-the-fold). Default: lazy via IntersectionObserver. */
  priority?: boolean;
  /** When true, shows a checkbox overlay (always visible if selected, on hover otherwise). */
  selectable?: boolean;
  /** Whether this photo is currently selected. */
  selected?: boolean;
  /** Show a small map-pin badge indicating the photo was auto-assigned to a zone by GPS. */
  gpsAuto?: boolean;
}

/**
 * Performant photo thumbnail.
 * - Defers fetching the signed URL until the thumb is near the viewport.
 * - Uses native `loading="lazy"` + `decoding="async"` on the <img>.
 * - Shows a soft animated placeholder until the bitmap finishes decoding,
 *   then fades in (blurhash-style behaviour without requiring a hash payload).
 */
export const PhotoThumb = ({ path, alt, onClick, priority = false, selectable = false, selected = false, gpsAuto = false }: Props) => {

  const ref = useRef<HTMLButtonElement | null>(null);
  const [inView, setInView] = useState(priority);
  const [loaded, setLoaded] = useState(false);

  // Only request a signed URL once we're near the viewport.
  const url = useThumbSignedUrl(inView ? path : null);

  useEffect(() => {
    if (priority || inView) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setInView(true); io.disconnect(); break; }
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [inView, priority]);

  // If the path changes (e.g. photo reordered), reset the loaded state.
  useEffect(() => { setLoaded(false); }, [path]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={alt}
      aria-pressed={selectable ? selected : undefined}
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-md bg-muted ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectable && selected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      {/* Animated LQIP placeholder — visible until the image decodes. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-muted via-muted/60 to-muted animate-pulse transition-opacity duration-500",
          loaded && url ? "opacity-0" : "opacity-100",
        )}
      />
      {url ? (
        <img
          src={url}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          // React 18 warns on the camelCase `fetchPriority` JSX prop; pass it
          // through as the lowercase HTML attribute via a spread so it lands
          // on the DOM correctly without triggering the warning.
          {...({ fetchpriority: priority ? "high" : "low" } as Record<string, string>)}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
          className={cn(
            "relative h-full w-full object-cover transition-all duration-500 group-hover:scale-105",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        !inView ? null : (
          <div className="relative flex h-full w-full items-center justify-center text-muted-foreground/60">
            <ImageIcon className="h-6 w-6" />
          </div>
        )
      )}
      {selectable && (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 bg-primary/10 transition-opacity",
              selected ? "opacity-100" : "opacity-0",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
              selected
                ? "border-primary bg-primary text-primary-foreground opacity-100"
                : "border-white/80 bg-black/40 text-transparent opacity-0 group-hover:opacity-100",
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        </>
      )}
      {gpsAuto && (
        <span
          aria-label="Auto-assigned by GPS"
          title="Auto-assigned by GPS"
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white shadow-sm"
        >
          <MapPin className="h-3 w-3" />
        </span>
      )}
    </button>
  );
};

