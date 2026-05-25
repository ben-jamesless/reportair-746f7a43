import { useState } from "react";
import { Link } from "react-router-dom";
import { BRAND, display } from "./brand-tokens";

type Plan = {
  name: string;
  best: string;
  monthlyPrice: string;
  annualMonthly: string;
  annualBilled: string;
  features: string[];
  cta: string;
  ctaLink: string;
  featured: boolean;
  flag?: string;
};

const PRICING = {
  title: "Build reports your client will actually open.",
  sub: "Every plan includes the essentials: create a project, update it with photos, share it in minutes.",
  plans: [
    {
      name: "Free",
      best: "Try it — no card needed",
      monthlyPrice: "HK$0",
      annualMonthly: "HK$0",
      annualBilled: "Always free",
      features: [
        "1 active build",
        "3 build-day reports",
        "Unlimited photo uploads",
        "Live share link",
        "BuildSlides branded",
      ],
      cta: "Start your first build",
      ctaLink: "/auth?tab=signup",
      featured: false,
      flag: undefined,
    },
    {
      name: "Solo",
      best: "For solo operators",
      monthlyPrice: "HK$128",
      annualMonthly: "HK$102",
      annualBilled: "HK$1,229 billed annually",
      features: [
        "1 active build",
        "Unlimited build days",
        "Unlimited photo uploads",
        "Live share link",
        "BuildSlides branded",
        "7-day free trial",
      ],
      cta: "Start your first build",
      ctaLink: "/auth?tab=signup",
      featured: false,
      flag: undefined,
    },
    {
      name: "Crew",
      best: "For growing event teams",
      monthlyPrice: "HK$298",
      annualMonthly: "HK$238",
      annualBilled: "HK$2,860 billed annually",
      features: [
        "5 active builds",
        "5 team members",
        "Unlimited photo uploads",
        "Live share link",
        "Password-protected links",
        "PDF export",
        "Your logo + BuildSlides",
        "Project folders & invites",
        "7-day free trial",
      ],
      cta: "Start your first build",
      ctaLink: "/auth?tab=signup",
      featured: true,
      flag: "Most teams start here",
    },
    {
      name: "Studio",
      best: "For agencies, large contractors, venues",
      monthlyPrice: "Get in touch",
      annualMonthly: "Get in touch",
      annualBilled: "Custom pricing",
      features: [
        "Unlimited active builds",
        "Unlimited team members",
        "Unlimited photo uploads",
        "Live share link",
        "Password-protected links",
        "PDF export",
        "Your logo only — no BuildSlides",
        "White-label report header",
        "Custom domain (coming soon)",
        "Priority support + onboarding call",
        "7-day free trial",
      ],
      cta: "Talk to sales",
      ctaLink: "mailto:hello@buildslides.co",
      featured: false,
      flag: undefined,
    },
  ] as Plan[],
};

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 flex-none" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill={BRAND.skySoft} />
    <path d="M6 10.5l2.5 2.5L14 7.5" stroke={BRAND.sky} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-[34px] sm:py-[48px] md:py-[95px]" style={{ background: "#0F1417" }}>
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold sm:text-4xl" style={{ ...display, color: "#FFFFFF", lineHeight: 1.15 }}>
            {PRICING.title}
          </h2>
          <p className="mt-3 text-base" style={{ color: "rgba(255,255,255,0.55)" }}>
            {PRICING.sub}
          </p>
        </header>

        <div className="mb-10 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${!annual ? "text-white" : "text-white/50"}`}>Monthly</span>
          <button
            type="button"
            onClick={() => setAnnual((a) => !a)}
            className="relative h-6 w-11 rounded-full transition-colors"
            style={{ background: annual ? BRAND.sky : "rgba(255,255,255,0.18)" }}
            aria-label="Toggle annual billing"
          >
            <span
              className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform"
              style={{ transform: annual ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? "text-white" : "text-white/50"}`}>
            Annual
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "rgba(29,184,122,0.15)", color: "#1DB87A" }}>
              Save 20%
            </span>
          </span>
        </div>

        <div className="grid items-stretch gap-7 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {PRICING.plans.map((p) => {
            const isFeatured = p.featured;
            const isCustom = p.monthlyPrice === "Get in touch";
            const price = annual ? p.annualMonthly : p.monthlyPrice;
            const isExternal = p.ctaLink.startsWith("mailto:") || p.ctaLink.startsWith("http");
            const ctaStyle = isFeatured
              ? { background: BRAND.sky, color: "#fff" }
              : { background: "rgba(255,255,255,0.06)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" };
            const ctaClass =
              "block w-full rounded-full px-5 py-3 text-center text-[0.95rem] font-semibold transition-colors";
            return (
              <article
                key={p.name}
                className={`relative flex flex-col rounded-2xl p-7 transition-transform ${isFeatured ? "md:scale-[1.04] md:py-8" : ""}`}
                style={{
                  background: "linear-gradient(135deg, rgba(26,32,37,0.95), rgba(15,20,23,0.85))",
                  border: `1px solid ${isFeatured ? "rgba(217,79,42,0.55)" : "rgba(217,79,42,0.14)"}`,
                  boxShadow: isFeatured
                    ? "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.4), 0 0 60px -20px rgba(217,79,42,0.45)"
                    : "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.35)",
                }}
              >
                {isFeatured && p.flag && (
                  <span
                    className="absolute left-1/2 whitespace-nowrap rounded-full font-bold text-white"
                    style={{
                      top: "-14px",
                      transform: "translateX(-50%)",
                      padding: "6px 18px",
                      fontSize: "13px",
                      fontWeight: 700,
                      background: BRAND.sky,
                      boxShadow: "0 6px 18px -6px rgba(217,79,42,.55)",
                    }}
                  >
                    {p.flag}
                  </span>
                )}
                <header className="mb-4">
                  <h3 className="text-xl font-bold" style={{ ...display, color: "#FFFFFF" }}>{p.name}</h3>
                  <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{p.best}</p>
                </header>

                {isCustom ? (
                  <div className="mb-5">
                    <span className="text-2xl font-extrabold" style={{ ...display, color: "#FFFFFF" }}>
                      Get in touch
                    </span>
                    <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      Custom pricing for your team
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold" style={{ ...display, color: "#FFFFFF" }}>{price}</span>
                      <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>/month</span>
                    </div>
                    <p className="mb-5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {annual ? p.annualBilled : "Billed monthly"}
                    </p>
                  </>
                )}

                <ul className="mb-7 flex-1 space-y-2.5 text-[0.95rem]" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isExternal ? (
                  <a
                    href={p.ctaLink}
                    className={ctaClass}
                    style={ctaStyle}
                    onMouseEnter={(e) => { if (isFeatured) e.currentTarget.style.background = BRAND.deepSky; }}
                    onMouseLeave={(e) => { if (isFeatured) e.currentTarget.style.background = BRAND.sky; }}
                  >
                    {p.cta}
                  </a>
                ) : (
                  <Link
                    to={p.ctaLink}
                    className={ctaClass}
                    style={ctaStyle}
                    onMouseEnter={(e) => { if (isFeatured) e.currentTarget.style.background = BRAND.deepSky; }}
                    onMouseLeave={(e) => { if (isFeatured) e.currentTarget.style.background = BRAND.sky; }}
                  >
                    {p.cta}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
