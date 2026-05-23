import { useState } from "react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter, type LegalPanel } from "@/components/marketing/MarketingFooter";
import { LegalDialog } from "@/components/marketing/LegalDialog";
import { BRAND, body, display } from "@/components/marketing/brand-tokens";

const About = () => {
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.fog, color: BRAND.ink, ...body }}>
      <MarketingHeader />

      {/* Hero */}
      <section className="py-16 sm:py-24" style={{ background: BRAND.fog }}>
        <div className="mx-auto max-w-[860px] px-5 sm:px-6">
          <span
            className="mb-4 inline-block text-[11px] font-extrabold uppercase tracking-[0.14em]"
            style={{ color: BRAND.sky }}
          >
            About
          </span>
          <h1
            className="text-4xl font-extrabold sm:text-5xl"
            style={{ ...display, color: BRAND.ink, lineHeight: 1.1 }}
          >
            Reporting built for the build itself — not before, not after.
          </h1>
          <p className="mt-6 text-lg" style={{ color: BRAND.slate, lineHeight: 1.6 }}>
            BuildSlides is photo-first reporting for event and production teams who need to keep
            clients in the loop while the build is still happening.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="pb-16 sm:pb-24">
        <div className="mx-auto max-w-[760px] px-5 sm:px-6">
          <div
            className="rounded-2xl border bg-white p-8 sm:p-10"
            style={{ borderColor: BRAND.border }}
          >
            <h2
              className="text-2xl font-extrabold sm:text-3xl"
              style={{ ...display, color: BRAND.ink, lineHeight: 1.2 }}
            >
              Why we created BuildSlides
            </h2>
            <div
              className="mt-5 space-y-5 text-base sm:text-[1.05rem]"
              style={{ color: BRAND.slate, lineHeight: 1.7 }}
            >
              <p>
                BuildSlides was created by an Operations Director with 15 years of experience
                running large-scale event builds. After a decade and a half of late nights chasing
                photos from crew on-site, then stitching them into decks at midnight so clients
                could see progress the next morning, one thing became obvious: the reporting part
                of the job had never really been solved.
              </p>
              <p>
                There is plenty of software for what happens <em>before</em> a build — planning,
                scheduling, run-of-show, supplier management. And there is plenty of software for
                what happens <em>after</em> — debriefs, financial reconciliation, archival
                galleries. But during the build itself, when clients are most anxious and the team
                is most stretched, reporting still meant WhatsApp threads, screenshots, and
                hand-built PowerPoints.
              </p>
              <p>
                BuildSlides is the tool we wished existed: a single place where the team uploads
                photos as they work, the system organises them by day, area, and status, and the
                client gets a clean, branded report — either as a live share link or as a polished
                PDF — without anyone having to stay up making slides.
              </p>
              <p>
                It is built by people who have lived the problem, for people who are still living
                it. If that sounds familiar, we would love for you to try it.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth?tab=signup"
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: BRAND.sky }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND.deepSky)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND.sky)}
              >
                Start your first build
              </Link>
              <Link
                to="/#how-it-works"
                className="rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  color: BRAND.ink,
                  border: `1px solid ${BRAND.border}`,
                  backgroundColor: "#fff",
                }}
              >
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter onOpenLegal={setLegalPanel} />
      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
};

export default About;
