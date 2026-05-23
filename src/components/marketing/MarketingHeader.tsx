import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { BRAND } from "./brand-tokens";

// Top sticky nav with desktop links, sign-in / sign-up CTAs, and a mobile
// drawer toggled by the menu button. Self-contained — owns its own open
// state since nothing else on the page needs it.
export function MarketingHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur"
      style={{ background: "rgba(255,255,255,0.82)", borderBottom: `1px solid ${BRAND.border}` }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: BRAND.sky }} />
      <div className="mx-auto flex max-w-[1360px] items-center justify-between px-5 py-3.5 sm:px-6">
        <Link to="/" aria-label="BuildSlides home" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-display font-black tracking-tight text-base" style={{ color: BRAND.ink }}>BuildSlides</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          <a href="/#how-it-works" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>How it works</a>
          <a href="/#faq" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>FAQ</a>
          <a href="/#pricing" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>Pricing</a>
          <Link to="/about" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>About</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth?tab=signin"
            className="hidden sm:inline-flex rounded-full px-3.5 py-2 text-[0.88rem] font-semibold transition-colors"
            style={{ color: BRAND.ink, border: `1px solid ${BRAND.border}`, backgroundColor: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.cloud)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
          >
            Sign in
          </Link>
          <Link
            to="/auth?tab=signup"
            className="rounded-full px-3.5 py-2 text-[0.88rem] font-semibold text-white transition-colors"
            style={{ backgroundColor: BRAND.sky }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.deepSky)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND.sky)}
          >
            Start your first build
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            className="inline-flex md:hidden items-center justify-center rounded-full h-9 w-9 transition-colors"
            style={{ color: BRAND.ink, border: `1px solid ${BRAND.border}`, backgroundColor: "#fff" }}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileNavOpen && (
        <div className="md:hidden border-t" style={{ borderColor: BRAND.border, background: "rgba(255,255,255,0.98)" }}>
          <nav className="mx-auto flex max-w-[1360px] flex-col px-5 py-3 sm:px-6" aria-label="Mobile">
            <a href="/#how-it-works" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm font-medium" style={{ color: BRAND.slate }}>How it works</a>
            <a href="/#faq" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm font-medium" style={{ color: BRAND.slate }}>FAQ</a>
            <a href="/#pricing" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm font-medium" style={{ color: BRAND.slate }}>Pricing</a>
            <Link to="/about" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm font-medium" style={{ color: BRAND.slate }}>About</Link>
            <Link to="/auth?tab=signin" onClick={() => setMobileNavOpen(false)} className="sm:hidden py-2 text-sm font-semibold" style={{ color: BRAND.ink }}>Sign in</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
