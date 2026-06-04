import { Link } from "react-router-dom";
import { BRAND, display } from "./brand-tokens";

// BuildFolder logo mark — uses the same mark as the marketing homepage header.
export const BrandMark = ({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) => (
  <img src="/favicon.svg" width={size} height={size} alt="" aria-hidden="true" />
);

export const Logo = ({ onDark = false }: { onDark?: boolean }) => (
  <Link to="/" className="inline-flex items-center gap-2.5" aria-label="BuildFolder home">
    <BrandMark onDark={onDark} />
    <span
      className="text-[1.05rem] font-bold tracking-tight"
      style={{ ...display, color: onDark ? "#F4F1EA" : BRAND.ink }}
    >
      BuildFolder
    </span>
  </Link>
);
