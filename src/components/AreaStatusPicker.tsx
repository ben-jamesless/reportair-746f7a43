import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";

export type AreaStatus = "no_status" | "on_track" | "requires_discussion" | "concern" | "complete";

export const STATUS_META: Record<
  AreaStatus,
  { label: string; short: string; dot: string; activeBg: string; activeText: string; activeBorder: string }
> = {
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
  complete: {
    label: "Complete", short: "Complete",
    dot: "bg-primary",
    activeBg: "bg-primary/15", activeText: "text-primary", activeBorder: "border-primary",
  },
};

const ORDER: AreaStatus[] = ["no_status", "on_track", "requires_discussion", "concern", "complete"];

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

/** Single active status pill that opens a popover to change the status. */
export const AreaStatusPicker = ({ value, onChange, className }: Props) => {
  const meta = STATUS_META[value];
  return (
    <Popover>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={`Status: ${meta.label}`}
          title={meta.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            meta.activeBg,
            meta.activeText,
            meta.activeBorder,
            className,
          )}
        >
          <span className={cn("inline-block h-2 w-2 rounded-full", meta.dot)} />
          <span>{meta.short}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <ul role="listbox" aria-label="Area status">
          {ORDER.map((s) => {
            const m = STATUS_META[s];
            const active = s === value;
            return (
              <li key={s}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={(e) => { e.stopPropagation(); onChange(s); }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                    active ? cn(m.activeBg, m.activeText) : "hover:bg-secondary",
                  )}
                >
                  <span className={cn("inline-block h-2 w-2 rounded-full", m.dot)} />
                  <span className="flex-1">{m.short}</span>
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
