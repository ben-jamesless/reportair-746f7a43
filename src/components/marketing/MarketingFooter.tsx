import { BRAND } from "./brand-tokens";

export type LegalPanel = "terms" | "privacy";

type MarketingFooterProps = {
  onOpenLegal: (panel: LegalPanel) => void;
};

// Dark footer with the wordmark, copyright line, section anchors, and the
// two buttons that open the legal slide-out (handled by the parent).
export function MarketingFooter({ onOpenLegal }: MarketingFooterProps) {
  return (
    <footer style={{ background: BRAND.ink, borderTop: "1px solid rgba(255,255,255,.06)" }}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <Logo onDark />
        <p className="text-xs" style={{ color: "rgba(237,241,247,.55)" }}>
          © {new Date().getFullYear()} BuildSlides. Photo-first event build reporting.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" style={{ color: "rgba(237,241,247,.7)" }}>
          <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
          <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
          <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
          <button type="button" onClick={() => onOpenLegal("terms")} className="transition-colors hover:text-white">T&Cs</button>
          <button type="button" onClick={() => onOpenLegal("privacy")} className="transition-colors hover:text-white">Privacy</button>
        </nav>
      </div>
    </footer>
  );
}
