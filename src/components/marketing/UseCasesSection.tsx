import { useState } from "react";
import { display, body } from "./brand-tokens";

type Status = "complete" | "progress" | "pending";

type UseCase = {
  id: string;
  accent: string;
  title: string;
  description: string;
  bullets: string[];
  reportTitle: string;
  reportDay: string;
  rows: { label: string; status: Status }[];
  icon: JSX.Element;
};

const useCases: UseCase[] = [
  {
    id: "festivals",
    accent: "#D94F2A",
    title: "Music Festivals",
    description:
      "Build phase reporting across stages, infrastructure, and vendor setups. Track 20+ areas simultaneously.",
    bullets: [
      "Track progress across 20+ event areas at once",
      "Document stages, rigging, power, fencing, and vendor zones",
      "Daily reports sent to production manager before site closes",
      "Photo evidence for H&S sign-off and client handover",
    ],
    reportTitle: "Greenfield Festival — Build Phase",
    reportDay: "Day 3 of 5",
    rows: [
      { label: "Main Stage", status: "complete" },
      { label: "Arena Stage", status: "progress" },
      { label: "Vendor Village", status: "pending" },
      { label: "Power Infrastructure", status: "complete" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: "golf",
    accent: "#1DB87A",
    title: "Golf Tournaments",
    description:
      "Hole-by-hole setup documentation. Keep sponsors, clients, and ops teams aligned from day one.",
    bullets: [
      "Suitable for all professional scale events (PGA Tour, LPGA, DP World Tour)",
      "Sponsor activation tracking with photo proof",
      "Course walk reports shared with tournament director daily",
      "Flag incomplete branding installs before client walkthrough",
    ],
    reportTitle: "DP World Tour — Course Setup",
    reportDay: "Day 1 of 3",
    rows: [
      { label: "Holes 1–6", status: "complete" },
      { label: "Sponsor Village", status: "progress" },
      { label: "Holes 7–18", status: "pending" },
      { label: "Hospitality on 18", status: "complete" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <line x1="5" y1="3" x2="5" y2="21" />
        <polyline points="5 3 18 8 5 13" />
        <circle cx="5" cy="21" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "filmsets",
    accent: "#E94560",
    title: "Film Sets",
    description:
      "Shooting locations, set builds, and location dressing. Keep continuity, art dept, and production aligned.",
    bullets: [
      "Document set builds, prop placement, and dressing changes",
      "Continuity photo logs shared between shoots and wrap",
      "Location manager receives a daily update before wrap",
      "Insurance-ready evidence of site condition before and after",
    ],
    reportTitle: "Pinewood Studio — Set Build",
    reportDay: "Day 2 of 12",
    rows: [
      { label: "Main Set Build", status: "complete" },
      { label: "Prop Dressing", status: "progress" },
      { label: "Lighting Rig", status: "pending" },
      { label: "Location Condition", status: "complete" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10,8 16,12 10,16 10,8" />
      </svg>
    ),
  },
  {
    id: "activations",
    accent: "#FF8C00",
    title: "Brand Activations",
    description: "Pop-ups, roadshows, and retail installations. Proof of build quality and brand compliance in real time.",
    bullets: [
      "Capture build quality and brand compliance at every activation",
      "Flag missing assets or off-brand execution instantly",
      "Client receives a live link to the day's install progress",
      "Suitable for roadshows, retail fit-outs, and experiential builds",
    ],
    reportTitle: "Summer Roadshow — Install",
    reportDay: "Stop 3 of 8",
    rows: [
      { label: "Structure Build", status: "complete" },
      { label: "Branding & Graphics", status: "complete" },
      { label: "Product Display", status: "progress" },
      { label: "Lighting & AV", status: "pending" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: "marathons",
    accent: "#FF8C00",
    title: "Marathon & Road Races",
    description:
      "Route infrastructure, barriers, signage, and water stations. Photo evidence for safety sign-off.",
    bullets: [
      "Document route setup km by km or zone by zone",
      "Barrier placement, water stations, medical post positioning",
      "Photo evidence submitted to local authority for road permits",
      "Flag missing signage or incomplete setups instantly",
    ],
    reportTitle: "City Marathon — Route Check",
    reportDay: "Race Eve",
    rows: [
      { label: "Zone A (km 1–10)", status: "complete" },
      { label: "Zone B (km 11–21)", status: "complete" },
      { label: "Water Stations", status: "progress" },
      { label: "Finish Line Setup", status: "pending" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <circle cx="13" cy="4" r="2" />
        <path d="M7 20l2-6 3 3 2-4 3 7" />
        <path d="M6 10l1-2 5-1 2 3-3 2z" />
      </svg>
    ),
  },
  {
    id: "corporate",
    accent: "#7A5CFA",
    title: "Corporate Events",
    description: "AV, staging, branding installs. Branded reports ready for client approval in minutes.",
    bullets: [
      "Track AV setup, staging, lighting, and branding by room or zone",
      "Client-ready branded report generated on the day of setup",
      "Before/after photo documentation for venue handover",
      "Suitable for conferences, awards ceremonies, product launches",
    ],
    reportTitle: "Annual Awards — Venue Setup",
    reportDay: "Setup Day",
    rows: [
      { label: "Main Stage AV", status: "complete" },
      { label: "Branding & Signage", status: "progress" },
      { label: "Breakout Rooms", status: "pending" },
      { label: "Registration Desk", status: "complete" },
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
];

const tabLabels: Record<string, string> = {
  festivals: "Festivals",
  golf: "Golf",
  marathons: "Marathons",
  corporate: "Corporate",
  filmsets: "Film sets",
  activations: "Activations",
};

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function StatusPill({ status }: { status: Status }) {
  const map = {
    complete: { bg: "rgba(29,184,122,0.15)", color: "#1DB87A", label: "Complete" },
    progress: { bg: "rgba(255,140,0,0.15)", color: "#FF8C00", label: "In Progress" },
    pending: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", label: "Pending" },
  }[status];
  return (
    <span
      style={{
        ...body,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 100,
        background: map.bg,
        color: map.color,
      }}
    >
      {map.label}
    </span>
  );
}

export default function UseCasesSection() {
  const [active, setActive] = useState("festivals");
  const current = useCases.find((u) => u.id === active)!;
  const accent = current.accent;

  return (
    <section className="py-[86px] max-md:py-[43px]" style={{ background: "#0F1417", overflow: "hidden" }}>
      <style>{`
        @keyframes uc-fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .uc-panel { animation: uc-fadeUp 0.35s ease forwards; }
        .uc-export:hover { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
        @media (max-width: 900px) {
          .uc-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .uc-headline { font-size: 36px !important; }
          .uc-tab { font-size: 12px !important; }
          .uc-card { padding: 20px !important; }
        }
      `}</style>

      <div className="container mx-auto px-6">
        <p
          style={{
            ...body,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(244,241,234,0.6)",
            margin: "0 0 14px 0",
          }}
        >
          WHO IT'S FOR
        </p>
        <h2
          className="uc-headline"
          style={{
            ...display,
            fontWeight: 800,
            fontSize: 48,
            color: "#fff",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            margin: "0 0 48px 0",
          }}
        >
          One tool.<br />Every site.
        </h2>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 40 }}>
          {useCases.map((u) => {
            const isActive = u.id === active;
            return (
              <button
                key={u.id}
                className="uc-tab"
                onClick={() => setActive(u.id)}
                style={{
                  ...body,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 18px",
                  borderRadius: 100,
                  border: `1px solid ${isActive ? "transparent" : "rgba(255,255,255,0.12)"}`,
                  background: isActive ? u.accent : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {tabLabels[u.id]}
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <div
          key={active}
          className="uc-panel uc-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
            alignItems: "center",
            minHeight: 380,
          }}
        >
          {/* Left column */}
          <div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: hexToRgba(accent, 0.15),
                color: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              {current.icon}
            </div>
            <h3
              style={{
                ...display,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#fff",
                margin: "0 0 12px 0",
              }}
            >
              {current.title}
            </h3>
            <p
              style={{
                ...body,
                fontSize: 15,
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.65,
                margin: "0 0 24px 0",
              }}
            >
              {current.description}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {current.bullets.map((b) => (
                <li
                  key={b}
                  style={{
                    ...body,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    fontSize: 14,
                    color: "rgba(255,255,255,0.65)",
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: accent,
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Right column — mock report card */}
          <div
            className="uc-card"
            style={{
              background: "linear-gradient(160deg, rgba(15,26,52,0.95), rgba(10,18,38,0.98))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: 28,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: -1,
                borderRadius: 21,
                background: `linear-gradient(135deg, ${accent} 0%, transparent 55%)`,
                opacity: 0.2,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span
                  style={{
                    ...body,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    background: hexToRgba(accent, 0.2),
                    color: accent,
                    padding: "4px 10px",
                    borderRadius: 100,
                  }}
                >
                  Live Report
                </span>
                <span style={{ ...body, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{current.reportDay}</span>
              </div>
              <h4 style={{ ...display, fontWeight: 700, fontSize: 16, color: "#fff", margin: "0 0 20px 0" }}>
                {current.reportTitle}
              </h4>
              <div style={{ marginBottom: 14 }}>
                {current.rows.map((r) => (
                  <div
                    key={r.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.06)",
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ ...body, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{r.label}</span>
                    <StatusPill status={r.status} />
                  </div>
                ))}
              </div>
              <button
                className="uc-export"
                style={{
                  ...body,
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                  marginTop: 4,
                  transition: "background 0.2s, color 0.2s",
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export PDF Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
