import { useState } from "react";
import HeroSectionV2 from "@/components/marketing/HeroSectionV2";
import LogosStripV2 from "@/components/marketing/LogosStripV2";
import HowItWorksSectionV2 from "@/components/marketing/HowItWorksSectionV2";
import WhyWeBuiltV2 from "@/components/marketing/WhyWeBuiltV2";
import WhyBuildFolderV2 from "@/components/marketing/WhyBuildFolderV2";

import UseCasesSection from "@/components/marketing/UseCasesSection";
import FAQSection from "@/components/marketing/FAQSection";
import { LeadMagnetSection } from "@/components/marketing/LeadMagnetSection";

import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter, type LegalPanel } from "@/components/marketing/MarketingFooter";
import { LegalDialog } from "@/components/marketing/LegalDialog";

/**
 * Draft preview of the re-skinned homepage on the paper/dotted canvas.
 * Hidden route: /preview/home-v2.
 *
 * `.bs-paper-skin` overrides the inline dark backgrounds on the shared
 * UseCases / FAQ / Pricing sections so they render on the paper canvas.
 * TimeSaved keeps its dark band as a deliberate accent.
 */
const PreviewHomeV2 = () => {
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);

  return (
    <div className="min-h-screen bs-paper-grid text-foreground" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
      <style>{`
        /* Convert dark UseCases / FAQ / Pricing to paper for V2 preview only. */
        .bs-paper-skin .uc-on-paper,
        .bs-paper-skin .faq-on-paper,
        .bs-paper-skin .pricing-on-paper { background: transparent !important; }

        /* Tunnel into the actual sections (which use inline background colors). */
        .bs-paper-skin section[style*="#0F1417"]:not(.keep-dark) { background: transparent !important; }

        /* Lighten white text on paper bg inside these sections */
        .bs-paper-skin .force-light-text,
        .bs-paper-skin .force-light-text * { color: #0F1417 !important; }
      `}</style>
      <MarketingHeader />
      <HeroSectionV2 />
      <LogosStripV2 />
      <HowItWorksSectionV2 />
      <WhyWeBuiltV2 />
      <div className="keep-dark-wrap"><UseCasesSection /></div>
      <WhyBuildFolderV2 />
      
      <FaqOnPaper><div id="faq"><FAQSection /></div></FaqOnPaper>
      <MarketingFooter onOpenLegal={setLegalPanel} />
      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
};

/**
 * FAQ: section is all text on dark. On paper we flip the section bg
 * to transparent and recolor every white/translucent-white text to ink/mute.
 */
const FaqOnPaper = ({ children }: { children: React.ReactNode }) => (
  <div className="paper-faq">
    <style>{`
      .paper-faq > div > section { background: transparent !important; }

      /* Headline + question text: solid white → ink */
      .paper-faq [style*="color: #ffffff"],
      .paper-faq [style*="color:#ffffff"],
      .paper-faq [style*="color: #fff"],
      .paper-faq [style*="color:#fff"],
      .paper-faq [style*="color: rgb(255, 255, 255)"] { color: #0F1417 !important; }

      /* Sub copy / answer text: translucent white → muted ink */
      .paper-faq [style*="rgba(255,255,255,0.5)"],
      .paper-faq [style*="rgba(255, 255, 255, 0.5)"],
      .paper-faq [style*="rgba(255,255,255,0.4)"],
      .paper-faq [style*="rgba(255, 255, 255, 0.4)"] { color: #4A4A45 !important; }

      /* Divider lines */
      .paper-faq [style*="rgba(255,255,255,0.07)"],
      .paper-faq [style*="rgba(255, 255, 255, 0.07)"] { border-color: #D9D4C5 !important; }

      /* Plus/minus circle inactive border + color */
      .paper-faq [style*="rgba(255,255,255,0.15)"] { border-color: #C9C3B3 !important; }
    `}</style>
    {children}
  </div>
);

/**
 * Pricing: keep dark cards (white text on dark stays readable), only
 * recolor the section header, toggle, and section background.
 */
const PricingOnPaper = ({ children }: { children: React.ReactNode }) => (
  <div className="paper-pricing">
    <style>{`
      .paper-pricing > section { background: transparent !important; }

      /* Section title + sub (the only text outside the dark <article> cards) */
      .paper-pricing > section > div > header h2 { color: #0F1417 !important; }
      .paper-pricing > section > div > header p  { color: #4A4A45 !important; }

      /* Monthly / Annual toggle labels live outside cards */
      .paper-pricing > section > div > div .text-white { color: #0F1417 !important; }
      .paper-pricing > section > div > div .text-white\\/50 { color: rgba(15,20,23,0.5) !important; }
    `}</style>
    {children}
  </div>
);


export default PreviewHomeV2;
