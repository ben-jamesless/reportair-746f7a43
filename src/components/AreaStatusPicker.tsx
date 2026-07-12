import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";

export type AreaStatus = "no_status" | "on_track" | "requires_discussion" | "concern" | "complete";

export const STATUS_META: Record<
  AreaStatus,
  { label: string; short: string; dot: string; activeBg: string; activeText: string; activeBorder: string }
> = {
  no_status: {
    label: "None", short: "None",
    dot: "bg-[#9C9A93]",
    activeBg: "bg-muted", activeText: "text-foreground", activeBorder: "border-muted-foreground/30",
  },
  on_track: {
    label: "On track", short: "On track",
    dot: "bg-[#3A6EA5]",
    activeBg: "bg-[#3A6EA5]/15", activeText: "text-[#3A6EA5] dark:text-blue-300", activeBorder: "border-[#3A6EA5]/40",
  },
  requires_discussion: {
    label: "Flagged", short: "Flagged",
    dot: "bg-[#D4A017]",
    activeBg: "bg-[#D4A017]/15", activeText: "text-[#D4A017] dark:text-yellow-300", activeBorder: "border-[#D4A017]/40",
  },
  concern: {
    label: "Delayed", short: "Delayed",
    dot: "bg-[#C7382A]",
    activeBg: "bg-[#C7382A]/15", activeText: "text-[#C7382A] dark:text-red-300", activeBorder: "border-[#C7382A]/40",
  },
  complete: {
    label: "Complete", short: "Complete",
    dot: "bg-[#3A7D44]",
    activeBg: "bg-[#3A7D44]/15", activeText: "text-[#3A7D44] dark:text-emerald-300", activeBorder: "border-[#3A7D44]/40",
  },
};

const ORDER: AreaStatus[] = ["no_status", "on_track", "requires_discussion", "concern", "complete"];

interface Props {
  value: AreaStatus;
  onChange: (next: AreaStatus) => void;
  className?: string;
  readOnly?: boolean;
}

export const AreaStatusDot = ({ status, className }: { status: AreaStatus; className?: string }) => (
  <span
    aria-label={STATUS_META[status].label}
    title={STATUS_META[status].label}
    className={cn("inline-block h-2 w-2 rounded-full", STATUS_META[status].dot, className)}
  />
);

/** Dot + uppercase typographic status; opens a popover to change when interactive. */
export const AreaStatusPicker = ({ value, onChange, className, readOnly = false }: Props) => {
  if (readOnly) {
    return (
      <StatusTypographic statusKey={value} className={className} />
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={cn(
            "inline-flex items-center rounded-sm transition-colors hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <StatusTypographic statusKey={value}>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </StatusTypographic>
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
