import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import HeroSection from "@/components/marketing/HeroSection";
import HowItWorksSection from "@/components/marketing/HowItWorksSection";
import FAQSection from "@/components/marketing/FAQSection";
import TimeSavedSection from "@/components/marketing/TimeSavedSection";
import UseCasesSection from "@/components/marketing/UseCasesSection";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter, type LegalPanel } from "@/components/marketing/MarketingFooter";
import { PricingSection } from "@/components/marketing/PricingSection";
import { LegalDialog } from "@/components/marketing/LegalDialog";
import { BRAND, body, display } from "@/components/marketing/brand-tokens";

// Marketing copy that remains in this file (Reviews + Final CTA — the
// only sections still rendered inline). Section-specific copy lives in
// each extracted section.
const COPY = {
  reviews: {
    eyebrow: "Early users",
    title: "Built for teams who need the client to see the work, not the chaos.",
    items: [
      {
        quote: "​I saved hours not having to chase my team for photo updates and then sort them into a presentation to send. ",
        name: "Rob McIntyre",
        role: "Tournament Director ",
      },
      {
        quote: "Done at the click of a button. Not only that but with the share link the client saw updates in realtime. ",
        name: "Ben Lee",
        role: "Operations Director ",
      },
      {
        quote: "Not only was the report professional looking, we now have records on-hand to look back on each year moving forward.",
        name: "Sarah Mitchell",
        role: "Event Producer ",
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

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);

  useEffect(() => {
    if (!loading && user) navigate("/projects", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.fog, color: BRAND.ink, ...body }}>
      <MarketingHeader />

      <HeroSection />

      <div id="how-it-works"><HowItWorksSection /></div>

      <TimeSavedSection />

      <UseCasesSection />

      {/* ============ REVIEWS ============ */}
      <section id="reviews" className="py-[34px] md:py-[68px]" style={{ background: "#0F1417" }}>
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <header className="mx-auto mb-12 max-w-3xl text-center">
            <span className="mb-3 inline-block text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "#D94F2A" }}>
              {COPY.reviews.eyebrow}
            </span>
            <h2 className="text-2xl font-extrabold sm:text-4xl" style={{ ...display, color: "#FFFFFF", lineHeight: 1.15 }}>
              {COPY.reviews.title}
            </h2>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            {COPY.reviews.items.map((item, i) => (
              <figure
                key={i}
                className="flex flex-col rounded-2xl p-6"
                style={{
                  background: "linear-gradient(135deg, rgba(26,32,37,0.95), rgba(15,20,23,0.85))",
                  border: "1px solid rgba(217,79,42,0.14)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.35)",
                }}
              >
                <div className="text-5xl leading-none" style={{ ...display, color: BRAND.sky }}>"</div>
                <blockquote className="mt-2 flex-1 text-[0.98rem]" style={{ color: "#FFFFFF", lineHeight: 1.55 }}>
                  {item.quote}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full"
                    style={{ background: "rgba(217,79,42,0.18)", border: "1px solid rgba(217,79,42,0.4)" }}
                  />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>{item.name}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{item.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <div id="faq"><FAQSection /></div>

      <PricingSection />

      {/* ============ FINAL CTA ============ */}
      <section id="cta" className="relative overflow-hidden py-[34px] sm:py-[41px] md:py-[82px]" style={{ background: BRAND.ink }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 80% 20%, rgba(217,79,42,.25), transparent 60%), radial-gradient(40% 50% at 10% 90%, rgba(217,79,42,.18), transparent 60%)",
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
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const input = form.querySelector("input[type=email]") as HTMLInputElement | null;
              const btn = form.querySelector("button") as HTMLButtonElement | null;
              const email = input?.value?.trim();
              if (!email || !btn) return;
              btn.disabled = true;
              const originalText = btn.textContent;
              btn.textContent = "Adding…";
              try {
                const { error } = await supabase.functions.invoke("newsletter-signup", {
                  body: { email, source: "marketing_final_cta" },
                });
                if (error) throw error;
                btn.textContent = "Thanks — you're on the list";
                if (input) input.value = "";
              } catch (err) {
                console.error(err);
                btn.textContent = "Something went wrong — try again";
                btn.disabled = false;
                setTimeout(() => { if (btn) btn.textContent = originalText ?? "Join"; }, 3000);
              }
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

      <MarketingFooter onOpenLegal={setLegalPanel} />

      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
};

export default Index;
