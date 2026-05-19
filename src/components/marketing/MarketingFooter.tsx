import { BRAND } from "./brand-tokens";

export type LegalPanel = "terms" | "privacy";

type MarketingFooterProps = {
  onOpenLegal: (panel: LegalPanel) => void;
};

// Dark footer: wordmark + contact, anchors + legal, copyright + tagline.
export function MarketingFooter({ onOpenLegal }: MarketingFooterProps) {
  const muted = "rgba(237,241,247,.6)";
  const link = "rgba(237,241,247,.75)";

  return (
    <footer style={{ background: BRAND.ink, borderTop: "1px solid rgba(255,255,255,.06)" }}>
      <div className="mx-auto max-w-[1200px] px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          {/* Brand + contact */}
          <div className="flex flex-col gap-4">
            <a href="/" aria-label="BuildSlides home" className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="h-8 w-8" />
              <span className="font-display font-black tracking-tight text-base text-white">BuildSlides</span>
            </a>
            <div className="text-sm leading-relaxed" style={{ color: link }}>
              <p className="text-white font-medium">Ben Lee · Director</p>
              <p><a href="mailto:ben@buildslides.com" className="hover:text-white transition-colors">ben@buildslides.com</a></p>
              <p><a href="tel:+85261110265" className="hover:text-white transition-colors">+852 6111 0265</a></p>
              <p style={{ color: muted }}>Hong Kong</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-2 text-sm" style={{ color: link }} aria-label="Footer">
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <button type="button" onClick={() => onOpenLegal("terms")} className="text-left transition-colors hover:text-white">T&Cs</button>
            <button type="button" onClick={() => onOpenLegal("privacy")} className="text-left transition-colors hover:text-white">Privacy</button>
          </nav>

          {/* Tagline */}
          <div className="flex flex-col gap-2 sm:items-end sm:text-right">
            <p className="text-sm" style={{ color: link }}>Built in Hong Kong.</p>
            <p className="text-xs" style={{ color: muted }}>
              © {new Date().getFullYear()} BuildSlides. Photo-first event build reporting.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
