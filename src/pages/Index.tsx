import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, FileText, Shield } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import HeroSection from "@/components/marketing/HeroSection";
import HowItWorksSection from "@/components/marketing/HowItWorksSection";
import FAQSection from "@/components/marketing/FAQSection";
import TimeSavedSection from "@/components/marketing/TimeSavedSection";
import UseCasesSection from "@/components/marketing/UseCasesSection";

// ---- Brand tokens (scoped to this marketing page) ----
const BRAND = {
  sky: "#1A6EFF",
  deepSky: "#0D47B5",
  skySoft: "#E8F0FF",
  ink: "#0F1724",
  slate: "#3D4F66",
  mist: "#7A8FA8",
  cloud: "#EDF1F7",
  fog: "#F5F7FA",
  border: "#D0D9E8",
  border2: "#B9C7DA",
  surface: "#FFFFFF",
  emerald: "#1DB87A",
  amber: "#FF8C00",
  alert: "#E8351A",
};

const display = { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };

// ---- Editable copy ----
const COPY = {
  nav: { product: "Product", reviews: "Reviews", pricing: "Pricing", cta: "Sign in" },
  hero: {
    eyebrow: "\n",
    headlineStart: "Client-ready event build reports in ",
    headlineAccent: "10 minutes.",
    sub: "Capture and sort site photos. Export a polished PDF or client-safe link in minutes.",
    primary: "Sign in",
    secondary: "See how it works →",
  },
  metric: {
    big: "10",
    unit: "minutes",
    title: "to a client-ready report.",
    desc: "Capture and sort photos onsite. ReportAir turns them into polished daily or weekly client-ready reports without the deck rebuild.",
  },
  features: [
    {
      step: "01 · Capture & sort",
      title: "Take site photos. Keep the build organised as it happens.",
      desc: "During load-in and setup, details move fast. ReportAir gives your team a simple way to capture progress photos, add quick context, and sort every update by date, area, and status while the work is still fresh.",
      checks: [
        "Upload or take photos from site",
        "Tag updates by event area, zone, supplier, or workstream",
        "Add quick notes, issues, and decisions where needed",
        "Keep every update organised for the next report",
      ],
    },
    {
      step: "02 · Export & share",
      title: "Turn sorted updates into a client-ready report.",
      desc: "ReportAir turns your selected photos and notes into a clean, branded report that shows what happened, what needs attention, and what is next. Share it as a PDF or client-safe link before anyone has to chase you.",
      checks: [
        "Generate daily or weekly build reports",
        "Choose the photos and updates to include",
        "Hide internal-only notes from client views",
        "Export as PDF or share a simple link",
      ],
    },
  ],
  reviews: {
    eyebrow: "Early users",
    title: "Built for teams who need the client to see the work, not the chaos.",
    items: [
      "It was all sorted and managed so easily during the build. We now have full daily records sorted and filed ready to reference for next year's build.",
      "The client could see progress every day without calling for another status check.",
      "The report was already structured because the photos had been sorted properly during the build.",
    ],
  },
  pricing: {
    title: "Simple pricing for event teams.",
    sub: "Start with one event, then scale across your builds, activations, and client reports.",
    plans: [
      {
        name: "Solo",
        best: "For solo operators running events",
        monthlyPrice: "HK$128",
        annualMonthly: "HK$102",
        annualBilled: "HK$1,229 billed annually",
        features: [
          "1 active event",
          "Unlimited PDF exports",
          "14-day free trial",
        ],
        cta: "Start free trial",
        featured: false,
      },
      {
        name: "Pro",
        best: "For growing event teams",
        monthlyPrice: "HK$298",
        annualMonthly: "HK$238",
        annualBilled: "HK$2,860 billed annually",
        features: [
          "5 active events",
          "5 team members",
          "Unlimited PDF exports",
          "Share & client links",
          "Password-protected links",
          "Project folders",
          "Project invites",
          "14-day free trial",
        ],
        cta: "Start free trial",
        featured: true,
        flag: "Most teams start here",
      },
      {
        name: "Studio",
        best: "For agencies and large organisations",
        monthlyPrice: "HK$688",
        annualMonthly: "HK$550",
        annualBilled: "HK$6,604 billed annually",
        features: [
          "Unlimited events",
          "Unlimited team members",
          "Unlimited PDF exports",
          "Share & client links",
          "Custom logo on PDF",
          "White-label report header",
          "Priority support",
          "Onboarding call",
          "14-day free trial",
        ],
        cta: "Start free trial",
        featured: false,
      },
    ],
  },
  finalCta: {
    title: "Built for the build. Reporting has never been so easy.",
    sub: "",
    cta: "Join the early access list",
    fine: "No spam. Launch updates and early-access pricing only.",
  },
};

// ---- Logo ----
const BrandMark = ({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" style={{ overflow: "visible" }}>
    <rect x="6.5" y="12.5" width="15" height="12" rx="2.2" fill="none" stroke={onDark ? "#9DBDFF" : "#9DBDFF"} strokeWidth="2.2" />
    <rect x="10.5" y="8.5" width="15" height="12" rx="2.2" fill="none" stroke={BRAND.sky} strokeWidth="2.2" />
  </svg>
);

const Logo = ({ onDark = false }: { onDark?: boolean }) => (
  <Link to="/" className="inline-flex items-center gap-2.5" aria-label="ReportAir home">
    <BrandMark onDark={onDark} />
    <span className="text-[0.98rem] font-semibold tracking-wide" style={{ ...display, color: onDark ? "#fff" : BRAND.ink }}>
      REPORTAIR
    </span>
  </Link>
);

// ---- Page ----
const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [legalPanel, setLegalPanel] = useState<null | "terms" | "privacy">(null);

  useEffect(() => {
    if (!loading && user) navigate("/projects", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.fog, color: BRAND.ink, ...body }}>
      {/* ============ NAV ============ */}
      <header
        className="sticky top-0 z-50 backdrop-blur"
        style={{ background: "rgba(255,255,255,0.82)", borderBottom: `1px solid ${BRAND.border}` }}
      >
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: BRAND.sky }} />
        <div className="mx-auto flex max-w-[1360px] items-center justify-between px-5 py-3.5 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            <a href="#how-it-works" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>How it works</a>
            <a href="#faq" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>FAQ</a>
            <a href="#pricing" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>Pricing</a>
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
              Sign up
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
              <a href="#how-it-works" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm font-medium" style={{ color: BRAND.slate }}>How it works</a>
              <a href="#faq" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm font-medium" style={{ color: BRAND.slate }}>FAQ</a>
              <a href="#pricing" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm font-medium" style={{ color: BRAND.slate }}>Pricing</a>
              <Link to="/auth?tab=signin" onClick={() => setMobileNavOpen(false)} className="sm:hidden py-2 text-sm font-semibold" style={{ color: BRAND.ink }}>Sign in</Link>
            </nav>
          </div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <HeroSection />

      {/* ============ HOW IT WORKS ============ */}
      <div id="how-it-works"><HowItWorksSection /></div>

      {/* ============ PRODUCT FEATURES (removed — replaced by How It Works) ============ */}

      {/* ============ REVIEWS ============ */}
      {/* ============ TIME SAVED ============ */}
      <TimeSavedSection />

      {/* ============ REVIEWS ============ */}
      <section id="reviews" className="py-[34px] md:py-[68px]" style={{ background: "#060D18" }}>
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <header className="mx-auto mb-12 max-w-3xl text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "rgba(168,196,255,0.6)" }}>
              {COPY.reviews.eyebrow}
            </span>
            <h2 className="text-2xl font-extrabold sm:text-4xl" style={{ ...display, color: "#FFFFFF", lineHeight: 1.15 }}>
              {COPY.reviews.title}
            </h2>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            {COPY.reviews.items.map((q, i) => (
              <figure
                key={i}
                className="flex flex-col rounded-2xl p-6"
                style={{
                  background: "linear-gradient(135deg, rgba(11,24,48,0.95), rgba(14,32,68,0.85))",
                  border: "1px solid rgba(26,110,255,0.14)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.35)",
                }}
              >
                <div className="text-5xl leading-none" style={{ ...display, color: BRAND.sky }}>"</div>
                <blockquote className="mt-2 flex-1 text-[0.98rem]" style={{ color: "#FFFFFF", lineHeight: 1.55 }}>
                  {q}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full"
                    style={{ background: "rgba(26,110,255,0.18)", border: "1px solid rgba(26,110,255,0.4)" }}
                  />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>Javier Campero</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Tournament Director · LIV</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <div id="faq"><FAQSection /></div>

      {/* ============ USE CASES ============ */}
      <UseCasesSection />

      {/* ============ PRICING ============ */}
      <section id="pricing" className="py-[34px] sm:py-[48px] md:py-[95px]" style={{ background: "#060D18" }}>
        <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
          <header className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold sm:text-4xl" style={{ ...display, color: "#FFFFFF", lineHeight: 1.15 }}>
              {COPY.pricing.title}
            </h2>
            <p className="mt-3 text-base" style={{ color: "rgba(255,255,255,0.55)" }}>
              {COPY.pricing.sub}
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

          <div className="grid items-stretch gap-7 md:grid-cols-3 lg:gap-8">
            {COPY.pricing.plans.map((p) => {
              const isFeatured = p.featured;
              const price = annual ? p.annualMonthly : p.monthlyPrice;
              return (
                <article
                  key={p.name}
                  className={`relative flex flex-col rounded-2xl p-7 transition-transform ${isFeatured ? "md:scale-[1.04] md:py-8" : ""}`}
                  style={{
                    background: "linear-gradient(135deg, rgba(11,24,48,0.95), rgba(14,32,68,0.85))",
                    border: `1px solid ${isFeatured ? "rgba(26,110,255,0.55)" : "rgba(26,110,255,0.14)"}`,
                    boxShadow: isFeatured
                      ? "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.4), 0 0 60px -20px rgba(26,110,255,0.45)"
                      : "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.35)",
                  }}
                >
                  {isFeatured && "flag" in p && p.flag && (
                    <span
                      className="absolute left-1/2 whitespace-nowrap rounded-full font-bold text-white"
                      style={{
                        top: "-14px",
                        transform: "translateX(-50%)",
                        padding: "6px 18px",
                        fontSize: "13px",
                        fontWeight: 700,
                        background: BRAND.sky,
                        boxShadow: "0 6px 18px -6px rgba(26,110,255,.55)",
                      }}
                    >
                      {p.flag}
                    </span>
                  )}
                  <header className="mb-4">
                    <h3 className="text-xl font-bold" style={{ ...display, color: "#FFFFFF" }}>{p.name}</h3>
                    <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{p.best}</p>
                  </header>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold" style={{ ...display, color: "#FFFFFF" }}>{price}</span>
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>/month</span>
                  </div>
                  <p className="mb-5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {annual ? p.annualBilled : "Billed monthly"}
                  </p>
                  <ul className="mb-7 flex-1 space-y-2.5 text-[0.95rem]" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckIcon />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/auth?tab=signup"
                    className="block w-full rounded-full px-5 py-3 text-center text-[0.95rem] font-semibold transition-colors"
                    style={
                      isFeatured
                        ? { background: BRAND.sky, color: "#fff" }
                        : { background: "rgba(255,255,255,0.06)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" }
                    }
                    onMouseEnter={(e) => {
                      if (isFeatured) e.currentTarget.style.background = BRAND.deepSky;
                    }}
                    onMouseLeave={(e) => {
                      if (isFeatured) e.currentTarget.style.background = BRAND.sky;
                    }}
                  >
                    {p.cta}
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section id="cta" className="relative overflow-hidden py-[34px] sm:py-[41px] md:py-[82px]" style={{ background: BRAND.ink }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 80% 20%, rgba(26,110,255,.25), transparent 60%), radial-gradient(40% 50% at 10% 90%, rgba(26,110,255,.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1000px] px-5 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl" style={{ ...display, lineHeight: 1.15 }}>
            {COPY.finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg" style={{ color: "rgba(237,241,247,.8)" }}>
            {COPY.finalCta.sub}
          </p>
          <form
            className="mx-auto mt-8 flex max-w-[780px] flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const btn = e.currentTarget.querySelector("button");
              if (btn) btn.textContent = "Thanks — you're on the list";
            }}
          >
            <input
              type="email"
              required
              placeholder="you@yourevents.co"
              className="h-12 w-full flex-1 rounded-full border px-5 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/60 my-0"
              style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.18)" }}
            />
            <button
              type="submit"
              className="h-12 rounded-full px-6 text-sm font-semibold text-white transition-colors"
              style={{ background: BRAND.sky }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.deepSky)}
              onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.sky)}
            >
              {COPY.finalCta.cta}
            </button>
          </form>
          <p className="mt-4 text-xs" style={{ color: "rgba(237,241,247,.55)" }}>
            {COPY.finalCta.fine}
          </p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer style={{ background: BRAND.ink, borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <Logo onDark />
          <p className="text-xs" style={{ color: "rgba(237,241,247,.55)" }}>
            © {new Date().getFullYear()} ReportAir. Photo-first event build reporting.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" style={{ color: "rgba(237,241,247,.7)" }}>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <button type="button" onClick={() => setLegalPanel("terms")} className="transition-colors hover:text-white">T&Cs</button>
            <button type="button" onClick={() => setLegalPanel("privacy")} className="transition-colors hover:text-white">Privacy</button>
          </nav>
        </div>
      </footer>

      {/* ============ LEGAL SLIDE-OUT ============ */}
      <Sheet open={legalPanel !== null} onOpenChange={(open) => !open && setLegalPanel(null)}>
        <SheetContent side="right" className="flex w-full sm:max-w-[480px] flex-col p-0 [&>button]:hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center gap-2">
              {legalPanel === "privacy" ? (
                <Shield className="w-4 h-4" style={{ color: BRAND.sky }} />
              ) : (
                <FileText className="w-4 h-4" style={{ color: BRAND.sky }} />
              )}
              <span className="text-sm font-semibold" style={{ color: BRAND.ink }}>
                {legalPanel === "privacy" ? "Privacy Policy" : "Terms & Conditions"}
              </span>
            </div>
            <button
              onClick={() => setLegalPanel(null)}
              className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[#FBFBF9]"
              style={{ color: BRAND.mist }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
            {legalPanel === "privacy" ? <PrivacyContent /> : <TermsContent />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ---- Legal copy ----
const LegalH2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-5 mb-2 text-[0.95rem] font-semibold" style={{ color: BRAND.ink, ...display }}>{children}</h2>
);

const TermsContent = () => (
  <div className="space-y-3">
    <p className="text-xs" style={{ color: BRAND.mist }}>Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
    <p>Welcome to ReportAir. By accessing or using our service you agree to be bound by these Terms & Conditions. Please read them carefully.</p>
    <LegalH2>1. Use of the service</LegalH2>
    <p>ReportAir provides photo capture, organisation, and reporting tools for event production teams. You agree to use the service only for lawful purposes and in accordance with these terms.</p>
    <LegalH2>2. Accounts</LegalH2>
    <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
    <LegalH2>3. Content & ownership</LegalH2>
    <p>You retain ownership of all photos, notes, and content you upload. You grant ReportAir a limited licence to host and process this content solely to deliver the service to you.</p>
    <LegalH2>4. Subscriptions & billing</LegalH2>
    <p>Paid plans are billed in advance on a monthly or annual basis. Trials convert automatically unless cancelled before the trial ends.</p>
    <LegalH2>5. Termination</LegalH2>
    <p>You may cancel at any time from your billing settings. We may suspend or terminate accounts that violate these terms.</p>
    <LegalH2>6. Disclaimer</LegalH2>
    <p>The service is provided "as is" without warranties of any kind. ReportAir is not liable for indirect or consequential damages arising from use of the service.</p>
    <LegalH2>7. Contact</LegalH2>
    <p>Questions about these terms? Contact us at hello@reportair.co.</p>
  </div>
);

const PrivacyContent = () => (
  <div className="space-y-3">
    <p className="text-xs" style={{ color: BRAND.mist }}>Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
    <p>This Privacy Policy explains how ReportAir collects, uses, and protects your information when you use our service.</p>
    <LegalH2>1. Information we collect</LegalH2>
    <p>Account details (name, email), uploaded photos and notes, project metadata, and basic usage analytics needed to operate and improve the service.</p>
    <LegalH2>2. How we use it</LegalH2>
    <p>To provide, maintain, and improve ReportAir, to process payments, to communicate service updates, and to keep the platform secure.</p>
    <LegalH2>3. Sharing</LegalH2>
    <p>We never sell your data. We share information only with trusted processors (hosting, payments, email delivery) under appropriate safeguards, or when required by law.</p>
    <LegalH2>4. Storage & security</LegalH2>
    <p>Data is stored on secure cloud infrastructure with encryption in transit. Access is restricted and audited.</p>
    <LegalH2>5. Your rights</LegalH2>
    <p>You may access, export, or delete your data at any time from your account settings, or by contacting us.</p>
    <LegalH2>6. Cookies</LegalH2>
    <p>We use essential cookies to keep you signed in and to remember preferences. We do not use third-party advertising cookies.</p>
    <LegalH2>7. Contact</LegalH2>
    <p>Privacy questions? Email hello@reportair.co.</p>
  </div>
);

// ---- Reusable bits ----
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 flex-none" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill={BRAND.skySoft} />
    <path d="M6 10.5l2.5 2.5L14 7.5" stroke={BRAND.sky} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);


export default Index;
