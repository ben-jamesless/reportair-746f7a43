import { Link } from "react-router-dom";
import { BuildFolderLockup } from "@/components/brand/BuildFolderLockup";

/**
 * BuildFolder hero section — responsive (desktop / tablet / mobile).
 * Self-contained: scoped styles + animations.
 * Right side renders a realistic product dashboard mock.
 */
const HeroSection = () => {
  return (
    <section className="bf-hero">
      <style>{`
        .bf-hero {
          --ink: #0F1417;
          --ink-2: #1A2025;
          --paper: #F4F1EA;
          --paper-2: #ECE8DE;
          --paper-3: #E4DFD2;
          --accent: #D94F2A;
          --accent-soft: rgba(217,79,42,0.12);
          --mute: #6B6B66;
          --line: rgba(15,20,23,0.10);
          --line-2: rgba(15,20,23,0.06);
          --green: #3A7D44;
          --green-bg: #E4F0E6;
          --blue: #3A6EA5;
          --blue-bg: #E2ECF5;
          --red: #C7382A;
          --red-bg: #F7E1DE;
          --font-display: 'Geist', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', ui-monospace, monospace;
          background: var(--ink);
          font-family: var(--font-display);
          display: block;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
        .bf-hero * { box-sizing: border-box; }

        .bf-hero .hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 42fr) minmax(0, 58fr);
          align-items: center;
          gap: 56px;
          max-width: 1320px;
          margin: 0 auto;
          padding: 72px 48px 88px;
          position: relative;
        }
        .bf-hero .hero-inner::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(60% 60% at 20% 30%, rgba(217,79,42,0.10), transparent 60%),
            radial-gradient(50% 50% at 90% 80%, rgba(217,79,42,0.08), transparent 60%);
          pointer-events: none;
        }

        /* ---------- LEFT: COPY ---------- */
        .bf-hero .hero-copy { position: relative; z-index: 2; }
        .bf-hero .eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(244,241,234,0.65);
          margin: 0 0 22px;
        }
        .bf-hero .headline {
          font-size: clamp(40px, 5vw, 60px);
          font-weight: 900;
          line-height: 1.04;
          letter-spacing: -0.025em;
          color: #fff;
          margin: 0 0 24px;
        }
        .bf-hero .headline .accent { color: var(--accent); }
        .bf-hero .subline {
          font-size: 17px;
          line-height: 1.55;
          color: rgba(255,255,255,0.55);
          margin: 0 0 36px;
          max-width: 440px;
        }
        .bf-hero .cta-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
        .bf-hero .btn-primary {
          background: var(--accent); color: #fff;
          font-size: 15px; font-weight: 600;
          padding: 13px 26px; border-radius: 100px;
          border: none; text-decoration: none;
          transition: background 0.15s;
        }
        .bf-hero .btn-primary:hover { background: #B53D1F; }
        .bf-hero .btn-secondary {
          color: rgba(255,255,255,0.7);
          font-size: 15px; font-weight: 500;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.18);
          padding: 12px 22px; border-radius: 100px;
          transition: border-color 0.2s, color 0.2s;
        }
        .bf-hero .btn-secondary:hover { border-color: rgba(255,255,255,0.4); color: #fff; }

        /* ---------- RIGHT: DASHBOARD MOCK ---------- */
        .bf-hero .dash-wrap {
          position: relative;
          z-index: 2;
          min-width: 0;
          padding: 18px;
          border-radius: 28px;
          background: linear-gradient(155deg, rgba(244,241,234,0.10) 0%, rgba(244,241,234,0.02) 100%);
          border: 1px solid rgba(244,241,234,0.10);
          box-shadow: 0 30px 80px rgba(0,0,0,0.45);
        }
        .bf-hero .dash {
          background: var(--paper);
          border-radius: 18px;
          overflow: hidden;
          display: grid;
          grid-template-columns: 200px minmax(0, 1fr);
          color: var(--ink);
          min-height: 600px;
          box-shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 0 0 1px rgba(15,20,23,0.04);
        }

        /* sidebar */
        .bf-hero .side {
          background: var(--paper);
          padding: 18px 14px 18px 16px;
          border-right: 1px solid var(--line);
          display: flex; flex-direction: column; gap: 14px;
        }
        .bf-hero .side-brand { padding: 4px 4px 6px; }
        .bf-hero .side-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--mute);
          padding: 2px 4px;
        }
        .bf-hero .side-list { display: flex; flex-direction: column; gap: 4px; }
        .bf-hero .side-row {
          display: grid;
          grid-template-columns: 38px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          color: var(--ink);
        }
        .bf-hero .side-row .chip {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center;
          width: 38px; height: 38px; border-radius: 8px;
          background: #fff;
          border: 1px solid var(--line);
          font-family: var(--font-mono); line-height: 1;
        }
        .bf-hero .side-row .chip .d { font-size: 14px; font-weight: 700; color: var(--ink); }
        .bf-hero .side-row .chip .m { font-size: 8px; letter-spacing: 0.12em; color: var(--mute); margin-top: 2px; }
        .bf-hero .side-row .lbl { font-size: 13px; font-weight: 600; color: var(--ink); }
        .bf-hero .side-row .cnt { font-size: 12px; color: var(--mute); font-family: var(--font-mono); }
        .bf-hero .side-row.active { background: var(--accent); }
        .bf-hero .side-row.active .chip { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.25); }
        .bf-hero .side-row.active .chip .d,
        .bf-hero .side-row.active .chip .m,
        .bf-hero .side-row.active .lbl,
        .bf-hero .side-row.active .cnt { color: #fff; }

        /* main */
        .bf-hero .main { padding: 20px 22px 22px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
        .bf-hero .main-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .bf-hero .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .bf-hero .title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); white-space: nowrap; }
        .bf-hero .pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600;
          padding: 4px 10px; border-radius: 100px;
          font-family: var(--font-display);
          white-space: nowrap;
        }
        .bf-hero .pill::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: currentColor;
        }
        .bf-hero .pill.green { color: var(--green); background: var(--green-bg); }
        .bf-hero .pill.blue  { color: var(--blue);  background: var(--blue-bg);  }
        .bf-hero .pill.red   { color: var(--red);   background: var(--red-bg);   }

        .bf-hero .meta {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--mute);
          letter-spacing: 0.04em;
          margin-top: 4px;
        }
        .bf-hero .head-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        .bf-hero .head-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11.5px; font-weight: 600;
          padding: 7px 10px; border-radius: 9px;
          border: 1px solid var(--line);
          background: #fff; color: var(--ink);
          white-space: nowrap;
        }
        .bf-hero .head-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }

        .bf-hero .tabs {
          display: flex; gap: 22px;
          border-bottom: 1px solid var(--line);
          padding-bottom: 0;
        }
        .bf-hero .tab {
          font-size: 13px; font-weight: 600;
          color: var(--mute);
          padding: 8px 0;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .bf-hero .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        .bf-hero .date-sub { font-size: 14px; font-weight: 700; color: var(--ink); }

        .bf-hero .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bf-hero .card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .bf-hero .card-label {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--mute);
          margin-bottom: 8px;
        }
        .bf-hero .card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .bf-hero .card li {
          font-size: 12.5px; line-height: 1.4; color: var(--ink);
          padding-left: 14px; position: relative;
        }
        .bf-hero .card li::before {
          content: '•'; color: var(--accent); position: absolute;
          left: 0; top: 0; font-size: 14px; line-height: 1.2;
        }

        .bf-hero .status-list { display: flex; flex-direction: column; gap: 8px; }
        .bf-hero .status-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          background: #fff;
          border: 1px solid var(--line);
          border-left: 4px solid var(--line);
          border-radius: 8px;
          padding: 10px 14px;
        }
        .bf-hero .status-row.red   { border-left-color: var(--red); }
        .bf-hero .status-row.blue  { border-left-color: var(--blue); }
        .bf-hero .status-row.green { border-left-color: var(--green); }
        .bf-hero .status-row .sr-title { font-size: 13.5px; font-weight: 700; color: var(--ink); }
        .bf-hero .status-row .sr-desc  { font-size: 12px; color: var(--mute); margin-top: 2px; }

        /* ---------- TABLET ---------- */
        @media (max-width: 1023px) {
          .bf-hero .hero-inner {
            grid-template-columns: 1fr;
            gap: 40px;
            padding: 48px 32px 56px;
            text-align: left;
          }
          .bf-hero .subline { max-width: 100%; }
        }

        /* ---------- MOBILE ---------- */
        @media (max-width: 767px) {
          .bf-hero .hero-inner { padding: 36px 18px 48px; gap: 32px; }
          .bf-hero .headline { font-size: 36px; }
          .bf-hero .dash-wrap { padding: 10px; border-radius: 20px; }
          .bf-hero .dash { grid-template-columns: 1fr; min-height: 0; }
          .bf-hero .side {
            border-right: none;
            border-bottom: 1px solid var(--line);
            padding: 14px;
            gap: 10px;
          }
          .bf-hero .side-list {
            flex-direction: row;
            overflow-x: auto;
            gap: 8px;
            padding-bottom: 4px;
            scrollbar-width: none;
          }
          .bf-hero .side-list::-webkit-scrollbar { display: none; }
          .bf-hero .side-row {
            grid-template-columns: auto auto auto;
            flex-shrink: 0;
            padding: 6px 10px;
          }
          .bf-hero .side-row .lbl { font-size: 12px; }
          .bf-hero .main { padding: 16px; gap: 14px; }
          .bf-hero .main-head { flex-direction: column; align-items: flex-start; }
          .bf-hero .head-actions { width: 100%; flex-wrap: wrap; }
          .bf-hero .head-btn { font-size: 11.5px; padding: 7px 10px; }
          .bf-hero .title { font-size: 18px; }
          .bf-hero .tabs { gap: 16px; overflow-x: auto; scrollbar-width: none; }
          .bf-hero .tabs::-webkit-scrollbar { display: none; }
          .bf-hero .card-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="hero-inner">
        {/* LEFT: COPY */}
        <div className="hero-copy">
          <p className="eyebrow font-bold">Built for the build</p>
          <h1 className="headline">
            Client-ready event build reports in <span className="accent">10 minutes.</span>
          </h1>
          <p className="subline">
            Capture and sort event site photos. Export a client-safe link or polished PDF in minutes.
          </p>
          <div className="cta-row">
            <Link className="btn-primary" to="/auth">Start your first build</Link>
            <a
              className="btn-secondary"
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              See how it works →
            </a>
          </div>
        </div>

        {/* RIGHT: DASHBOARD MOCK */}
        <div className="dash-wrap" aria-hidden="true">
          <div className="dash">
            {/* SIDEBAR */}
            <aside className="side">
              <div className="side-brand">
                <BuildFolderLockup size={16} />
              </div>
              <div className="side-label">Daily Log</div>
              <div className="side-list">
                {[
                  { d: "30", m: "OCT", label: "Thu 30 Oct", count: 5, active: true },
                  { d: "28", m: "OCT", label: "Tue 28 Oct", count: 12 },
                  { d: "24", m: "OCT", label: "Fri 24 Oct", count: 8 },
                  { d: "13", m: "OCT", label: "Mon 13 Oct", count: 16 },
                  { d: "07", m: "OCT", label: "Tue 7 Oct", count: 15 },
                  { d: "02", m: "OCT", label: "Thu 2 Oct", count: 8 },
                  { d: "28", m: "SEP", label: "Sun 28 Sep", count: 9 },
                ].map((r) => (
                  <div key={r.label} className={`side-row${r.active ? " active" : ""}`}>
                    <div className="chip">
                      <span className="d">{r.d}</span>
                      <span className="m">{r.m}</span>
                    </div>
                    <span className="lbl font-bold text-orange-600">{r.label}</span>
                    <span className="cnt">{r.count}</span>
                  </div>
                ))}
              </div>
            </aside>

            {/* MAIN */}
            <div className="main">
              <div className="main-head">
                <div>
                  <div className="title-row">
                    <span className="title">Hong Kong Open</span>
                    <span className="pill green">Complete</span>
                  </div>
                  <div className="meta">Fanling · 20 Oct 2026 · HKGC</div>
                </div>
                <div className="head-actions">
                  <button type="button" className="head-btn">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
                    Share link
                  </button>
                  <button type="button" className="head-btn">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export PDF
                  </button>
                  <button type="button" className="head-btn primary">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Upload photos
                  </button>
                </div>
              </div>

              <div className="tabs">
                <span className="tab active">Updates</span>
                <span className="tab">Gallery</span>
                <span className="tab">Activity</span>
                <span className="tab">Settings</span>
              </div>

              <div className="date-sub">Thursday, 30 October 2025</div>

              <div className="card-grid">
                <div className="card">
                  <div className="card-label">Today's Objectives</div>
                  <ul>
                    <li>Final media-centre furniture set</li>
                    <li>Touch-ups on hospitality glazing</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="card-label">Today's Achievements</div>
                  <ul>
                    <li>Hospitality ready for Pro-Am</li>
                    <li>Furniture &amp; touch-ups to go for media centre</li>
                    <li>TV all ready</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="card-label">Tomorrow's Objectives</div>
                  <ul>
                    <li>Finish media centre fit-out</li>
                    <li>Walk-through with client</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="card-label">Open Issues / Risks</div>
                  <ul>
                    <li>Branding stuck at the border — a day behind before finishing</li>
                  </ul>
                </div>
              </div>

              <div className="status-list">
                <div className="status-row red">
                  <div>
                    <div className="sr-title">18th Hospitality</div>
                    <div className="sr-desc">Finished and ready for Pro-Am</div>
                  </div>
                  <span className="pill red">Delayed</span>
                </div>
                <div className="status-row blue">
                  <div>
                    <div className="sr-title">Media Centre</div>
                    <div className="sr-desc">Almost finished, final furniture to put in place</div>
                  </div>
                  <span className="pill blue">On track</span>
                </div>
                <div className="status-row green">
                  <div>
                    <div className="sr-title">Spectator Village</div>
                    <div className="sr-desc">Looking good. Final touches but ready for spectators tomorrow</div>
                  </div>
                  <span className="pill green">Complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
