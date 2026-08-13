import { V2, statusMeta, NO_UPDATE } from "../tokens";

export function StatusPill({
  status,
  noUpdate = false,
  small = false,
}: {
  status?: string | null;
  noUpdate?: boolean;
  small?: boolean;
}) {
  const meta = noUpdate ? NO_UPDATE : statusMeta(status);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-[5px] uppercase"
      style={{
        backgroundColor: meta.bg,
        color: meta.fg,
        borderRadius: 3,
        fontSize: small ? 9.5 : 10.5,
        fontWeight: 700,
        letterSpacing: "0.05em",
        padding: small ? "2px 8px 2px 7px" : "4px 11px 4px 9px",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: meta.fg }} />
      {meta.label}
    </span>
  );
}

export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`uppercase ${className}`}
      style={{
        fontFamily: V2.mono,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.13em",
        color: V2.muted,
        borderTop: `1px solid ${V2.rule}`,
        paddingTop: 10,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Section label that doubles as a collapse toggle. Long events can have many
 * areas, so main-column sections can be folded away.
 */
export function CollapsibleSectionLabel({
  children,
  open,
  onToggle,
  count,
  className = "",
}: {
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`flex w-full items-center gap-2 uppercase ${className}`}
      style={{
        fontFamily: V2.mono,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.13em",
        color: V2.muted,
        borderTop: `1px solid ${V2.rule}`,
        paddingTop: 10,
        marginBottom: open ? 14 : 10,
        textAlign: "left",
      }}
    >
      <ChevronDown
        className="h-3.5 w-3.5 shrink-0 transition-transform"
        style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
      />
      <span className="flex-1">{children}</span>
      {typeof count === "number" && <span style={{ opacity: 0.7 }}>{count}</span>}
    </button>
  );
}

/** Dark band header used by sidebar panels, with an expand/collapse chevron. */
export function PanelHeader({
  title,
  right,
  open,
  onToggle,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 uppercase"
      style={{
        fontFamily: V2.mono,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: V2.bandFgSoft,
        padding: "12px 16px",
        backgroundColor: V2.band,
        textAlign: "left",
      }}
    >
      <ChevronDown
        className="h-3.5 w-3.5 shrink-0 transition-transform"
        style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
      />
      <span className="flex-1">{title}</span>
      {right}
    </button>
  );
}
