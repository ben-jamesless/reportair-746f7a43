import { useState } from "react";
import HeroSectionV2 from "@/components/marketing/HeroSectionV2";
import LogosStripV2 from "@/components/marketing/LogosStripV2";
import HowItWorksSectionV2 from "@/components/marketing/HowItWorksSectionV2";
import WhyWeBuiltV2 from "@/components/marketing/WhyWeBuiltV2";
import TimeSavedSection from "@/components/marketing/TimeSavedSection";
import UseCasesSection from "@/components/marketing/UseCasesSection";
import FAQSection from "@/components/marketing/FAQSection";
import { PricingSection } from "@/components/marketing/PricingSection";
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
      <div className="keep-dark-wrap"><PaperWrap><UseCasesSection /></PaperWrap></div>
      <TimeSavedSection />
      <PaperWrap><div id="faq"><FAQSection /></div></PaperWrap>
      <PaperWrap><PricingSection /></PaperWrap>
      <MarketingFooter onOpenLegal={setLegalPanel} />
      <LegalDialog panel={legalPanel} onClose={() => setLegalPanel(null)} />
    </div>
  );
};

/**
 * Recolors the wrapped (inline-styled-dark) section to paper:
 *  - transparent section bg
 *  - text/borders flipped for legibility on light canvas
 */
const PaperWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="paper-wrap">
    <style>{`
      .paper-wrap > section { background: transparent !important; }

      /* white text → ink (browsers normalize inline color to rgb(...)) */
      .paper-wrap [style*="color: #fff"],
      .paper-wrap [style*="color:#fff"],
      .paper-wrap [style*="color: #FFFFFF"],
      .paper-wrap [style*="color:#FFFFFF"],
      .paper-wrap [style*="color: #ffffff"],
      .paper-wrap [style*="color:#ffffff"],
      .paper-wrap [style*="color: rgb(255, 255, 255)"],
      .paper-wrap [style*="color: rgb(255,255,255)"] { color: #0F1417 !important; }

      .paper-wrap [style*="color: rgba(255, 255, 255, 0.7)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.7)"],
      .paper-wrap [style*="color: rgba(255, 255, 255, 0.65)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.65)"],
      .paper-wrap [style*="color: rgba(255, 255, 255, 0.6)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.6)"],
      .paper-wrap [style*="color: rgba(255, 255, 255, 0.55)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.55)"],
      .paper-wrap [style*="color: rgba(255, 255, 255, 0.5)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.5)"],
      .paper-wrap [style*="color: rgba(255, 255, 255, 0.45)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.45)"],
      .paper-wrap [style*="color: rgba(255, 255, 255, 0.4)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.4)"],
      .paper-wrap [style*="color: rgba(255, 255, 255, 0.35)"],
      .paper-wrap [style*="color: rgba(255,255,255,0.35)"] { color: #6B6B66 !important; }

      /* Subtle white-fill cards become paper cards */
      .paper-wrap [style*="background: rgba(255,255,255,0.04)"],
      .paper-wrap [style*="background: rgba(255,255,255,0.05)"],
      .paper-wrap [style*="background: rgba(255,255,255,0.06)"],
      .paper-wrap [style*="background: rgba(255,255,255,0.08)"] {
        background: #FFFFFF !important;
        border: 1px solid #E5E1D6 !important;
      }
      .paper-wrap [style*="border: 1px solid rgba(255,255,255,0.06)"],
      .paper-wrap [style*="border: 1px solid rgba(255,255,255,0.08)"],
      .paper-wrap [style*="border: 1px solid rgba(255,255,255,0.1)"],
      .paper-wrap [style*="border: 1px solid rgba(255,255,255,0.12)"] {
        border-color: #E5E1D6 !important;
      }

      /* Featured pricing card */
      .paper-wrap [style*="linear-gradient(135deg, rgba(26,32,37"] {
        background: #FFFFFF !important;
        border: 1px solid #E5E1D6 !important;
      }

      /* UseCases inner card */
      .paper-wrap [style*="linear-gradient(160deg, rgba(15,26,52"] {
        background: #FFFFFF !important;
      }
    `}</style>
    {children}
  </div>
);

export default PreviewHomeV2;
