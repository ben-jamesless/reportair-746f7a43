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
