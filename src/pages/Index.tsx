import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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
  nav: { product: "Product", reviews: "Reviews", pricing: "Pricing", cta: "Join early access" },
  hero: {
    eyebrow: "From the field. In the air. Every time.",
    headlineStart: "Client-ready event build reports in ",
    headlineAccent: "10 minutes.",
    sub: "Capture and sort site photos. Export a polished PDF or client-safe link in minutes.",
    primary: "Join the early access list",
    secondary: "See example report →",
    proof: [
      "Built for event builds, activations, festivals, sports events & temporary sites",
      "Photo-first reporting by date, area & issue",
      "Share as a branded PDF or client-safe link",
    ],
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
      title: "Take the photos once. Keep the build organised as it happens.",
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
      "ReportAir helped us turn a full day of site photos and notes into a client update before we left the venue.",
      "The client could see progress every day without calling for another status check.",
      "The report was already structured because the photos had been sorted properly during the build.",
    ],
  },
  pricing: {
    title: "Simple pricing for event teams.",
    sub: "Start with one event, then scale across your builds, activations, and client reports.",
    plans: [
      {
        name: "Starter",
        best: "Freelancers & small event teams",
        price: "TBC",
        per: "per month",
        features: ["1 active event", "Daily reports", "Photo tagging", "PDF export"],
        cta: "Join early access",
        featured: false,
      },
      {
        name: "Team",
        best: "Agencies & production teams",
        price: "TBC",
        per: "per month",
        features: ["Multiple active events", "Branded reports", "Weekly summaries", "Client-safe links", "Team access"],
        cta: "Join early access",
        featured: true,
        flag: "Most teams start here",
      },
      {
        name: "Studio",
        best: "High-volume event operators",
        price: "TBC",
        per: "per month",
        features: ["Advanced templates", "Custom branding", "Priority support", "Account-level reporting"],
        cta: "Talk to us",
        featured: false,
      },
    ],
    note: "Pricing is being finalized with early users. Join the early access list to help shape the plans and lock in early pricing.",
  },
  finalCta: {
    title: "Your next client report should not start from a blank deck.",
    sub: "Capture and sort the build as it happens. Export the client-ready report in minutes.",
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
            <a href="#product" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>Product</a>
            <a href="#reviews" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>Reviews</a>
            <a href="#pricing" className="text-sm font-medium transition-colors" style={{ color: BRAND.slate }}>Pricing</a>
          </nav>
          <a
            href="#cta"
            className="rounded-full px-3.5 py-2 text-[0.88rem] font-semibold text-white transition-colors"
            style={{ backgroundColor: BRAND.sky }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.deepSky)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND.sky)}
          >
            {COPY.nav.cta}
          </a>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: `radial-gradient(70% 70% at 92% 28%, rgba(26,110,255,.20), transparent 58%), ${BRAND.ink}`,
        }}
      >
        {/* grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(26,110,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(26,110,255,.055) 1px, transparent 1px)",
            backgroundSize: "104px 104px",
          }}
        />
        {/* top accent stripe */}
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background: `repeating-linear-gradient(90deg, rgba(13,71,181,.95) 0 1px, transparent 1px 78px), ${BRAND.sky}`,
          }}
        />

        <div className="relative mx-auto grid max-w-[1520px] items-center gap-10 px-5 pb-20 pt-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pb-24 lg:pt-28">
          {/* Copy */}
          <div className="lg:pl-2 xl:pl-6">
            <span className="mb-3.5 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "#9DBDFF" }}>
              {COPY.hero.eyebrow}
            </span>
            <h1
              className="text-[2.4rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[clamp(2.6rem,4.6vw,4rem)]"
              style={display}
            >
              {COPY.hero.headlineStart}
              <span style={{ color: BRAND.sky }}>{COPY.hero.headlineAccent}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base sm:text-lg" style={{ color: "rgba(237,241,247,.82)", lineHeight: 1.6 }}>
              {COPY.hero.sub}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#cta"
                className="rounded-full px-5 py-3 text-[0.95rem] font-semibold text-white transition-colors"
                style={{ backgroundColor: BRAND.sky }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.deepSky)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND.sky)}
              >
                {COPY.hero.primary}
              </a>
              <a
                href="#product"
                className="rounded-full border px-5 py-3 text-[0.95rem] font-semibold text-white transition-colors hover:bg-white/10"
                style={{ borderColor: "rgba(208,217,232,.36)" }}
              >
                {COPY.hero.secondary}
              </a>
            </div>
            <ul className="mt-7 space-y-2 text-[0.94rem]" style={{ color: "rgba(237,241,247,.78)" }}>
              {COPY.hero.proof.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full" style={{ background: BRAND.sky }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual */}
          <HeroVisual />
        </div>
      </section>

      {/* ============ METRIC ============ */}
      <section style={{ background: BRAND.cloud, borderBottom: `1px solid ${BRAND.border}` }}>
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-16 sm:px-6 md:grid-cols-[auto_1fr] md:gap-14">
          <div className="flex items-baseline gap-3">
            <span className="text-[6rem] font-extrabold leading-none tracking-tight sm:text-[8rem]" style={{ ...display, color: BRAND.sky }}>
              {COPY.metric.big}
            </span>
            <span className="text-2xl font-bold sm:text-3xl" style={{ ...display, color: BRAND.ink }}>
              {COPY.metric.unit}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl" style={{ ...display, color: BRAND.ink }}>
              {COPY.metric.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base" style={{ color: BRAND.slate, lineHeight: 1.6 }}>
              {COPY.metric.desc}
            </p>
          </div>
        </div>
      </section>

      {/* ============ PRODUCT FEATURES ============ */}
      <section id="product" className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] space-y-24 px-5 sm:px-6">
          {COPY.features.map((f, i) => (
            <article
              key={f.step}
              className={`grid items-center gap-10 lg:gap-16 ${i % 2 === 1 ? "lg:grid-cols-[1fr_1fr]" : "lg:grid-cols-[1fr_1fr]"}`}
            >
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: BRAND.deepSky }}>
                  {f.step}
                </span>
                <h3 className="mt-3 text-2xl font-bold sm:text-3xl" style={{ ...display, color: BRAND.ink, lineHeight: 1.2 }}>
                  {f.title}
                </h3>
                <p className="mt-4 text-base" style={{ color: BRAND.slate, lineHeight: 1.6 }}>
                  {f.desc}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {f.checks.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-[0.95rem]" style={{ color: BRAND.slate }}>
                      <CheckIcon />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                {i === 0 ? <CaptureMock /> : <ReportMock />}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ REVIEWS ============ */}
      <section id="reviews" className="py-20" style={{ background: BRAND.cloud }}>
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <header className="mx-auto mb-12 max-w-3xl text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: BRAND.deepSky }}>
              {COPY.reviews.eyebrow}
            </span>
            <h2 className="text-2xl font-extrabold sm:text-4xl" style={{ ...display, color: BRAND.ink, lineHeight: 1.15 }}>
              {COPY.reviews.title}
            </h2>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            {COPY.reviews.items.map((q, i) => (
              <figure
                key={i}
                className="flex flex-col rounded-2xl bg-white p-6"
                style={{ border: `1px solid ${BRAND.border}` }}
              >
                <div className="text-5xl leading-none" style={{ ...display, color: BRAND.sky }}>"</div>
                <blockquote className="mt-2 flex-1 text-[0.98rem]" style={{ color: BRAND.ink, lineHeight: 1.55 }}>
                  {q}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full" style={{ background: BRAND.skySoft, border: `1px solid ${BRAND.border}` }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: BRAND.ink }}>Name Surname</div>
                    <div className="text-xs" style={{ color: BRAND.mist }}>Role · Company</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <header className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold sm:text-4xl" style={{ ...display, color: BRAND.ink, lineHeight: 1.15 }}>
              {COPY.pricing.title}
            </h2>
            <p className="mt-3 text-base" style={{ color: BRAND.slate }}>
              {COPY.pricing.sub}
            </p>
          </header>

          <div className="grid items-stretch gap-6 md:grid-cols-3">
            {COPY.pricing.plans.map((p) => {
              const isFeatured = p.featured;
              return (
                <article
                  key={p.name}
                  className={`relative flex flex-col rounded-2xl p-7 transition-transform ${isFeatured ? "md:scale-[1.06] md:py-8" : ""}`}
                  style={{
                    background: isFeatured ? "#fff" : "#fff",
                    border: `1px solid ${isFeatured ? BRAND.sky : BRAND.border}`,
                    boxShadow: isFeatured
                      ? "0 24px 60px -28px rgba(26,110,255,.45), 0 4px 14px rgba(15,23,36,.06)"
                      : "0 1px 2px rgba(15,23,36,.04)",
                  }}
                >
                  {isFeatured && p.flag && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-white"
                      style={{ background: BRAND.sky }}
                    >
                      {p.flag}
                    </span>
                  )}
                  <header className="mb-4">
                    <h3 className="text-xl font-bold" style={{ ...display, color: BRAND.ink }}>{p.name}</h3>
                    <p className="mt-1 text-sm" style={{ color: BRAND.mist }}>{p.best}</p>
                  </header>
                  <div className="mb-5 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold" style={{ ...display, color: BRAND.ink }}>{p.price}</span>
                    <span className="text-sm" style={{ color: BRAND.mist }}>{p.per}</span>
                  </div>
                  <ul className="mb-7 flex-1 space-y-2.5 text-[0.95rem]" style={{ color: BRAND.slate }}>
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckIcon />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#cta"
                    className="block w-full rounded-full px-5 py-3 text-center text-[0.95rem] font-semibold transition-colors"
                    style={
                      isFeatured
                        ? { background: BRAND.sky, color: "#fff" }
                        : { background: "transparent", color: BRAND.ink, border: `1px solid ${BRAND.border2}` }
                    }
                    onMouseEnter={(e) => {
                      if (isFeatured) e.currentTarget.style.background = BRAND.deepSky;
                    }}
                    onMouseLeave={(e) => {
                      if (isFeatured) e.currentTarget.style.background = BRAND.sky;
                    }}
                  >
                    {p.cta}
                  </a>
                </article>
              );
            })}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm" style={{ color: BRAND.mist }}>
            {COPY.pricing.note}
          </p>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section id="cta" className="relative overflow-hidden py-20 sm:py-24" style={{ background: BRAND.ink }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 80% 20%, rgba(26,110,255,.25), transparent 60%), radial-gradient(40% 50% at 10% 90%, rgba(26,110,255,.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl" style={{ ...display, lineHeight: 1.15 }}>
            {COPY.finalCta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "rgba(237,241,247,.8)" }}>
            {COPY.finalCta.sub}
          </p>
          <form
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
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
              className="h-12 flex-1 rounded-full border px-5 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/60"
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
          <nav className="flex gap-5 text-sm" style={{ color: "rgba(237,241,247,.7)" }}>
            <a href="#product">Product</a>
            <a href="#pricing">Pricing</a>
            <a href="#cta">Early access</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};

// ---- Reusable bits ----
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 flex-none" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill={BRAND.skySoft} />
    <path d="M6 10.5l2.5 2.5L14 7.5" stroke={BRAND.sky} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ---- Hero visual: inputs → polished summary card ----
const HeroVisual = () => (
  <div className="relative">
    {/* right accent guide (desktop) */}
    <div
      aria-hidden
      className="pointer-events-none absolute -right-2 top-0 hidden h-full w-24 lg:block"
      style={{
        borderRight: `3px solid ${BRAND.sky}`,
        borderLeft: `1px solid rgba(26,110,255,.42)`,
        opacity: 0.85,
        transform: "translateX(40%)",
      }}
    />
    <div className="relative grid items-stretch gap-4 sm:grid-cols-[minmax(180px,_0.9fr)_36px_minmax(0,_1.4fr)]">
      {/* Inputs */}
      <div className="flex flex-col justify-center gap-2.5">
        <div className="mb-2 flex justify-end">
          <span
            className="rounded-full border px-3 py-1.5 text-[0.7rem] font-bold text-white"
            style={{ background: "rgba(232,240,255,.16)", borderColor: "rgba(232,240,255,.28)" }}
          >
            Before ReportAir
          </span>
        </div>
        <SourceCard color="#25D366" label="WhatsApp" sub="47 build updates" badge="47" rounded />
        <SourceCard color={BRAND.sky} label="Photos" sub="38 site images" />
        <SourceCard color="#16875C" label="Excel" sub="Progress tracker" letter="X" />
        <SourceCard color="#2478D4" label="Email" sub="Client status requests" badge="3" />
      </div>

      {/* Arrows */}
      <div
        className="hidden items-center justify-center sm:flex"
        style={{ color: BRAND.sky, filter: "drop-shadow(0 0 14px rgba(26,110,255,.35))" }}
      >
        <div className="flex flex-col gap-6">
          {[0, 1, 2, 3].map((i) => (
            <svg key={i} viewBox="0 0 58 20" width="48" height="18" aria-hidden="true">
              <path d="M3 10 H48 M40 3 L50 10 L40 17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
        </div>
      </div>

      {/* Summary card */}
      <div
        className="rounded-xl bg-white p-3 shadow-2xl"
        style={{ border: `1px solid ${BRAND.border}`, boxShadow: "0 28px 70px -42px rgba(0,0,0,.55)" }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: BRAND.mist }}>
            Daily build report
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[0.65rem] font-bold"
            style={{ background: BRAND.skySoft, color: BRAND.deepSky }}
          >
            After ReportAir
          </span>
        </div>
        <div
          className="overflow-hidden rounded-xl"
          style={{
            border: `1px solid ${BRAND.border}`,
            background: `linear-gradient(180deg, rgba(232,240,255,.78), rgba(255,255,255,0) 38%), #fff`,
          }}
        >
          <div className="flex items-center gap-2.5 px-4 pt-4 text-[0.78rem] font-extrabold" style={{ ...display, color: BRAND.deepSky }}>
            <BrandMark size={22} />
            <span>Northstar Festival · Day 3</span>
          </div>
          <div className="px-5 pt-3">
            <span className="block text-[0.65rem] font-extrabold uppercase tracking-widest" style={{ color: BRAND.mist }}>
              Ready to share in 10 minutes
            </span>
            <h3 className="mt-1 text-2xl font-extrabold tracking-tight" style={{ ...display, color: BRAND.ink, lineHeight: 1.12 }}>
              Build is on track.
            </h3>
            <p className="mt-1.5 text-[0.92rem]" style={{ color: BRAND.slate, lineHeight: 1.45 }}>
              Main stage rigging is complete. VIP tent delivery was re-routed. Power test and signage install are scheduled for tomorrow.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 px-5 pt-3">
            {[
              ["47", "photos sorted"],
              ["3", "areas updated"],
              ["1", "issue flagged"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-lg bg-white p-2.5" style={{ border: `1px solid ${BRAND.border}` }}>
                <strong className="block text-base font-extrabold leading-none" style={{ ...display, color: BRAND.ink }}>{n}</strong>
                <span className="mt-1 block text-[0.6rem]" style={{ color: BRAND.mist }}>{l}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 px-5 pt-3" style={{ gridTemplateColumns: "1.2fr 1fr 1fr" }}>
            {[
              "linear-gradient(135deg,#c9d4cf,#8fa19a)",
              "linear-gradient(135deg,#d8c9a8,#b39d72)",
              "linear-gradient(135deg,#bcc7d3,#8aa0b8)",
            ].map((bg, i) => (
              <div key={i} className="rounded-lg" style={{ minHeight: 86, background: bg, border: `1px solid ${BRAND.border}` }} />
            ))}
          </div>
          <div
            className="mt-3 flex items-center gap-2 px-5 pb-4 pt-3 text-[0.78rem] font-semibold"
            style={{ color: BRAND.deepSky, borderTop: `1px solid ${BRAND.border}` }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: BRAND.sky }} />
            Client update ready as PDF or share link
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SourceCard = ({
  color,
  label,
  sub,
  badge,
  letter,
  rounded,
}: {
  color: string;
  label: string;
  sub: string;
  badge?: string;
  letter?: string;
  rounded?: boolean;
}) => (
  <div
    className="flex items-center gap-3 rounded-xl bg-white p-3"
    style={{ border: `1px solid rgba(208,217,232,.92)`, boxShadow: "0 12px 24px -20px rgba(0,0,0,.7)" }}
  >
    <span
      className="relative grid h-8 w-8 flex-none place-items-center text-xs font-extrabold text-white"
      style={{ background: color, borderRadius: rounded ? 999 : 9 }}
    >
      {letter ?? ""}
      {badge && (
        <span
          className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white px-1 text-[0.55rem] font-extrabold text-white"
          style={{ background: BRAND.alert }}
        >
          {badge}
        </span>
      )}
    </span>
    <span className="leading-tight">
      <strong className="block text-[0.82rem]" style={{ color: BRAND.ink }}>{label}</strong>
      <small className="block text-[0.7rem]" style={{ color: BRAND.mist }}>{sub}</small>
    </span>
  </div>
);

// ---- Capture mock (laptop + iPad) ----
const CaptureMock = () => (
  <div className="relative">
    <div
      className="rounded-2xl bg-white p-3 shadow-xl"
      style={{ border: `1px solid ${BRAND.border}` }}
    >
      <div className="overflow-hidden rounded-lg" style={{ border: `1px solid ${BRAND.border}` }}>
        <div
          className="flex items-center justify-between px-4 py-2 text-[0.72rem] font-semibold"
          style={{ background: BRAND.cloud, color: BRAND.slate, borderBottom: `1px solid ${BRAND.border}` }}
        >
          <span>ReportAir</span>
          <span>Photo inbox</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-3 p-4">
          <aside className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-7 rounded-md" style={{ background: i === 1 ? BRAND.skySoft : BRAND.cloud }} />
            ))}
          </aside>
          <main>
            <div className="mb-3 text-[0.78rem] font-bold" style={{ ...display, color: BRAND.ink }}>Today's uploads</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                "linear-gradient(135deg,#c9d4cf,#8fa19a)",
                "linear-gradient(135deg,#d8c9a8,#b39d72)",
                "linear-gradient(135deg,#bcc7d3,#8aa0b8)",
                "linear-gradient(135deg,#d6c5b6,#a89887)",
                "linear-gradient(135deg,#b8c6d6,#7a8fa8)",
                "linear-gradient(135deg,#cdd6c8,#90a08a)",
              ].map((bg, i) => (
                <div key={i} className="aspect-[4/3] rounded-md" style={{ background: bg, border: `1px solid ${BRAND.border}` }} />
              ))}
            </div>
            <div
              className="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-[0.78rem]"
              style={{ background: BRAND.skySoft, color: BRAND.deepSky }}
            >
              <strong className="text-base font-extrabold" style={display}>38</strong>
              <span>photos sorted across 3 areas</span>
            </div>
          </main>
        </div>
      </div>
    </div>

    {/* iPad floating */}
    <div
      className="absolute -bottom-8 -right-2 hidden w-56 rounded-2xl bg-white p-3 shadow-2xl sm:block"
      style={{ border: `1px solid ${BRAND.border}`, boxShadow: "0 28px 60px -28px rgba(15,23,36,.4)" }}
    >
      <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${BRAND.border}` }}>
        <div className="flex items-center justify-between px-3 py-2 text-[0.7rem] font-semibold" style={{ background: BRAND.ink, color: "#fff" }}>
          <span>Build board</span>
          <small style={{ color: "#9DBDFF" }}>Live</small>
        </div>
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {["Main stage", "VIP", "Power"].map((c) => (
              <span key={c} className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold" style={{ background: BRAND.skySoft, color: BRAND.deepSky }}>
                {c}
              </span>
            ))}
          </div>
          <div className="aspect-[16/10] rounded-md" style={{ background: "linear-gradient(135deg,#bcc7d3,#8aa0b8)" }} />
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-2.5 rounded" style={{ background: BRAND.cloud, width: ["90%", "70%", "55%"][i] }} />
            ))}
          </div>
          <button className="w-full rounded-full py-2 text-[0.72rem] font-semibold text-white" style={{ background: BRAND.sky }}>
            Add to report
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ---- Report mock (browser-style document) ----
const ReportMock = () => (
  <div
    className="overflow-hidden rounded-2xl bg-white shadow-xl"
    style={{ border: `1px solid ${BRAND.border}`, boxShadow: "0 28px 60px -32px rgba(15,23,36,.45)" }}
  >
    <div
      className="flex items-center gap-2 px-4 py-2.5"
      style={{ background: BRAND.cloud, borderBottom: `1px solid ${BRAND.border}` }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FF5F57" }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28C840" }} />
      <span className="ml-3 truncate rounded-md px-3 py-1 text-[0.72rem]" style={{ background: "#fff", color: BRAND.mist, border: `1px solid ${BRAND.border}` }}>
        reportair.app/r/northstar-d3
      </span>
    </div>
    <div className="p-6">
      <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: BRAND.border }}>
        <BrandMark size={28} />
        <div>
          <div className="text-base font-extrabold" style={{ ...display, color: BRAND.ink }}>Daily build report</div>
          <div className="text-xs" style={{ color: BRAND.mist }}>Northstar Festival · Day 3 of 6</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: BRAND.mist }}>Today's summary</div>
        <div className="mt-2 space-y-1.5">
          <div className="h-2.5 rounded" style={{ background: BRAND.cloud, width: "100%" }} />
          <div className="h-2.5 rounded" style={{ background: BRAND.cloud, width: "70%" }} />
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: BRAND.mist }}>Photos by area</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[
            "linear-gradient(135deg,#c9d4cf,#8fa19a)",
            "linear-gradient(135deg,#d8c9a8,#b39d72)",
            "linear-gradient(135deg,#bcc7d3,#8aa0b8)",
            "linear-gradient(135deg,#d6c5b6,#a89887)",
          ].map((bg, i) => (
            <div key={i} className="aspect-[4/3] rounded-md" style={{ background: bg, border: `1px solid ${BRAND.border}` }} />
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        {["Completed", "Tomorrow"].map((label) => (
          <div key={label}>
            <div className="text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: BRAND.mist }}>{label}</div>
            <div className="mt-2 space-y-1.5">
              <div className="h-2.5 rounded" style={{ background: BRAND.cloud, width: "100%" }} />
              <div className="h-2.5 rounded" style={{ background: BRAND.cloud, width: "65%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Index;
