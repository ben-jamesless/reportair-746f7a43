import { cn } from "@/lib/utils";

interface LockupProps {
  className?: string;
  onDark?: boolean;
  /** font-size in px applied to the wordmark */
  size?: number;
}

/**
 * BuildFolder wordmark lockup.
 * "Build" in ink (or paper on dark), "Folder" in accent orange wrapped
 * tightly in two corner brackets (top-left + bottom-right).
 */
export const BuildFolderLockup = ({ className, onDark = false, size = 22 }: LockupProps) => {
  const ink = onDark ? "#F4F1EA" : "#0F1417";
  const accent = "#D94F2A";
  const stroke = Math.max(2, Math.round(size * 0.14));
  const arm = Math.round(size * 0.32);

  return (
    <span
      className={cn("inline-flex items-baseline", className)}
      aria-label="BuildFolder"
      role="img"
      style={{
        font: `900 ${size}px Geist, system-ui, sans-serif`,
        letterSpacing: "-0.03em",
        lineHeight: 1,
        gap: 0,
      }}
    >
      <span style={{ color: ink }}>Build</span>
      <span
        style={{
          position: "relative",
          color: accent,
          paddingLeft: arm + 4,
          paddingRight: arm + 4,
          marginLeft: 2,
          display: "inline-block",
        }}
      >
        {/* Top-left corner bracket */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: `-${Math.round(size * 0.18)}px`,
            width: arm,
            height: arm,
            borderLeft: `${stroke}px solid ${accent}`,
            borderTop: `${stroke}px solid ${accent}`,
          }}
        />
        Folder
        {/* Bottom-right corner bracket */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 0,
            bottom: `-${Math.round(size * 0.12)}px`,
            width: arm,
            height: arm,
            borderRight: `${stroke}px solid ${accent}`,
            borderBottom: `${stroke}px solid ${accent}`,
          }}
        />
      </span>
    </span>
  );
};
