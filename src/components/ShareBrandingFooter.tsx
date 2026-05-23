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
    <footer
      className="mt-16 border-t"
      style={{ borderColor: "var(--border, #E5E3DF)" }}
    >
      <div
        className="flex items-center justify-center gap-2 py-5 text-xs"
        style={{ color: "var(--muted-foreground, #7A7974)" }}
      >
        {isCrew && teamName ? (
          <>
            <span>Built by</span>
            <span className="font-semibold" style={{ color: "var(--foreground, #0F1724)" }}>
              {teamName}
            </span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span>Powered by</span>
            <a
              href="https://buildslides.com"
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.55 }}
            >
              <img
                src="/brand/buildslides-lockup.svg"
                alt="BuildSlides"
                className="h-3.5 w-auto"
                style={{ display: "inline-block", verticalAlign: "middle" }}
              />
            </a>
          </>
        ) : (
          <>
            <span>Built by</span>
            <a
              href="https://buildslides.com"
              target="_blank"
              rel="noreferrer"
              className="transition-opacity hover:opacity-100"
              style={{ opacity: 0.6 }}
            >
              <img
                src="/brand/buildslides-lockup.svg"
                alt="BuildSlides"
                className="h-3.5 w-auto"
                style={{ display: "inline-block", verticalAlign: "middle" }}
              />
            </a>
          </>
        )}
      </div>
    </footer>
  );
}
