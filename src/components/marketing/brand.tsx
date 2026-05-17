import { Link } from "react-router-dom";
import { BRAND, display } from "./brand-tokens";

// BuildSlides logo mark — orange tile with two stacked slide rectangles.
export const BrandMark = ({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <rect x="0" y="0" width="32" height="32" rx="7" fill={BRAND.accent} />
    <rect x="7" y="9.5" width="14" height="9" rx="1.6" fill="#FFFFFF" opacity="0.55" />
    <rect x="11" y="13.5" width="14" height="9" rx="1.6" fill="#FFFFFF" />
  </svg>
);

export const Logo = ({ onDark = false }: { onDark?: boolean }) => (
  <Link to="/" className="inline-flex items-center gap-2.5" aria-label="BuildSlides home">
    <BrandMark onDark={onDark} />
    <span
      className="text-[1.05rem] font-bold tracking-tight"
      style={{ ...display, color: onDark ? "#F4F1EA" : BRAND.ink }}
    >
      BuildSlides
    </span>
  </Link>
);
