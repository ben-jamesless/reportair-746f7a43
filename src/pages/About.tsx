import { useState } from "react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter, type LegalPanel } from "@/components/marketing/MarketingFooter";
import { LegalDialog } from "@/components/marketing/LegalDialog";
import { LeadMagnetSection } from "@/components/marketing/LeadMagnetSection";
import { BRAND, body, display } from "@/components/marketing/brand-tokens";

const ORANGE = "#D94F2A";

const About = () => {
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);

  return (
    <div className="min-h-screen bs-paper-grid" style={{ backgroundColor: BRAND.paper, color: BRAND.ink, ...body }}>
      <MarketingHeader />

      <section>
        <div className="mx-auto max-w-[760px] px-5 py-16 sm:px-6 sm:py-24">
          <span
            className="mb-4 inline-block text-[11px] font-extrabold uppercase tracking-[0.14em]"
            style={{ color: ORANGE }}
          >
            About
          </span>
          <h1
            className="text-4xl font-extrabold sm:text-5xl"
            style={{ ...display, color: BRAND.ink, lineHeight: 1.1 }}
          >
            Reporting <span style={{ color: ORANGE }}>built for the build</span> itself — not before, not after.
          </h1>
          <p className="mt-6 text-lg" style={{ color: "rgba(15,20,23,.75)", lineHeight: 1.6 }}>
            BuildFolder is photo-first reporting for event and production teams who need to keep
            clients in the loop while the build is still happening.
          </p>

          <h2
            className="mt-14 text-2xl font-extrabold sm:text-3xl"
            style={{ ...display, color: BRAND.ink, lineHeight: 1.2 }}
          >
            Why we created BuildFolder
          </h2>
          <div
            className="mt-5 space-y-5 text-base sm:text-[1.05rem]"
            style={{ color: "rgba(15,20,23,.8)", lineHeight: 1.7 }}
          >
            <p>
              BuildFolder was built by an Operations Director who spent 15 years running
              large-scale event builds. Late nights chasing photos from on-site crew.
              Stitching them into decks at midnight. Sending them by morning so the client could
              see progress. After all of that, one thing was obvious: the reporting part of the
              job had never actually been solved
            </p>
            <p>
              There's plenty of software for what happens <em>before</em> a build — planning,
              scheduling, run-of-show, supplier management — and plenty for what comes{" "}
              <em>after</em>: debriefs, reconciliation, archival galleries. But during the build
              itself, when clients are most anxious and the team most stretched, reporting still
              meant WhatsApp threads, screenshots, and hand-built PowerPoints.
            </p>
            <p>
              BuildFolder is the tool we wished existed. The team uploads photos as they work,
              the system organises them by day, area, and status, and the client gets a clean,
              branded report — live share link or polished PDF — without anyone staying up
              making slides
            </p>
            <p>
              It is built by people who have lived the problem, for people who are still living
              it. If that sounds familiar, we would love for you to try it.
            </p>
            <p className="pt-2" style={{ ...display, color: BRAND.ink, fontWeight: 700 }}>
              {"\n"}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
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
                border: "1px solid rgba(15,20,23,0.18)",
                backgroundColor: "rgba(15,20,23,0.06)",
              }}
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <LeadMagnetSection />

      <MarketingFooter onOpenLegal={setLegalPanel} />
      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
};

export default About;
