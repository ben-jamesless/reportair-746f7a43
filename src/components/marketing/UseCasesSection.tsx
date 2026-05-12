import { useRef } from "react";

const display = { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };

type UseCase = {
  title: string;
  accent: string;
  description: string;
  icon: JSX.Element;
};

const useCases: UseCase[] = [
  {
    title: "Music Festivals",
    accent: "#1A6EFF",
    description:
      "Build phase reporting across stages, infrastructure, and vendor setups. Track 20+ areas simultaneously.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    title: "Golf Tournaments",
    accent: "#1DB87A",
    description:
      "Hole-by-hole setup documentation. Keep sponsors, clients, and ops teams aligned from day one.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <line x1="5" y1="3" x2="5" y2="21" />
        <polyline points="5 3 18 8 5 13" />
        <circle cx="5" cy="21" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Marathon & Road Races",
    accent: "#FF8C00",
    description:
      "Route infrastructure, barriers, signage, and water stations. Photo evidence for safety sign-off.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <circle cx="13" cy="4" r="2" />
        <path d="M7 20l2-6 3 3 2-4 3 7" />
        <path d="M6 10l1-2 5-1 2 3-3 2z" />
      </svg>
    ),
  },
  {
    title: "Corporate Events",
    accent: "#7A5CFA",
    description: "AV, staging, branding installs. Branded reports ready for client approval in minutes.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    title: "Home Renovation",
    accent: "#A8C4FF",
    description:
      "Document each phase for clients or insurers. Replace WhatsApp chaos with structured daily reports.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    title: "Construction & Site Works",
    accent: "#FF8C00",
    description: "Progress reporting for site managers. Photo-to-report in the field, no desk required.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M2 17h2m16 0h2M6 17v-5a6 6 0 0 1 12 0v5" />
        <rect x="6" y="17" width="12" height="4" rx="1" />
        <path d="M9 8h6" />
      </svg>
    ),
  },
];

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function UseCasesSection() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    trackRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <section style={{ background: "#060D18", padding: "95px 0", overflow: "hidden", position: "relative" }}>
      <style>{`
        .uc-track::-webkit-scrollbar { display: none; }
        .uc-card { transition: transform 0.25s ease; position: relative; }
        .uc-card:hover { transform: translateY(-4px); }
        .uc-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 21px;
          background: linear-gradient(135deg, var(--card-accent-color) 0%, transparent 60%);
          opacity: 0.35;
          z-index: -1;
          pointer-events: none;
        }
        @media (max-width: 679px) {
          .uc-card { width: 240px !important; }
          .uc-arrows { display: none !important; }
        }
      `}</style>

      <div ref={containerRef} className="mx-auto max-w-[1200px] px-5 sm:px-6">
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 48,
            gap: 24,
          }}
        >
        <div style={{ textAlign: "left" }}>
          <p
            style={{
              ...body,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(168,196,255,0.6)",
              margin: "0 0 14px 0",
            }}
          >
            MADE FOR
          </p>
          <h2
            style={{
              ...display,
              fontWeight: 800,
              fontSize: 44,
              color: "#fff",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Every kind of site.
          </h2>
        </div>
        <div className="uc-arrows" style={{ display: "flex", gap: 10 }}>
          {[-1, 1].map((d) => (
            <button
              key={d}
              onClick={() => scroll(d as -1 | 1)}
              aria-label={d === -1 ? "Scroll left" : "Scroll right"}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              {d === -1 ? "‹" : "›"}
            </button>
          ))}
        </div>
      </div>
      </div>

      <div style={{ position: "relative" }}>
        <div
          ref={trackRef}
          className="uc-track"
          style={{
            display: "flex",
            gap: 20,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            paddingLeft: padLeft,
            paddingBottom: 20,
            paddingRight: 160,
            scrollbarWidth: "none",
          }}
        >
          {useCases.map((c) => (
            <article
              key={c.title}
              className="uc-card"
              style={
                {
                  width: 280,
                  minHeight: 400,
                  flexShrink: 0,
                  scrollSnapAlign: "start",
                  borderRadius: 20,
                  padding: "32px 28px",
                  display: "flex",
                  flexDirection: "column",
                  background: "linear-gradient(160deg, rgba(11,24,48,0.95), rgba(8,16,36,0.98))",
                  ["--card-accent-color" as any]: c.accent,
                } as React.CSSProperties
              }
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: hexToRgba(c.accent, 0.15),
                  color: c.accent,
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {c.icon}
              </div>
              <h3 style={{ ...display, fontWeight: 800, fontSize: 20, color: "#fff", margin: "0 0 12px 0" }}>
                {c.title}
              </h3>
              <p style={{ ...body, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0, flex: 1 }}>
                {c.description}
              </p>
            </article>
          ))}
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 20,
            width: 120,
            background: "linear-gradient(to left, #060D18, transparent)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      </div>
    </section>
  );
}
