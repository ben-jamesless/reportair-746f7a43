import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** Shared, theme-aware presentation for event settings and delivery panels. */
export const T = {
  paper: "hsl(var(--background))",
  paper2: "hsl(var(--secondary))",
  ink: "hsl(var(--foreground))",
  ink2: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  rule: "hsl(var(--border))",
  bar: "hsl(var(--section-header))",
  white: "hsl(var(--card))",
} as const;
export const STATUS = {
  blue: "hsl(var(--progress-in-progress))",
  amber: "hsl(var(--progress-flagged))",
  red: "hsl(var(--progress-delayed))",
  green: "hsl(var(--progress-complete))",
  grey: "hsl(var(--progress-not-started))",
} as const;
export const MONO = "'Inter Variable', Inter, system-ui, sans-serif";

export function PanelBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background px-6 py-4 pr-14">
      <span className="text-base font-semibold text-foreground">{title}</span>
      {right}
    </div>
  );
}
export function SectionLabel({ children, className, right }: { children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={cn("mb-3 flex min-h-9 items-center justify-between gap-3 rounded-md border border-section-header-border bg-section-header px-3 py-2", className)}>
      <span className="text-xs font-semibold text-foreground">{children}</span>
      {right}
    </div>
  );
}
export function Section({ label, right, children, className }: { label: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cn("mb-6", className)}><SectionLabel right={right}>{label}</SectionLabel>{children}</section>;
}
export function FieldLabel({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return <label htmlFor={htmlFor} className={cn("block text-xs font-medium text-foreground", className)}>{children}</label>;
}
export const fieldClass = "w-full min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
export const fieldStyle: React.CSSProperties = { borderColor: T.rule };
export function Mono({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={cn("font-sans tabular-nums", className)} style={style}>{children}</span>;
}
export const inkButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground";
export const outlineButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground";
export const quietButtonClass = outlineButtonClass;
export function SegmentedTabs({ value, onValueChange, options, className }: { value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1", className)}>
      {options.map(o => <Button key={o.value} type="button" role="tab" aria-selected={o.value === value} variant="ghost" size="sm" onClick={() => onValueChange(o.value)} className={cn("min-w-0 flex-1 text-xs", o.value === value ? "bg-background text-foreground shadow-sm hover:bg-background" : "text-muted-foreground")}>{o.label}</Button>)}
    </div>
  );
}
/** Retained name for callers; uses the standard accessible toggle. */
export function SquareSwitch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label?: string }) {
  return <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} className="shrink-0" />;
}
