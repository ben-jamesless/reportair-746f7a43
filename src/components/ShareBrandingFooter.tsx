interface Props {
  teamPlan: string;
  teamLogoUrl?: string | null;
  teamName?: string | null;
  hideBranding?: boolean;
}

export function ShareBrandingFooter({ teamPlan, teamLogoUrl, teamName, hideBranding }: Props) {
  if (hideBranding) return null;

  const isCrew = teamPlan === "pro" || teamPlan === "team";

  const BuildSlidesLockup = () => (
    <a
      href="https://buildslides.com"
      target="_blank"
      rel="noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", opacity: 0.85, transition: "opacity 150ms" }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
    >
      <img src="/favicon.svg" alt="" style={{ width: "18px", height: "18px", display: "block" }} />
      <span style={{ color: "#F4F1EA", fontWeight: 700, fontSize: "13px", letterSpacing: "-0.01em" }}>
        BuildSlides
      </span>
    </a>
  );

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
            <BuildSlidesLockup />
          </>
        ) : (
          <>
            <span>Built by</span>
            <BuildSlidesLockup />
          </>
        )}
      </div>
    </footer>
  );
}
