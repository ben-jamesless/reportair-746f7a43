import { cn } from "@/lib/utils";

interface LockupProps {
  className?: string;
  onDark?: boolean;
  /** font-size in px applied to the wordmark */
  size?: number;
}

/**
 * BuildFolder wordmark lockup.
 * "Build" in ink (or paper on dark), "Folder" in accent orange, wrapped in
 * corner brackets. Pure SVG — no font loading required.
 */
export const BuildFolderLockup = ({ className, onDark = false, size = 32 }: LockupProps) => {
  const ink = onDark ? "#F4F1EA" : "#0F1417";
  const accent = "#D94F2A";
  // Width is computed roughly from size to keep proportions: ~ size * 9
  const w = size * 9.2;
  const h = size * 1.95;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      className={cn("inline-block align-middle", className)}
      style={{ height: h, width: "auto" }}
      aria-label="BuildFolder"
      role="img"
    >
      <text
        x="0"
        y={h * 0.78}
        fill={ink}
        style={{
          font: `900 ${size}px Geist, system-ui, sans-serif`,
          letterSpacing: "-0.03em",
        }}
      >
        Build
      </text>
      <text
        x={size * 3.05}
        y={h * 0.78}
        fill={accent}
        style={{
          font: `900 ${size}px Geist, system-ui, sans-serif`,
          letterSpacing: "-0.03em",
        }}
      >
        Folder
      </text>
      {/* Top-left bracket around "Folder" */}
      <path
        d={`M${size * 3.0} ${h * 0.18} h${size * 0.55} M${size * 3.0} ${h * 0.18} v${size * 0.55}`}
        stroke={accent}
        strokeWidth={size * 0.13}
        fill="none"
      />
      {/* Bottom-right bracket around "Folder" */}
      <path
        d={`M${size * 8.85} ${h * 0.92} h-${size * 0.55} M${size * 8.85} ${h * 0.92} v-${size * 0.55}`}
        stroke={accent}
        strokeWidth={size * 0.13}
        fill="none"
      />
    </svg>
  );
};
