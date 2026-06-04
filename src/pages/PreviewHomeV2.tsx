import { useState } from "react";
import HeroSectionV2 from "@/components/marketing/HeroSectionV2";
import HowItWorksSectionV2 from "@/components/marketing/HowItWorksSectionV2";
import TimeSavedSection from "@/components/marketing/TimeSavedSection";
import UseCasesSection from "@/components/marketing/UseCasesSection";
import FAQSection from "@/components/marketing/FAQSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter, type LegalPanel } from "@/components/marketing/MarketingFooter";
import { LegalDialog } from "@/components/marketing/LegalDialog";

/**
 * Draft preview of the re-skinned homepage on the paper/dotted canvas.
 * Hidden route: /preview/home-v2. Not linked from nav, not indexed.
 * Once approved, contents move into src/pages/Index.tsx.
 */
const PreviewHomeV2 = () => {
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);

  return (
    <div className="min-h-screen bs-paper-grid text-foreground" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
      <MarketingHeader />
      <HeroSectionV2 />
      <HowItWorksSectionV2 />
      <TimeSavedSection />
      <UseCasesSection />
      <div id="faq"><FAQSection /></div>
      <PricingSection />
      <MarketingFooter onOpenLegal={setLegalPanel} />
      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
};

export default PreviewHomeV2;
