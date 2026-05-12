import { useState } from "react";

type StepId = "c1" | "c2" | "c3";

const STEPS: { id: StepId; label: string }[] = [
  { id: "c1", label: "Capture" },
  { id: "c2", label: "Upload & Sort" },
  { id: "c3", label: "Export & Share" },
];

const FILL: Record<StepId, string> = { c1: "0%", c2: "50%", c3: "100%" };

const HowItWorksSection = () => {
  const [active, setActive] = useState<StepId>("c1");
  const [shown, setShown] = useState<StepId>("c1");
  const idx = STEPS.findIndex((s) => s.id === active);

  const go = (id: StepId) => {
    if (id === active) return;
    setShown((prev) => prev); // trigger fade-out via CSS by toggling shown != active
    setActive(id);
    // fade in after the panel transition
    window.setTimeout(() => setShown(id), 200);
  };

  return (
    <section id="how-it-works" style={{ background: "#060D18", color: "#fff" }}>
      <style>{`
        .hiw-scope { font-family: 'Inter', sans-serif; }
        .hiw-scope .display { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; }
        @keyframes hiwCameraPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(26,110,255,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(26,110,255,0); }
        }
        .hiw-camera-crosshair { animation: hiwCameraPulse 2.2s ease-in-out infinite; }
        .hiw-panel { transition: opacity .38s ease, transform .38s ease; }
        @media (max-width: 1023px) {
          .hiw-panel-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hiw-panel-headline { font-size: 28px !important; }
        }
        @media (max-width: 767px) {
          .hiw-panel { padding: 32px 24px !important; }
          .hiw-step-name { font-size: 11px !important; }
          .hiw-section-title { font-size: 32px !important; }
          .hiw-progress-track { width: min(440px, 80vw) !important; }
        }
      `}</style>

      <div className="hiw-scope" style={{ padding: "100px 48px 120px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <p
            className="display"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(168,196,255,0.6)",
              marginBottom: 14,
            }}
          >
            How it works
          </p>
          <h2
            className="display hiw-section-title"
            style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, color: "#fff", marginBottom: 14 }}
          >
            Site to report.
            <br />
            <span style={{ color: "#1A6EFF" }}>Three steps.</span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "rgba(255,255,255,0.4)", maxWidth: 420, margin: "0 auto" }}>
            No rebuilds. No chasing photos. Just a clean report, ready to share.
          </p>
        </div>

        {/* Stepper */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            position: "relative",
            marginBottom: 52,
            paddingTop: 4,
          }}
        >
          <div
            className="hiw-progress-track"
            style={{
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              width: 440,
              height: 2,
              background: "rgba(26,110,255,0.12)",
              zIndex: 0,
              borderRadius: 2,
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(to right, #1A6EFF, #5A9EFF)",
                boxShadow: "0 0 10px rgba(26,110,255,0.7)",
                width: FILL[active],
                borderRadius: 2,
                transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>

          {STEPS.map((s, i) => {
            const isActive = i === idx;
            const isDone = i < idx;
            const margin = i === 1 ? "0 120px" : undefined;
            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  width: 160,
                  position: "relative",
                  zIndex: 1,
                  background: "none",
                  border: "none",
                  color: "inherit",
                  padding: 0,
                  margin,
                  transition: "opacity .2s",
                }}
              >
                <div
                  className="display"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: isActive ? "#1A6EFF" : isDone ? "rgba(26,110,255,0.15)" : "rgba(11,24,48,0.9)",
                    border: `2px solid ${isActive ? "#1A6EFF" : isDone ? "rgba(26,110,255,0.5)" : "rgba(26,110,255,0.2)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                    color: isActive ? "#fff" : isDone ? "transparent" : "rgba(255,255,255,0.25)",
                    boxShadow: isActive
                      ? "0 0 0 4px rgba(26,110,255,0.18), 0 0 24px rgba(26,110,255,0.45)"
                      : "none",
                    transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
                    backgroundImage: isDone
                      ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none'%3E%3Cpath d='M12 20l5.5 5.5L28 15' stroke='%231A6EFF' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`
                      : undefined,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundSize: "40px 40px",
                  }}
                >
                  {i + 1}
                </div>
                <span
                  className="display hiw-step-name"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? "#fff" : isDone ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                    textAlign: "center",
                    transition: "color .3s",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.01em",
                  }}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div style={{ position: "relative", minHeight: 360 }}>
          <Panel
            visible={shown === active}
            panelId={active}
            onNext={(next) => go(next)}
          />
        </div>
      </div>
    </section>
  );
};

const PANEL_BG = "linear-gradient(135deg, rgba(11,24,48,0.95), rgba(14,32,68,0.85))";

const Panel = ({
  visible,
  panelId,
  onNext,
}: {
  visible: boolean;
  panelId: StepId;
  onNext: (id: StepId) => void;
}) => {
  return (
    <div
      className="hiw-panel hiw-panel-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 72,
        alignItems: "center",
        background: PANEL_BG,
        border: "1px solid rgba(26,110,255,0.14)",
        borderRadius: 28,
        padding: "60px 52px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 40px 80px rgba(0,0,0,0.35)",
      }}
    >
      {panelId === "c1" && <CapturePanel onNext={() => onNext("c2")} />}
      {panelId === "c2" && <SortPanel onNext={() => onNext("c3")} />}
      {panelId === "c3" && <ExportPanel onRestart={() => onNext("c1")} />}
    </div>
  );
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div
    className="display"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#1A6EFF",
      marginBottom: 16,
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: 22,
        height: 2,
        background: "#1A6EFF",
        borderRadius: 2,
        boxShadow: "0 0 6px rgba(26,110,255,0.6)",
      }}
    />
    {children}
  </div>
);

const Headline = ({ children }: { children: React.ReactNode }) => (
  <h3
    className="display hiw-panel-headline"
    style={{
      fontSize: 34,
      fontWeight: 800,
      lineHeight: 1.12,
      color: "#fff",
      marginBottom: 18,
      letterSpacing: "-0.02em",
    }}
  >
    {children}
  </h3>
);

const Body = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.45)", marginBottom: 26 }}>
    {children}
  </p>
);

const Pill = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <div
    className="display"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "6px 13px",
      borderRadius: 100,
      fontSize: 12,
      fontWeight: 600,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.09)",
      color: "rgba(255,255,255,0.65)",
      whiteSpace: "nowrap",
    }}
  >
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
    {children}
  </div>
);

const Pills = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>{children}</div>
);

const NextBtn = ({
  ghost,
  onClick,
  children,
}: {
  ghost?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="display"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: ghost ? "rgba(255,255,255,0.06)" : "#1A6EFF",
      color: ghost ? "rgba(255,255,255,0.5)" : "#fff",
      fontSize: 13,
      fontWeight: 700,
      padding: "11px 22px",
      borderRadius: 100,
      cursor: "pointer",
      border: ghost ? "1px solid rgba(255,255,255,0.1)" : "none",
      letterSpacing: "0.01em",
      boxShadow: ghost ? "none" : "0 4px 20px rgba(26,110,255,0.35)",
      transition: "background .2s, box-shadow .2s",
    }}
  >
    {children}
  </button>
);

const GraphicPanel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 20,
      padding: 28,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 12,
    }}
  >
    {children}
  </div>
);

// ---- Step 1
const CapturePanel = ({ onNext }: { onNext: () => void }) => (
  <>
    <div>
      <Eyebrow>Step 01 · Capture</Eyebrow>
      <Headline>
        Shoot on site.
        <br />
        Tag as you go.
      </Headline>
      <Body>
        Upload photos directly from the field. Tag by area or zone while the context is fresh — no back-office sorting required.
      </Body>
      <Pills>
        <Pill color="#1DB87A">Capture from any device</Pill>
        <Pill color="#1A6EFF">Tag by area or zone</Pill>
        <Pill color="#FF8C00">Flag issues instantly</Pill>
      </Pills>
      <NextBtn onClick={onNext}>Next: Upload & Sort &nbsp;→</NextBtn>
    </div>
    <GraphicPanel>
      <div
        style={{
          aspectRatio: "16 / 10",
          background: "linear-gradient(135deg,#0A1828,#0D1F40)",
          borderRadius: 12,
          border: "1.5px solid rgba(26,110,255,0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            className="hiw-camera-crosshair"
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "2px solid rgba(26,110,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A6EFF" }} />
          </div>
        </div>
        <span style={{ position: "absolute", top: 8, left: 8, width: 14, height: 14, borderTop: "2px solid #1A6EFF", borderLeft: "2px solid #1A6EFF" }} />
        <span style={{ position: "absolute", top: 8, right: 8, width: 14, height: 14, borderTop: "2px solid #1A6EFF", borderRight: "2px solid #1A6EFF" }} />
        <span style={{ position: "absolute", bottom: 8, left: 8, width: 14, height: 14, borderBottom: "2px solid #1A6EFF", borderLeft: "2px solid #1A6EFF" }} />
        <span style={{ position: "absolute", bottom: 8, right: 8, width: 14, height: 14, borderBottom: "2px solid #1A6EFF", borderRight: "2px solid #1A6EFF" }} />
        <div
          className="display"
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(26,110,255,0.9)",
            borderRadius: 5,
            padding: "2px 9px",
            fontSize: 9,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.08em",
          }}
        >
          MAIN STAGE
        </div>
        <div
          className="display"
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.55)",
            borderRadius: 5,
            padding: "2px 7px",
            fontSize: 9,
            color: "rgba(255,255,255,0.75)",
            fontWeight: 600,
          }}
        >
          38 photos
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {[
          { bg: "linear-gradient(135deg,#2A4060,#1A3050)", check: true },
          { bg: "linear-gradient(135deg,#3A4A30,#2A3A20)", check: true },
          { bg: "linear-gradient(135deg,#4A3020,#3A2010)", check: true },
          { bg: "linear-gradient(135deg,#302A40,#201A30)", check: false },
        ].map((t, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 8, position: "relative", overflow: "hidden", background: t.bg }}>
            {t.check && (
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  width: 15,
                  height: 15,
                  background: "#1DB87A",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  color: "#fff",
                  fontWeight: 800,
                }}
              >
                ✓
              </div>
            )}
          </div>
        ))}
      </div>
    </GraphicPanel>
  </>
);

// ---- Step 2
const SortPanel = ({ onNext }: { onNext: () => void }) => {
  const tag = (active: boolean, label: string) => (
    <div
      key={label}
      className="display"
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "4px 11px",
        borderRadius: 100,
        ...(active
          ? { background: "#1A6EFF", color: "#fff" }
          : {
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.08)",
            }),
      }}
    >
      {label}
    </div>
  );

  const areas: { color: string; name: string; count: string; pill: string; pillColor: "green" | "amber" }[] = [
    { color: "#1DB87A", name: "Main Stage", count: "12 photos", pill: "On track", pillColor: "green" },
    { color: "#FF8C00", name: "VIP Tent", count: "5 photos", pill: "1 issue", pillColor: "amber" },
    { color: "#1A6EFF", name: "Power & AV", count: "8 photos", pill: "Complete", pillColor: "green" },
    { color: "#7A5CFA", name: "Signage", count: "13 photos", pill: "On track", pillColor: "green" },
  ];

  return (
    <>
      <div>
        <Eyebrow>Step 02 · Sort</Eyebrow>
        <Headline>
          Every photo
          <br />
          in its place.
        </Headline>
        <Body>
          Sort uploads by area, add notes, and flag issues — one tap per update. Your report structure builds automatically as you work.
        </Body>
        <Pills>
          <Pill color="#1A6EFF">Sort by area or workstream</Pill>
          <Pill color="#FF8C00">One-tap issue flagging</Pill>
          <Pill color="#1DB87A">Auto-structured report</Pill>
        </Pills>
        <NextBtn onClick={onNext}>Next: Export & Share &nbsp;→</NextBtn>
      </div>
      <GraphicPanel>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {tag(true, "All areas")}
          {tag(false, "Stage")}
          {tag(false, "VIP")}
          {tag(false, "Power")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {areas.map((a) => (
            <div
              key={a.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.035)",
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: 3, background: a.color, flexShrink: 0 }} />
              <span className="display" style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", flex: 1, fontWeight: 500 }}>
                {a.name}
              </span>
              <span className="display" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{a.count}</span>
              <div
                className="display"
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 100,
                  ...(a.pillColor === "green"
                    ? { background: "rgba(29,184,122,0.15)", color: "#1DB87A" }
                    : { background: "rgba(255,140,0,0.15)", color: "#FF8C00" }),
                }}
              >
                {a.pill}
              </div>
            </div>
          ))}
        </div>
      </GraphicPanel>
    </>
  );
};

// ---- Step 3
const ExportPanel = ({ onRestart }: { onRestart: () => void }) => (
  <>
    <div>
      <Eyebrow>Step 03 · Export</Eyebrow>
      <Headline>
        One click.
        <br />
        Client-ready.
      </Headline>
      <Body>
        Generate a branded PDF or live shareable link in seconds. Your client opens it straight from WhatsApp — no login, no fuss.
      </Body>
      <Pills>
        <Pill color="#1A6EFF">PDF or shareable link</Pill>
        <Pill color="#25D366">Send via WhatsApp</Pill>
        <Pill color="#1DB87A">No login to view</Pill>
      </Pills>
      <NextBtn ghost onClick={onRestart}>↺ &nbsp;Start over</NextBtn>
    </div>
    <GraphicPanel>
      <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", color: "#0F1724", boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#0F1724", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width={16} height={16} viewBox="0 0 100 100" fill="none">
              <rect x="11" y="19" width="60" height="50" rx="6" stroke="#A8C4FF" strokeWidth="4.4" />
              <rect x="27" y="35" width="60" height="50" rx="6" stroke="#1A6EFF" strokeWidth="6.8" />
            </svg>
            <span className="display" style={{ fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ReportAir
            </span>
          </div>
          <div
            className="display"
            style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "rgba(29,184,122,0.2)", color: "#1DB87A" }}
          >
            Ready to share
          </div>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div className="display" style={{ fontSize: 12, fontWeight: 800, color: "#0F1724", marginBottom: 4 }}>
            Northstar Festival · Day 3 of 6
          </div>
          <div className="display" style={{ fontSize: 10, color: "#7A8FA8", marginBottom: 10 }}>
            38 photos · 4 areas · 1 issue flagged
          </div>
          <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
            <div style={{ flex: 1, aspectRatio: "4 / 3", borderRadius: 6, background: "linear-gradient(135deg,#c8d8e8,#a8b8cc)" }} />
            <div style={{ flex: 1, aspectRatio: "4 / 3", borderRadius: 6, background: "linear-gradient(135deg,#d4c4a0,#b8a880)" }} />
            <div style={{ flex: 1, aspectRatio: "4 / 3", borderRadius: 6, background: "linear-gradient(135deg,#b8c4d0,#9aa8b8)" }} />
          </div>
        </div>
        <div style={{ padding: "10px 14px", background: "#F5F7FA", display: "flex", gap: 7 }}>
          <div className="display" style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "7px 0", borderRadius: 8, textAlign: "center", background: "#1A6EFF", color: "#fff" }}>
            Download PDF
          </div>
          <div
            className="display"
            style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "7px 0", borderRadius: 8, textAlign: "center", background: "transparent", color: "#1A6EFF", border: "1px solid rgba(26,110,255,0.3)" }}
          >
            Copy link
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <ChannelChip variant="wa" label="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.115 1.528 5.836L.055 23.473a.5.5 0 00.607.607l5.636-1.473A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.671-.526-5.183-1.437l-.371-.222-3.855 1.007 1.028-3.761-.242-.386A9.946 9.946 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
        </ChannelChip>
        <ChannelChip variant="pdf" label="PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
        </ChannelChip>
        <ChannelChip variant="link" label="Live link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
        </ChannelChip>
      </div>
    </GraphicPanel>
  </>
);

const ChannelChip = ({
  variant,
  label,
  children,
}: {
  variant: "wa" | "pdf" | "link";
  label: string;
  children: React.ReactNode;
}) => {
  const styles =
    variant === "wa"
      ? { borderColor: "rgba(37,211,102,0.3)", color: "#25D366", background: "rgba(37,211,102,0.08)" }
      : variant === "pdf"
        ? { borderColor: "rgba(255,59,48,0.3)", color: "#FF3B30", background: "rgba(255,59,48,0.08)" }
        : { borderColor: "rgba(26,110,255,0.3)", color: "#A8C4FF", background: "rgba(26,110,255,0.08)" };
  return (
    <div
      className="display"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 600,
        border: `1px solid ${styles.borderColor}`,
        background: styles.background,
        color: styles.color,
      }}
    >
      <span style={{ width: 13, height: 13, display: "inline-flex" }}>{children}</span>
      {label}
    </div>
  );
};

export default HowItWorksSection;
