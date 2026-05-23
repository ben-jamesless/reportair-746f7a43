// Share page branding footer.
// Hidden only when a Studio team has uploaded their logo AND enabled
// "Remove BuildSlides branding" in Team Settings.
//
// Free / Solo / Studio (default):  "Built by BuildSlides" + lockup SVG
// Crew (pro):                       "Built by [Team Name] · Powered by BuildSlides"

interface Props {
  teamPlan: string;
  teamLogoUrl?: string | null;
  teamName?: string | null;
  hideBranding?: boolean;
}

export function ShareBrandingFooter({ teamPlan, teamLogoUrl, teamName, hideBranding }: Props) {
  if (hideBranding) return null;



  const isCrew = teamPlan === "pro" || teamPlan === "team";

  return (
    <footer className="mt-16" style={{ background: "#0F1724" }}>
      <div
        className="flex items-center justify-center gap-2 py-6 text-xs"
        style={{ color: "rgba(237,241,247,.6)" }}
      >
        {isCrew && teamName ? (
          <>
            <span>Built by</span>
            <span className="font-semibold text-white">{teamName}</span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span>Powered by</span>
            <a
              href="https://buildslides.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-white/80 transition-colors hover:text-white"
            >
              <img src="/favicon.svg" alt="" className="h-4 w-4" />
              <span className="font-display font-black tracking-tight">BuildSlides</span>
            </a>
          </>
        ) : (
          <>
            <span>Built by</span>
            <a
              href="https://buildslides.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-white/80 transition-colors hover:text-white"
            >
              <img src="/favicon.svg" alt="" className="h-4 w-4" />
              <span className="font-display font-black tracking-tight">BuildSlides</span>
            </a>
          </>
        )}
      </div>
    </footer>
  );
}

