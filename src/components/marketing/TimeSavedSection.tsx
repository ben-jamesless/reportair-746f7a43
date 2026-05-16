const display = { fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };

const oldItems = [
  "Sorting WhatsApp photos for 45 mins",
  "Chasing your team to copy-past into PowerPoint",
  "Back at the desk at midnight",
  "Client chasing for an update",
];

const newItems = [
  "Photos tagged as you walk the site",
  "Report structure builds automatically",
  "Done before you leave site",
  "Client gets the link in minutes",
];

export default function TimeSavedSection() {
  return (
    <section className="py-[68px] px-6 sm:px-12 max-md:py-[34px]" style={{ background: "#060D18" }}>
      <style>{`
        .ts-wrap { max-width: 1100px; margin: 0 auto; }
        .ts-card {
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.14);
          background: #0B1525;
          box-shadow: 0 24px 80px rgba(0,0,0,0.45);
          overflow: hidden;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .ts-panel { padding: 48px; display: flex; flex-direction: column; }
        .ts-left { background: #111E33; border-left: 3px solid #FF8C00; border-right: 1px solid rgba(255,255,255,0.10); }
        .ts-right { background: #0E1A2D; border-left: 3px solid #1DB87A; }
        .ts-num { font-size: 58px; }
        @media (max-width: 767px) {
          .ts-card { grid-template-columns: 1fr; }
          .ts-panel { padding: 32px 24px; }
          .ts-left { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.10); }
          .ts-num { font-size: 44px !important; }
        }
      `}</style>
      <div className="ts-wrap">
        <header style={{ marginBottom: 56 }}>
          <p
            style={{
              ...display,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(168,196,255,0.6)",
              marginBottom: 16,
            }}
          >
            TIME SAVED
          </p>
          <h2
            style={{
              ...display,
              fontWeight: 800,
              fontSize: "clamp(32px, 4vw, 52px)",
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Stop rebuilding reports from scratch.
          </h2>
        </header>

        <div className="ts-card">
          <Panel
            heading="THE OLD WAY"
            color="#FF8C00"
            iconBg="rgba(255,140,0,0.12)"
            symbol="✗"
            items={oldItems}
            time="2–3 hrs"
            side="left"
          />
          <Panel
            heading="WITH REPORTAIR"
            color="#1DB87A"
            iconBg="rgba(29,184,122,0.12)"
            symbol="✓"
            items={newItems}
            time="10 min"
            side="right"
          />
        </div>
      </div>
    </section>
  );
}

function Panel({
  heading,
  color,
  iconBg,
  symbol,
  items,
  time,
  side,
}: {
  heading: string;
  color: string;
  iconBg: string;
  symbol: string;
  items: string[];
  time: string;
  side: "left" | "right";
}) {
  return (
    <div className={`ts-panel ${side === "left" ? "ts-left" : "ts-right"}`}>
      <p
        style={{
          ...display,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color,
          marginBottom: 32,
          margin: "0 0 32px 0",
        }}
      >
        {heading}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((it) => (
          <li key={it} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                flexShrink: 0,
                background: iconBg,
                color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {symbol}
            </span>
            <span style={{ ...body, fontSize: 15, fontWeight: 400, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
              {it}
            </span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 40 }}>
        <p
          className="ts-num"
          style={{
            ...display,
            fontWeight: 800,
            color,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            margin: 0,
          }}
        >
          {time}
        </p>
        <p
          style={{
            ...display,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(107,122,148,1)",
            marginTop: 6,
            marginBottom: 0,
          }}
        >
          PER REPORT
        </p>
      </div>
    </div>
  );
}
