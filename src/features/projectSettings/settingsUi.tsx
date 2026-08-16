import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pass 2 token set for Project settings + Share & deliver.
 * These are the only colours those surfaces may use. Status colours
 * (amber / red) are reserved for Flagged / Delayed / issue states and must
 * never be applied to an action, toggle, tab or badge.
 */
export const T = {
  paper: "#FAF7F1",
  paper2: "#F3EFE7",
  ink: "#14181C",
  ink2: "#4A4740",
  muted: "#8C857A",
  rule: "#E2DCD1",
  bar: "#0E141B",
  white: "#FFFFFF",
} as const;

/** Status-only palette. Never use these on controls. */
export const STATUS = {
  blue: "#2C5BE0",
  amber: "#C8862A",
  red: "#C4402F",
  green: "#2F7D4F",
  grey: "#B9B2A6",
} as const;

export const MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** Dark header bar shared by every panel, matching the report rail. */
export function PanelBar({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ backgroundColor: T.bar, borderRadius: 0 }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#F3EFE7",
        }}
      >
        {title}
      </span>
      {right}
    </div>
  );
}

/** Mono uppercase section label + hairline rule. Replaces nested cards. */
export function SectionLabel({
  children,
  className,
  right,
}: {
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          {children}
        </span>
        {right}
      </div>
      <div className="mt-1.5" style={{ borderTop: `1px solid ${T.rule}` }} />
    </div>
  );
}

/** Flat section: label, hairline, content. No card, no shadow, no radius. */
export function Section({
  label,
  right,
  children,
  className,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6", className)}>
      <SectionLabel right={right}>{label}</SectionLabel>
      {children}
    </section>
  );
}

/** Mono uppercase field label sitting above its input. */
export function FieldLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block", className)}
      style={{
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: T.muted,
      }}
    >
      {children}
    </label>
  );
}

/** Square white input styling shared by settings fields. */
export const fieldClass =
  "w-full rounded-none border bg-white px-3 py-2 text-sm text-[#14181C] shadow-none " +
  "placeholder:text-[#8C857A] focus:outline-none focus:ring-0 focus:border-[#14181C]";

export const fieldStyle: React.CSSProperties = {
  borderColor: T.rule,
  borderRadius: 0,
};

/** Mono numerals for dates and counts — "08 JUL 2026", "119 PHOTOS". */
export function Mono({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={className} style={{ fontFamily: MONO, ...style }}>
      {children}
    </span>
  );
}

/** Ink primary button. Never orange. */
export const inkButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-none border border-[#14181C] bg-[#14181C] px-3 py-2 " +
  "text-sm font-medium text-[#FAF7F1] shadow-none transition-colors hover:bg-[#232a31] " +
  "disabled:cursor-not-allowed disabled:border-[#E2DCD1] disabled:bg-[#F3EFE7] disabled:text-[#8C857A] disabled:opacity-100";

/** Outlined secondary. Used for Finalise — never the loudest control. */
export const outlineButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-none border border-[#14181C] bg-transparent px-3 py-2 " +
  "text-sm font-medium text-[#14181C] shadow-none transition-colors hover:bg-[#F3EFE7] " +
  "disabled:cursor-not-allowed disabled:border-[#E2DCD1] disabled:text-[#8C857A] disabled:opacity-100";

export const quietButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-none border border-[#E2DCD1] bg-white px-3 py-2 " +
  "text-sm font-medium text-[#4A4740] shadow-none transition-colors hover:bg-[#F3EFE7] " +
  "disabled:cursor-not-allowed disabled:bg-[#F3EFE7] disabled:text-[#8C857A] disabled:opacity-100";

/** Square segmented control — solid ink fill on the active tab. */
export function SegmentedTabs({
  value,
  onValueChange,
  options,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex w-full overflow-x-auto", className)}
      style={{ border: `1px solid ${T.rule}`, borderRadius: 0, backgroundColor: T.white }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(o.value)}
            className="flex-1 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors focus:outline-none"
            style={{
              fontFamily: MONO,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontSize: 10.5,
              borderLeft: i === 0 ? "none" : `1px solid ${T.rule}`,
              backgroundColor: active ? T.ink : "transparent",
              color: active ? T.paper : T.ink2,
              borderRadius: 0,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Plain square switch with a mono ON / OFF label. No coloured pill. */
export function SquareSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 focus:outline-none disabled:cursor-not-allowed"
    >
      <span
        className="relative inline-flex h-5 w-9 items-center"
        style={{
          border: `1px solid ${checked ? T.ink : T.rule}`,
          backgroundColor: checked ? T.ink : T.white,
          borderRadius: 0,
        }}
      >
        <span
          className="absolute h-3.5 w-3.5 transition-all"
          style={{
            left: checked ? 18 : 2,
            backgroundColor: checked ? T.paper : T.muted,
            borderRadius: 0,
          }}
        />
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.12em",
          color: disabled ? T.muted : T.ink2,
        }}
      >
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}
