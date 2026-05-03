import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Brand tokens (scoped to this marketing page only — do not touch app tokens)
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
};

const display = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/projects", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.fog, color: BRAND.slate, ...body }}>
      {/* Nav */}
      <header style={{ backgroundColor: BRAND.fog, borderBottom: `1px solid ${BRAND.border}` }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="text-lg font-bold tracking-tight" style={{ ...display, color: BRAND.ink }}>
            REPORTAIR
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5">
            <Link
              to="/auth"
              className="text-sm font-medium hover:underline"
              style={{ color: BRAND.sky }}
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-full px-4 py-2 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: BRAND.sky }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.deepSky)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND.sky)}
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:py-32">
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
            style={{ ...display, color: BRAND.ink, lineHeight: 1.05 }}
          >
            Photo in. Report out.
          </h1>
          <p
            className="mx-auto mt-6 max-w-2xl text-base sm:text-lg"
            style={{ color: BRAND.slate, lineHeight: 1.6 }}
          >
            Capture what happens on site. Upload from your phone. Send a branded PDF
            to your client — the same day.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full px-7 py-3 text-base font-medium text-white transition-colors"
              style={{ backgroundColor: BRAND.sky }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.deepSky)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND.sky)}
            >
              Get started free
            </Link>
            <Link to="/auth" className="text-sm font-medium" style={{ color: BRAND.sky }}>
              Sign in →
            </Link>
          </div>
        </section>

        {/* Three-step flow */}
        <section style={{ backgroundColor: BRAND.cloud }}>
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2
              className="text-center text-2xl font-semibold"
              style={{ ...display, color: BRAND.ink }}
            >
              How it works
            </h2>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <Step n="01" title="Capture" desc="Photograph every area of your event on your phone or camera" />
              <Step n="02" title="Upload" desc="Assign photos to areas and days as you go — even with poor signal" />
              <Step n="03" title="Export" desc="Generate a branded PDF report and share with your client instantly" />
            </div>
          </div>
        </section>

        {/* Closing CTA strip */}
        <section style={{ backgroundColor: BRAND.sky }}>
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-5 py-16 text-center">
            <h3
              className="text-2xl font-bold text-white sm:text-[28px]"
              style={{ ...display, lineHeight: 1.2 }}
            >
              From the field. In the air. Every time.
            </h3>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-base font-medium transition-opacity hover:opacity-90"
              style={{ color: BRAND.sky }}
            >
              Create your free account
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

const Step = ({ n, title, desc }: { n: string; title: string; desc: string }) => (
  <div
    className="rounded-2xl bg-white p-7"
    style={{ border: `1px solid ${BRAND.border}` }}
  >
    <div
      className="text-5xl font-bold leading-none"
      style={{ ...display, color: BRAND.skySoft }}
    >
      {n}
    </div>
    <h3
      className="mt-5 text-lg font-semibold"
      style={{ ...display, color: BRAND.ink }}
    >
      {title}
    </h3>
    <p className="mt-2 text-[15px]" style={{ color: BRAND.slate, lineHeight: 1.55 }}>
      {desc}
    </p>
  </div>
);

export default Index;
