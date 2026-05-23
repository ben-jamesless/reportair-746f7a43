interface Props {
  teamPlan: string;
  teamLogoUrl?: string | null;
  teamName?: string | null;
}

export function ShareBrandingFooter({ teamPlan, teamLogoUrl, teamName }: Props) {
  if (teamPlan === "studio" || teamPlan === "enterprise") return null;

  const isCrew = teamPlan === "pro" || teamPlan === "team";

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "#0F1724",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "10px 16px",
          fontSize: "12px",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {isCrew && teamName ? (
          <>
            <span>Built by</span>
            <span style={{ color: "#ffffff", fontWeight: 600 }}>{teamName}</span>
            <span style={{ opacity: 0.3, margin: "0 2px" }}>·</span>
            <span>Powered by</span>
            <a
              href="https://buildslides.com"
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", opacity: 0.75, transition: "opacity 150ms" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.75")}
            >
              <img
                src="/brand/buildslides-lockup-on-dark.svg"
                alt="BuildSlides"
                style={{ height: "14px", width: "auto" }}
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
              style={{ display: "inline-flex", alignItems: "center", opacity: 0.75, transition: "opacity 150ms" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.75")}
            >
              <img
                src="/brand/buildslides-lockup-on-dark.svg"
                alt="BuildSlides"
                style={{ height: "14px", width: "auto" }}
              />
            </a>
          </>
        )}
      </div>
    </footer>
  );
}
