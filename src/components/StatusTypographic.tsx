import { cn } from "@/lib/utils";
import type { AreaStatus } from "@/components/AreaStatusPicker";

/**
 * Phase 4c typographic status — replaces the rounded/filled pill.
 * Layout: dot + JetBrains Mono uppercase label + fixed grey caption.
 * Captions are a static lookup by status value — no schema changes.
 */

type StatusKey = AreaStatus | "behind_schedule" | "at_risk" | "delayed" | string;

const META: Record<string, { label: string; caption: string; color: string }> = {
  not_started:            { label: "No update",  caption: "Rest day / no activity", color: "#9C9A93" },
  in_progress:             { label: "On track",   caption: "Building, no news",      color: "#3A6EA5" },
  flagged:  { label: "Flagged",    caption: "Needs discussion",       color: "#D4A017" },
  delayed:              { label: "Delayed",    caption: "Behind programme",       color: "#C7382A" },
  behind_schedule:      { label: "Delayed",    caption: "Behind programme",       color: "#C7382A" },
  at_risk:              { label: "Delayed",    caption: "Behind programme",       color: "#C7382A" },
  delayed:              { label: "Delayed",    caption: "Behind programme",       color: "#C7382A" },
  complete:             { label: "Complete",   caption: "Nothing to discuss",     color: "#3A7D44" },
};

const CAPTION_INK = "#8A867C";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export function StatusTypographic({
  statusKey,
  showCaption = true,
  className,
  children,
}: {
  statusKey: StatusKey | null | undefined;
  showCaption?: boolean;
  className?: string;
  /** Optional trailing content (e.g. chevron for interactive triggers). */
  children?: React.ReactNode;
}) {
  if (!statusKey) return null;
  const meta = META[statusKey] ?? META.not_started;
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      aria-label={`Status: ${meta.label}`}
      title={meta.label}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      <span
        style={{
          fontFamily: MONO,
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: meta.color,
        }}
      >
        {meta.label}
      </span>
      {showCaption && (
        <span
          className="text-xs"
          style={{ color: CAPTION_INK }}
        >
          {meta.caption}
        </span>
      )}
      {children}
    </span>
  );
}
