import { Link } from "react-router-dom";
import { BRAND, display } from "./brand-tokens";

// Logo mark — two overlapping rounded rectangles. Per brand guidelines,
// never substitute or stretch. Always uses SKY for the front frame.
export const BrandMark = ({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" style={{ overflow: "visible" }}>
    <rect x="6.5" y="12.5" width="15" height="12" rx="2.2" fill="none" stroke={onDark ? "#9DBDFF" : "#9DBDFF"} strokeWidth="2.2" />
    <rect x="10.5" y="8.5" width="15" height="12" rx="2.2" fill="none" stroke={BRAND.sky} strokeWidth="2.2" />
  </svg>
);

export const Logo = ({ onDark = false }: { onDark?: boolean }) => (
  <Link to="/" className="inline-flex items-center gap-2.5" aria-label="ReportAir home">
    <BrandMark onDark={onDark} />
    <span className="text-[0.98rem] font-semibold tracking-wide" style={{ ...display, color: onDark ? "#fff" : BRAND.ink }}>
      REPORTAIR
    </span>
  </Link>
);
