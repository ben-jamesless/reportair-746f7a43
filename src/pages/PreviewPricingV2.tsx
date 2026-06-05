import { useState } from "react";
import PricingSectionV2 from "@/components/marketing/PricingSectionV2";
import ComparePlansV2 from "@/components/marketing/ComparePlansV2";
import LogosStripV2 from "@/components/marketing/LogosStripV2";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter, type LegalPanel } from "@/components/marketing/MarketingFooter";
import { LegalDialog } from "@/components/marketing/LegalDialog";

/**
 * Draft V2 pricing page. Hidden route: /preview/pricing-v2.
 * Mirrors the paper canvas used on /preview/home-v2.
 */
const PreviewPricingV2 = () => {
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);

  return (
    <div className="min-h-screen bs-paper-grid text-foreground" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
      <MarketingHeader />
      <PricingSectionV2 />
      <ComparePlansV2 />
      <LogosStripV2 />
      <MarketingFooter onOpenLegal={setLegalPanel} />
      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
};

export default PreviewPricingV2;
