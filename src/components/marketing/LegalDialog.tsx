import { FileText, Shield, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { BRAND, display } from "./brand-tokens";
import type { LegalPanel } from "./MarketingFooter";

type LegalDialogProps = {
  panel: LegalPanel | null;
  onClose: () => void;
};

const LegalH2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-5 mb-2 text-[0.95rem] font-semibold" style={{ color: BRAND.ink, ...display }}>{children}</h2>
);

const TermsContent = () => (
  <div className="space-y-3">
    <p className="text-xs" style={{ color: BRAND.mist }}>Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
    <p>Welcome to BuildSlides. By accessing or using our service you agree to be bound by these Terms & Conditions. Please read them carefully.</p>
    <LegalH2>1. Use of the service</LegalH2>
    <p>BuildSlides provides photo capture, organisation, and reporting tools for event production teams. You agree to use the service only for lawful purposes and in accordance with these terms.</p>
    <LegalH2>2. Accounts</LegalH2>
    <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
    <LegalH2>3. Content & ownership</LegalH2>
    <p>You retain ownership of all photos, notes, and content you upload. You grant BuildSlides a limited licence to host and process this content solely to deliver the service to you.</p>
    <LegalH2>4. Subscriptions & billing</LegalH2>
    <p>Paid plans are billed in advance on a monthly or annual basis. Trials convert automatically unless cancelled before the trial ends.</p>
    <LegalH2>5. Termination</LegalH2>
    <p>You may cancel at any time from your billing settings. We may suspend or terminate accounts that violate these terms.</p>
    <LegalH2>6. Disclaimer</LegalH2>
    <p>The service is provided "as is" without warranties of any kind. BuildSlides is not liable for indirect or consequential damages arising from use of the service.</p>
    <LegalH2>7. Contact</LegalH2>
    <p>Questions about these terms? Contact us at hello@reportair.co.</p>
  </div>
);

const PrivacyContent = () => (
  <div className="space-y-3">
    <p className="text-xs" style={{ color: BRAND.mist }}>Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
    <p>This Privacy Policy explains how BuildSlides collects, uses, and protects your information when you use our service.</p>
    <LegalH2>1. Information we collect</LegalH2>
    <p>Account details (name, email), uploaded photos and notes, project metadata, and basic usage analytics needed to operate and improve the service.</p>
    <LegalH2>2. How we use it</LegalH2>
    <p>To provide, maintain, and improve BuildSlides, to process payments, to communicate service updates, and to keep the platform secure.</p>
    <LegalH2>3. Sharing</LegalH2>
    <p>We never sell your data. We share information only with trusted processors (hosting, payments, email delivery) under appropriate safeguards, or when required by law.</p>
    <LegalH2>4. Storage & security</LegalH2>
    <p>Data is stored on secure cloud infrastructure with encryption in transit. Access is restricted and audited.</p>
    <LegalH2>5. Your rights</LegalH2>
    <p>You may access, export, or delete your data at any time from your account settings, or by contacting us.</p>
    <LegalH2>6. Cookies</LegalH2>
    <p>We use essential cookies to keep you signed in and to remember preferences. We do not use third-party advertising cookies.</p>
    <LegalH2>7. Contact</LegalH2>
    <p>Privacy questions? Email hello@reportair.co.</p>
  </div>
);

// Right-side slide-out that shows either Terms or Privacy. Visibility is
// driven by `panel` — null hides, "terms" or "privacy" shows the matching
// content.
export function LegalDialog({ panel, onClose }: LegalDialogProps) {
  return (
    <Sheet open={panel !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full sm:max-w-[480px] flex-col p-0 [&>button]:hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BRAND.border }}>
          <div className="flex items-center gap-2">
            {panel === "privacy" ? (
              <Shield className="w-4 h-4" style={{ color: BRAND.sky }} />
            ) : (
              <FileText className="w-4 h-4" style={{ color: BRAND.sky }} />
            )}
            <span className="text-sm font-semibold" style={{ color: BRAND.ink }}>
              {panel === "privacy" ? "Privacy Policy" : "Terms & Conditions"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[#FBFBF9]"
            style={{ color: BRAND.mist }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
          {panel === "privacy" ? <PrivacyContent /> : <TermsContent />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
