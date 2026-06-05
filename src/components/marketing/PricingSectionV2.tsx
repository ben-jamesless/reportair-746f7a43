import { Link } from "react-router-dom";

/**
 * Paper-canvas pricing cards for the V2 pricing page.
 * Mirrors the reference: light cards + one dark "contact sales" card.
 * Data parity with PricingSection (Free / Solo / Crew / Studio).
 */

type Plan = {
  name: string;
  best: string;
  price: string;
  priceSuffix?: string;
  priceCaption: string;
  highlights: { label: string; bold?: string }[];
  groupHeader: string;
  features: string[];
  cta: string;
  ctaLink: string;
  featured?: boolean;
  dark?: boolean;
  flag?: string;
  microcopy?: string;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    best: "Try it — no card needed",
    price: "HK$0",
    priceCaption: "Always free",
    highlights: [
      { label: "active build", bold: "1" },
      { label: "build-day reports", bold: "3" },
    ],
    groupHeader: "Free Plan Includes:",
    features: [
      "Unlimited photo uploads",
      "Live share link",
      "BuildFolder branded",
    ],
    cta: "Start free",
    ctaLink: "/auth?tab=signup",
    microcopy: "No credit card needed",
  },
  {
    name: "Solo",
    best: "For solo operators",
    price: "HK$128",
    priceSuffix: "/mo",
    priceCaption: "Billed monthly",
    highlights: [
      { label: "active build", bold: "1" },
      { label: "build days", bold: "Unlimited" },
    ],
    groupHeader: "Everything in Free, plus:",
    features: [
      "Unlimited build days",
      "Live share link",
      "BuildFolder branded",
      "7-day free trial",
    ],
    cta: "Start 7-day trial",
    ctaLink: "/auth?tab=signup",
    microcopy: "No credit card needed",
  },
  {
    name: "Crew",
    best: "For growing event teams",
    price: "HK$298",
    priceSuffix: "/mo",
    priceCaption: "Billed monthly · HK$2,860 annually",
    highlights: [
      { label: "active builds", bold: "5" },
      { label: "team members", bold: "5" },
    ],
    groupHeader: "Everything in Solo, plus:",
    features: [
      "Password-protected links",
      "PDF export",
      "Your logo + BuildFolder",
      "Project folders & invites",
    ],
    cta: "Start 7-day trial",
    ctaLink: "/auth?tab=signup",
    featured: true,
    flag: "Most Popular",
    microcopy: "No credit card needed",
  },
  {
    name: "Studio",
    best: "For agencies & venues",
    price: "Custom",
    priceCaption: "Contact sales",
    highlights: [
      { label: "active builds", bold: "Unlimited" },
      { label: "team members", bold: "Unlimited" },
    ],
    groupHeader: "Everything in Crew, plus:",
    features: [
      "White-label reports (coming soon)",
      "Custom domain (coming soon)",
      "Priority support",
      "Custom contracts & invoicing",
    ],
    cta: "Talk to sales",
    ctaLink: "mailto:hello@buildslides.co",
    dark: true,
  },
];

const Check = ({ dark = false }: { dark?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 4 }}>
    <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke={dark ? "#F4F1EA" : "#0F1417"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PersonIcon = ({ dark = false }: { dark?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <circle cx="7" cy="4.5" r="2.2" stroke={dark ? "rgba(244,241,234,0.6)" : "rgba(15,20,23,0.55)"} strokeWidth="1.4" />
    <path d="M2.5 12c0-2.2 2-3.6 4.5-3.6S11.5 9.8 11.5 12" stroke={dark ? "rgba(244,241,234,0.6)" : "rgba(15,20,23,0.55)"} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const FolderIcon = ({ dark = false }: { dark?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M1.5 4.2C1.5 3.5 2 3 2.7 3h2.6l1.2 1.2h4.8c.7 0 1.2.5 1.2 1.2v5.1c0 .7-.5 1.2-1.2 1.2H2.7c-.7 0-1.2-.5-1.2-1.2V4.2Z" stroke={dark ? "rgba(244,241,234,0.6)" : "rgba(15,20,23,0.55)"} strokeWidth="1.4" />
  </svg>
);

const PricingSectionV2 = () => (
  <section className="pricing-v2">
    <style>{`
      .pricing-v2 {
        --ink: #0F1417;
        --paper: #FAF7F0;
        --paper-2: #F4F1EA;
        --accent: #D94F2A;
        --mute: #6B6B66;
        --line: #E5E1D6;
        font-family: 'Geist', system-ui, sans-serif;
        color: var(--ink);
        padding: 96px 32px 64px;
      }
      .pricing-v2-inner { max-width: 1200px; margin: 0 auto; }

      .pricing-v2-head { text-align: center; margin: 0 auto 56px; max-width: 720px; }
      .pricing-v2-eyebrow {
        font-family: 'Geist Mono', ui-monospace, monospace;
        font-size: 11px; font-weight: 700;
        letter-spacing: 0.22em; text-transform: uppercase;
        color: var(--accent); margin: 0 0 14px;
      }
      .pricing-v2-title {
        font-size: clamp(36px, 5vw, 56px);
        font-weight: 900; line-height: 1.05;
        letter-spacing: -0.02em; margin: 0 0 16px;
      }
      .pricing-v2-title .accent { color: var(--accent); }
      .pricing-v2-sub { font-size: 17px; line-height: 1.6; color: var(--mute); margin: 0; }

      .pricing-v2-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 20px;
        align-items: stretch;
      }

      .pcard {
        position: relative;
        background: #FFFFFF;
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 32px 28px 28px;
        display: flex; flex-direction: column;
        box-shadow:
          0 1px 0 rgba(15,20,23,0.04),
          0 18px 40px -22px rgba(15,20,23,0.18);
      }
      .pcard.featured {
        border-color: rgba(217,79,42,0.5);
        box-shadow:
          0 1px 0 rgba(15,20,23,0.04),
          0 24px 50px -22px rgba(217,79,42,0.35),
          0 0 0 1px rgba(217,79,42,0.18) inset;
      }
      .pcard.dark {
        background: #0F1417;
        color: #F4F1EA;
        border-color: #0F1417;
      }
      .pcard .flag {
        position: absolute; top: -12px; right: 20px;
        background: var(--accent); color: #FFFFFF;
        font-family: 'Geist Mono', ui-monospace, monospace;
        font-size: 11px; font-weight: 700;
        letter-spacing: 0.04em;
        padding: 6px 14px;
        border-radius: 100px;
      }
      .pcard .flag::before { display: none; }
      .pcard .flag::before {
        content: ''; position: absolute; left: 10px; top: 50%;
        transform: translateY(-50%);
        width: 10px; height: 10px; border-radius: 50%;
        border: 1.5px solid #E4FF6B;
      }

      .pcard .name { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0; }
      .pcard .best { font-size: 13px; color: var(--mute); margin: 4px 0 0; }
      .pcard.dark .best { color: rgba(244,241,234,0.6); }

      .pcard .price-row { margin: 28px 0 6px; display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
      .pcard .price { font-size: 44px; font-weight: 800; letter-spacing: -0.025em; line-height: 1; }
      .pcard .suffix { font-size: 18px; font-weight: 600; color: var(--mute); }
      .pcard.dark .suffix { color: rgba(244,241,234,0.55); }
      .pcard .price-cap { font-size: 13px; color: var(--mute); margin: 0 0 22px; }
      .pcard.dark .price-cap { color: rgba(244,241,234,0.55); }

      .pcard .highlights {
        display: flex; flex-direction: column; gap: 10px;
        padding-bottom: 22px; margin-bottom: 22px;
        border-bottom: 1px solid var(--line);
      }
      .pcard.dark .highlights { border-bottom-color: rgba(244,241,234,0.12); }
      .pcard .hi { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--ink); }
      .pcard.dark .hi { color: #F4F1EA; }
      .pcard .hi b { font-weight: 700; }

      .pcard .group-header {
        font-size: 13.5px; font-weight: 700; margin: 0 0 14px;
      }
      .pcard ul.features {
        list-style: none; padding: 0; margin: 0 0 28px;
        display: flex; flex-direction: column; gap: 10px;
        font-size: 14px; flex: 1;
      }
      .pcard.dark ul.features { color: rgba(244,241,234,0.82); }
      .pcard ul.features li { display: flex; gap: 10px; align-items: flex-start; line-height: 1.45; }

      .pcard .cta {
        display: block; text-align: center; width: 100%;
        padding: 12px 16px; border-radius: 100px;
        font-size: 14px; font-weight: 700;
        border: 1.5px solid var(--ink);
        background: transparent; color: var(--ink);
        transition: background 0.15s, color 0.15s;
        text-decoration: none;
      }
      .pcard .cta:hover { background: var(--ink); color: #F4F1EA; }
      .pcard.featured .cta { background: var(--accent); border-color: var(--accent); color: #fff; }
      .pcard.featured .cta:hover { background: #B83E1E; border-color: #B83E1E; }
      .pcard.dark .cta { border-color: #F4F1EA; color: #F4F1EA; }
      .pcard.dark .cta:hover { background: #F4F1EA; color: #0F1417; }

      .pcard .microcopy {
        text-align: center; font-size: 12.5px; color: var(--mute);
        margin: 12px 0 0;
      }
      .pcard.dark .microcopy { color: rgba(244,241,234,0.5); }

      @media (max-width: 1100px) {
        .pricing-v2-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .pricing-v2 { padding: 64px 18px 48px; }
        .pricing-v2-grid { grid-template-columns: 1fr; gap: 16px; }
        .pcard { padding: 28px 24px 24px; }
        .pcard .price { font-size: 38px; }
      }
    `}</style>

    <div className="pricing-v2-inner">
      <header className="pricing-v2-head">
        <p className="pricing-v2-eyebrow">Pricing</p>
        <h1 className="pricing-v2-title">
          Simple pricing.<br />
          <span className="accent">Built for the build.</span>
        </h1>
        <p className="pricing-v2-sub">
          Every plan includes the essentials: create a project, update it with photos, share it in minutes.
        </p>
      </header>

      <div className="pricing-v2-grid">
        {PLANS.map((p) => {
          const isExternal = p.ctaLink.startsWith("mailto:") || p.ctaLink.startsWith("http");
          return (
            <article
              key={p.name}
              className={`pcard${p.featured ? " featured" : ""}${p.dark ? " dark" : ""}`}
            >
              {p.flag && <span className="flag">{p.flag}</span>}
              <h3 className="name">{p.name}</h3>
              <p className="best">{p.best}</p>

              <div className="price-row">
                <span className="price">{p.price}</span>
                {p.priceSuffix && <span className="suffix">{p.priceSuffix}</span>}
              </div>
              <p className="price-cap">{p.priceCaption}</p>

              <div className="highlights">
                {p.highlights.map((h, idx) => (
                  <div key={idx} className="hi">
                    {idx === 0 ? <FolderIcon dark={p.dark} /> : <PersonIcon dark={p.dark} />}
                    <span><b>{h.bold}</b> {h.label}</span>
                  </div>
                ))}
              </div>

              <p className="group-header">{p.groupHeader}</p>
              <ul className="features">
                {p.features.map((f) => (
                  <li key={f}><Check dark={p.dark} /><span>{f}</span></li>
                ))}
              </ul>

              {isExternal ? (
                <a href={p.ctaLink} className="cta">{p.cta}</a>
              ) : (
                <Link to={p.ctaLink} className="cta">{p.cta}</Link>
              )}
              {p.microcopy && <p className="microcopy">{p.microcopy}</p>}
            </article>
          );
        })}
      </div>
    </div>
  </section>
);

export default PricingSectionV2;
