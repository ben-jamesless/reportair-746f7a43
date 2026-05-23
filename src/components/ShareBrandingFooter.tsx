// Branding tiers derived from team plan:
//   "free" | "solo"  → BuildSlides wordmark only
//   "pro"  (Crew)    → Team logo (if set) + BuildSlides wordmark
//   "studio"         → Nothing (returns null)

interface Props {
  teamPlan: string;
  teamLogoUrl?: string | null;
  teamName?: string | null;
}

export function ShareBrandingFooter({ teamPlan, teamLogoUrl, teamName }: Props) {
  if (teamPlan === "studio" || teamPlan === "enterprise") return null;

  const showTeamLogo = (teamPlan === "pro" || teamPlan === "team") && !!teamLogoUrl;

  return (
    <footer
      className="mt-12 flex items-center justify-center gap-4 border-t py-6"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {showTeamLogo && (
        <>
          <img
            src={teamLogoUrl!}
            alt={teamName ?? ""}
            className="h-6 w-auto object-contain opacity-80"
          />
          <span style={{ color: "var(--border)" }}>·</span>
        </>
      )}

      <a
        href="https://buildslides.com"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 text-xs font-medium opacity-60 transition-opacity hover:opacity-100"
        style={{ color: "var(--muted)" }}
      >
        Powered by
        <img
          src="/brand/buildslides-lockup.svg"
          alt="BuildSlides"
          className="h-4 w-auto"
        />
      </a>
    </footer>
  );
}
