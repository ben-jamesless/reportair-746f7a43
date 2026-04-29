import { cn } from "@/lib/utils";

export type AreaStatus = "no_status" | "on_track" | "requires_discussion" | "concern";

export const STATUS_META: Record<AreaStatus, { label: string; short: string; dot: string; activeBg: string; activeText: string; activeBorder: string }> = {
  no_status: {
    label: "No status", short: "No Status",
    dot: "bg-muted-foreground/40",
    activeBg: "bg-muted", activeText: "text-foreground", activeBorder: "border-muted-foreground/30",
  },
  on_track: {
    label: "On track", short: "On Track",
    dot: "bg-blue-500",
    activeBg: "bg-blue-500/15", activeText: "text-blue-700 dark:text-blue-300", activeBorder: "border-blue-500",
  },
  requires_discussion: {
    label: "Requires discussion", short: "Requires Discussion",
    dot: "bg-orange-500",
    activeBg: "bg-orange-500/15", activeText: "text-orange-700 dark:text-orange-300", activeBorder: "border-orange-500",
  },
  concern: {
    label: "Concern / behind schedule", short: "Concern / Behind Schedule",
    dot: "bg-red-500",
    activeBg: "bg-red-500/15", activeText: "text-red-700 dark:text-red-300", activeBorder: "border-red-500",
  },
};

const ORDER: AreaStatus[] = ["no_status", "on_track", "requires_discussion", "concern"];

interface Props {
  value: AreaStatus;
  onChange: (next: AreaStatus) => void;
  className?: string;
}

export const AreaStatusDot = ({ status, className }: { status: AreaStatus; className?: string }) => (
  <span
    aria-label={STATUS_META[status].label}
    title={STATUS_META[status].label}
    className={cn("inline-block h-2 w-2 rounded-full", STATUS_META[status].dot, className)}
  />
);

export const AreaStatusPicker = ({ value, onChange, className }: Props) => {
  return (
    <div
      role="radiogroup"
      aria-label="Area status"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/50 p-1",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {ORDER.map((s) => {
        const meta = STATUS_META[s];
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={(e) => { e.stopPropagation(); onChange(s); }}
            title={meta.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium border transition-colors",
              active
                ? cn(meta.activeBg, meta.activeText, meta.activeBorder)
                : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <span className={cn("inline-block h-2 w-2 rounded-full", meta.dot)} />
            <span>{meta.short}</span>
          </button>
        );
      })}
    </div>
  );
};
