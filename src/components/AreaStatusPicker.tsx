import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type AreaStatus = "no_status" | "on_track" | "requires_discussion" | "concern";

export const STATUS_META: Record<AreaStatus, { label: string; dot: string; ring: string }> = {
  no_status:           { label: "No status",            dot: "bg-muted-foreground/40", ring: "ring-muted-foreground/40" },
  on_track:            { label: "On track",             dot: "bg-blue-500",            ring: "ring-blue-500" },
  requires_discussion: { label: "Requires discussion",  dot: "bg-orange-500",          ring: "ring-orange-500" },
  concern:             { label: "Concern / behind",     dot: "bg-red-500",             ring: "ring-red-500" },
};

const ORDER: AreaStatus[] = ["no_status", "on_track", "requires_discussion", "concern"];

interface Props {
  value: AreaStatus;
  onChange: (next: AreaStatus) => void;
  size?: "sm" | "md";
}

export const AreaStatusDot = ({ status, className }: { status: AreaStatus; className?: string }) => (
  <span
    aria-label={STATUS_META[status].label}
    title={STATUS_META[status].label}
    className={cn("inline-block h-2 w-2 rounded-full", STATUS_META[status].dot, className)}
  />
);

export const AreaStatusPicker = ({ value, onChange, size = "sm" }: Props) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Status: ${STATUS_META[value].label}`}
          title={`Status: ${STATUS_META[value].label} — click to change`}
          className={cn(
            "shrink-0 rounded-full transition-shadow hover:ring-2",
            size === "sm" ? "p-0.5" : "p-1",
            STATUS_META[value].ring,
          )}
        >
          <AreaStatusDot status={value} className={size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Area status
        </div>
        {ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(s); }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary",
              value === s && "bg-secondary",
            )}
          >
            <AreaStatusDot status={s} />
            <span className="flex-1">{STATUS_META[s].label}</span>
            {value === s && <Check className="h-3 w-3" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
