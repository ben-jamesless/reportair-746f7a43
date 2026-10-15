import { useEffect, useState } from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter, type LegalPanel } from "@/components/marketing/MarketingFooter";
import { LegalDialog } from "@/components/marketing/LegalDialog";
import { EarlyAccessForm } from "@/components/marketing/EarlyAccessForm";

export default function PreviewPricingV2() {
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);
  useEffect(() => { document.title = "Coming soon — BuildFolder beta"; }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:py-20">
        <header className="mb-10 text-center">
          <p className="mb-5 font-mono text-xs uppercase text-primary">BuildFolder · Private beta</p>
          <h1 className="text-4xl font-black sm:text-5xl">Coming soon</h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">We’re testing BuildFolder across real events before opening to the public. Want to be part of the beta? Request early access below.</p>
        </header>
        <div className="mx-auto max-w-md" id="request-access"><EarlyAccessForm /></div>
      </main>
      <MarketingFooter onOpenLegal={setLegalPanel} />
      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
}
