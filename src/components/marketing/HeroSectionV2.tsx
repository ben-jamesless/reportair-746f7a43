import { Link } from "react-router-dom";
import { BuildFolderLockup } from "@/components/brand/BuildFolderLockup";

/**
 * BuildFolder hero — centered, headline on top, full-width dashboard below.
 * Paper/dotted canvas (sits on .bs-paper-grid).
 */
const HeroSectionV2 = () => {
  return (
    <section className="bf-hero-v2">
      <style>{`
        .bf-hero-v2 {
          --ink: #0F1417;
          --paper: #FAF7F0;
          --paper-2: #F4F1EA;
          --accent: #D94F2A;
          --accent-hover: #B53D1F;
          --mute: #6B6B66;
          --line: #E5E1D6;
          --line-strong: #D9D4C5;
          --green: #1E8A5A;  --green-bg: #E4F5EC;
          --blue:  #2A5FA0;  --blue-bg:  #E2ECF5;
          --red:   #A52A1C;  --red-bg:   #F7E1DE;
          --font-display: 'Geist', system-ui, sans-serif;
          --font-mono: 'Geist Mono', ui-monospace, monospace;
          font-family: var(--font-display);
          color: var(--ink);
          display: block; width: 100%; position: relative;
          overflow-x: clip;
        }
        .bf-hero-v2 * { box-sizing: border-box; }

        .bf-hero-v2 .hero-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 112px 32px 128px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        /* ---------- COPY ---------- */
        .bf-hero-v2 .hero-copy { max-width: 1056px; margin: 0 auto 64px; }
        .bf-hero-v2 .headline {
          font-size: clamp(44px, 6.2vw, 76px);
          font-weight: 900;
          line-height: 1.02;
          letter-spacing: -0.03em;
          color: var(--ink);
          margin: 0 0 28px;
        }
        .bf-hero-v2 .headline .accent { color: var(--accent); }
        .bf-hero-v2 .subline {
          font-size: 19px; line-height: 1.55;
          color: var(--mute);
          margin: 0 auto 40px;
          max-width: 620px;
        }
        .bf-hero-v2 .cta-row { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; }
        .bf-hero-v2 .btn-primary {
          background: var(--accent); color: #fff;
          font-size: 15px; font-weight: 600;
          padding: 14px 28px; border-radius: 100px;
          border: none; text-decoration: none;
          box-shadow: 0 6px 18px rgba(217,79,42,0.28);
          transition: background 0.15s;
        }
        .bf-hero-v2 .btn-primary:hover { background: var(--accent-hover); }
        .bf-hero-v2 .btn-secondary {
          color: var(--ink); font-size: 15px; font-weight: 500;
          text-decoration: none;
          border: 1px solid var(--line-strong);
          padding: 13px 24px; border-radius: 100px;
          background: rgba(255,255,255,0.6);
          transition: border-color 0.2s, background 0.2s;
        }
        .bf-hero-v2 .btn-secondary:hover { border-color: var(--ink); background: #fff; }

        /* ---------- DASHBOARD MOCK ---------- */
        .bf-hero-v2 .dash-wrap {
          position: relative; width: 100%; max-width: 1200px; margin: 0 auto;
          padding: 0;
          border-radius: 22px 22px 0 0;
          background: transparent;
          border: none;
          box-shadow:
            -28px 0 70px -18px rgba(15,20,23,0.22),
            28px 0 70px -18px rgba(15,20,23,0.22),
            0 -26px 60px -18px rgba(15,20,23,0.22);
          overflow: hidden;
          max-height: 760px;
          -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 88%, transparent 100%);
                  mask-image: linear-gradient(to bottom, #000 0, #000 88%, transparent 100%);
        }
        /* corner brackets removed per request */

        .bf-hero-v2 .dash {
          background: #FFFFFF;
          border-radius: 22px 22px 0 0;
          overflow: hidden;
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr);
          color: var(--ink);
          min-height: 640px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          border: 1px solid var(--line);
          border-bottom: none;
          text-align: left;
        }

        /* sidebar — dark */
        .bf-hero-v2 .side {
          background: #0F1417;
          padding: 20px 16px 20px 18px;
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex; flex-direction: column; gap: 14px;
        }
        .bf-hero-v2 .side-brand { padding: 4px 4px 6px; }
        .bf-hero-v2 .side-label {
          font-family: var(--font-mono);
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.55); padding: 2px 4px;
        }
        .bf-hero-v2 .side-list { display: flex; flex-direction: column; gap: 4px; }
        .bf-hero-v2 .side-row {
          display: grid; grid-template-columns: 38px 1fr auto;
          align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 10px; color: #fff;
        }
        .bf-hero-v2 .side-row .chip {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 8px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
          font-family: var(--font-mono); line-height: 1;
        }
        .bf-hero-v2 .side-row .chip .d { font-size: 14px; font-weight: 700; color: #fff; }
        .bf-hero-v2 .side-row .chip .m { font-size: 8px; letter-spacing: 0.12em; color: rgba(255,255,255,0.55); margin-top: 2px; }
        .bf-hero-v2 .side-row .lbl { font-size: 13px; font-weight: 600; color: #fff; }
        .bf-hero-v2 .side-row .cnt { font-size: 12px; color: rgba(255,255,255,0.55); font-family: var(--font-mono); }
        .bf-hero-v2 .side-row.active { background: var(--accent); }
        .bf-hero-v2 .side-row.active .chip { background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.3); }
        .bf-hero-v2 .side-row.active .chip .d,
        .bf-hero-v2 .side-row.active .chip .m,
        .bf-hero-v2 .side-row.active .lbl,
        .bf-hero-v2 .side-row.active .cnt { color: #fff; }

        /* main */
        .bf-hero-v2 .main { padding: 22px 26px 24px; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
        .bf-hero-v2 .main-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .bf-hero-v2 .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .bf-hero-v2 .title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
        .bf-hero-v2 .pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600;
          padding: 4px 10px; border-radius: 100px; white-space: nowrap;
        }
        .bf-hero-v2 .pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .bf-hero-v2 .pill.green { color: var(--green); background: var(--green-bg); }
        .bf-hero-v2 .pill.blue  { color: var(--blue);  background: var(--blue-bg);  }
        .bf-hero-v2 .pill.red   { color: var(--red);   background: var(--red-bg);   }

        .bf-hero-v2 .meta {
          font-family: var(--font-mono);
          font-size: 11px; color: var(--mute);
          letter-spacing: 0.04em; margin-top: 4px;
        }
        .bf-hero-v2 .head-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
        .bf-hero-v2 .head-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11.5px; font-weight: 600;
          padding: 7px 10px; border-radius: 9px;
          border: 1px solid var(--line);
          background: #fff; color: var(--ink); white-space: nowrap;
        }
        .bf-hero-v2 .head-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }

        .bf-hero-v2 .tabs { display: flex; gap: 22px; border-bottom: 1px solid var(--line); }
        .bf-hero-v2 .tab {
          font-size: 13px; font-weight: 600; color: var(--mute);
          padding: 8px 0; border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .bf-hero-v2 .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        .bf-hero-v2 .date-sub { font-size: 14px; font-weight: 700; color: var(--ink); }

        .bf-hero-v2 .card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .bf-hero-v2 .card { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
        .bf-hero-v2 .card-label {
          font-family: var(--font-mono);
          font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--mute); margin-bottom: 8px;
        }
        .bf-hero-v2 .card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .bf-hero-v2 .card li { font-size: 12.5px; line-height: 1.4; color: var(--ink); padding-left: 14px; position: relative; }
        .bf-hero-v2 .card li::before { content: '•'; color: var(--accent); position: absolute; left: 0; top: 0; font-size: 14px; line-height: 1.2; }

        .bf-hero-v2 .status-list { display: flex; flex-direction: column; gap: 8px; }
        .bf-hero-v2 .status-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: #fff; border: 1px solid var(--line);
          border-left: 4px solid var(--line); border-radius: 8px;
          padding: 10px 14px;
        }
        .bf-hero-v2 .status-row.red   { border-left-color: var(--red); }
        .bf-hero-v2 .status-row.blue  { border-left-color: var(--blue); }
        .bf-hero-v2 .status-row.green { border-left-color: var(--green); }
        .bf-hero-v2 .status-row .sr-title { font-size: 13.5px; font-weight: 700; color: var(--ink); }
        .bf-hero-v2 .status-row .sr-desc  { font-size: 12px; color: var(--mute); margin-top: 2px; }

        /* ---------- TABLET ---------- */
        @media (max-width: 1023px) {
          .bf-hero-v2 .hero-inner { padding: 72px 24px 88px; }
          .bf-hero-v2 .hero-copy { margin-bottom: 48px; }
          .bf-hero-v2 .dash { grid-template-columns: 200px minmax(0, 1fr); }
          .bf-hero-v2 .main { padding: 18px 18px 20px; }
          .bf-hero-v2 .head-actions { justify-content: flex-start; }
        }

        /* ---------- MOBILE ---------- */
        @media (max-width: 767px) {
          .bf-hero-v2 .hero-inner { padding: 56px 16px 64px; }
          .bf-hero-v2 .hero-copy { margin-bottom: 36px; }
          .bf-hero-v2 .dash-wrap { padding: 10px; border-radius: 16px; }
          .bf-hero-v2 .dash { grid-template-columns: minmax(0, 1fr); min-height: 0; }
          .bf-hero-v2 .side { border-right: none; border-bottom: 1px solid var(--line); padding: 14px; gap: 10px; min-width: 0; max-width: 100%; overflow: hidden; }
          .bf-hero-v2 .side-list { flex-direction: row; overflow-x: auto; gap: 8px; padding-bottom: 4px; scrollbar-width: none; min-width: 0; max-width: 100%; }
          .bf-hero-v2 .side-list::-webkit-scrollbar { display: none; }
          .bf-hero-v2 .side-row { grid-template-columns: auto auto auto; flex-shrink: 0; padding: 6px 10px; }
          .bf-hero-v2 .main { padding: 16px; gap: 14px; min-width: 0; max-width: 100%; overflow: hidden; }
          .bf-hero-v2 .title { font-size: 18px; }
          .bf-hero-v2 .tabs { gap: 16px; overflow-x: auto; scrollbar-width: none; min-width: 0; max-width: 100%; }
          .bf-hero-v2 .tabs::-webkit-scrollbar { display: none; }
          .bf-hero-v2 .card-grid { grid-template-columns: minmax(0, 1fr); }
          .bf-hero-v2 .card { min-width: 0; max-width: 100%; overflow: hidden; }
          .bf-hero-v2 .card li { word-break: break-word; }
        }
      `}</style>

      <div className="hero-inner">
        <div className="hero-copy">
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

        <div className="dash-wrap" aria-hidden="true">
          <div className="dash">
            <aside className="side">
              <div className="side-brand"><BuildFolderLockup size={16} onDark /></div>
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
                    <div className="chip"><span className="d">{r.d}</span><span className="m">{r.m}</span></div>
                    <span className="lbl font-bold text-orange-600">{r.label}</span>
                    <span className="cnt">{r.count}</span>
                  </div>
                ))}
              </div>
            </aside>

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
                    <li>Back Drop, AV and Furniture install for Media Centre</li>
                    <li>Touch-ups on hospitality final features</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="card-label">Today's Achievements</div>
                  <ul>
                    <li>Hospitality ready for Pro-Am</li>
                    <li>AV and backdrop all installed</li>
                    <li>TV OB all ready</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="card-label">Tomorrow's Objectives</div>
                  <ul>
                    <li>Finish media centre fit-out</li>
                    <li>Final walkthrough with client</li>
                  </ul>
                </div>
                <div className="card">
                  <div className="card-label">Open Issues / Risks</div>
                  <ul>
                    <li>Furniture delayed from supplier's other project</li>
                  </ul>
                </div>
              </div>

              <div className="status-list">
                <div className="status-row red">
                  <div>
                    <div className="sr-title">Media Centre</div>
                    <div className="sr-desc">Furniture and AV outstanding</div>
                  </div>
                  <span className="pill red">Delay</span>
                </div>
                <div className="status-row blue">
                  <div>
                    <div className="sr-title">Hospitality</div>
                    <div className="sr-desc">Glazing touch-ups in progress</div>
                  </div>
                  <span className="pill blue">On Track</span>
                </div>
                <div className="status-row green">
                  <div>
                    <div className="sr-title">Broadcast / TV</div>
                    <div className="sr-desc">Signed off this morning</div>
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

export default HeroSectionV2;
