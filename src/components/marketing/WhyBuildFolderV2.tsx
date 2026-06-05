/**
 * Why Build Folder — 2×2 benefits section on ink ground.
 * Slotted into V2 home between WhyWeBuiltV2 (manifesto) and UseCasesSection.
 */
const WhyBuildFolderV2 = () => {
  return (
    <section className="bf-why" id="why-build-folder">
      <style>{`
        .bf-why {
          --ink: #0F1417;
          --paper: #FAF7F0;
          --accent: #D94F2A;
          --font-display: 'Geist', system-ui, sans-serif;
          background: var(--ink);
          color: var(--paper);
          padding: clamp(80px, 11vw, 140px) 0;
          position: relative;
          overflow: hidden;
          background-image: radial-gradient(rgba(244,241,234,.066) 1px, transparent 1.4px);
          background-size: 26px 26px;
          font-family: var(--font-display);
        }
        .bf-why * { box-sizing: border-box; }
        .bf-why .why-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 32px;
        }
        .bf-why .label {
          color: var(--accent);
          font-family: 'Geist Mono', ui-monospace, monospace;
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .bf-why h2 {
          color: var(--paper);
          margin: 14px 0 0;
          max-width: 20ch;
          font-size: clamp(36px, 5vw, 60px);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -0.03em;
        }
        .bf-why h2 .o { color: var(--accent); }
        .bf-why .why-lead {
          color: rgba(244,241,234,.62);
          font-size: clamp(15px, 1.6vw, 17px);
          line-height: 1.55;
          max-width: 56ch;
          margin: 18px 0 0;
        }
        .bf-why .why-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(40px, 5vw, 72px) clamp(48px, 6vw, 96px);
          margin-top: clamp(48px, 6vw, 80px);
        }
        @media (max-width: 760px) {
          .bf-why .why-container { padding: 0 20px; }
          .bf-why .why-grid { grid-template-columns: 1fr; gap: 44px; }
        }
        .bf-why .why-card { display: block; }
        .bf-why .why-ico {
          width: 56px; height: 56px; border-radius: 14px;
          border: 1px solid rgba(244,241,234,.14);
          background: rgba(244,241,234,.03);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 22px;
        }
        .bf-why .why-ico svg {
          width: 28px; height: 28px;
          stroke: var(--accent); fill: none;
          stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
        }
        .bf-why .why-card h3 {
          font-family: var(--font-display);
          font-weight: 900;
          letter-spacing: -0.02em;
          font-size: clamp(20px, 2.3vw, 26px);
          color: var(--paper);
          margin: 0 0 10px;
        }
        .bf-why .why-card h3 .o { color: var(--accent); }
          color: rgba(244,241,234,.66);
          font-size: 15px;
          line-height: 1.55;
          margin: 0;
          max-width: 42ch;
        }
      `}</style>

      <div className="why-container">
        <span className="label">Why Build Folder</span>
        <h2>A photo first workflow, <span className="o">not a bucket.</span></h2>
        <p className="why-lead">
          Photos don't just land in a folder and sit there. They sort, process and file themselves as the build moves. The event record builds itself and is there when you need it.
        </p>

        <div className="why-grid">
          <div className="why-card">
            <div className="why-ico">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h13"/><path d="M3 12h9"/><path d="M3 18h5"/><path d="M18 9l3 3-3 3"/><path d="M21 12h-9"/></svg>
            </div>
            <h3><span className="o">Sorted</span>, not dumped</h3>
            <p>Every photo is sorted and processed the moment it is uploaded, by area by day, automatically. Our workflow does the filing, it's not a bucket you dig through later.</p>
          </div>

          <div className="why-card">
            <div className="why-ico">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4"/><path d="M17 12h4"/><circle cx="12" cy="12" r="3"/><path d="M10 5h4"/><path d="M10 19h4"/></svg>
            </div>
            <h3><span className="o">A Live</span> build timeline</h3>
            <p>Every build shows its status, day by day, as it happens. Share one live link with the team or the client so they can see progress without a single email chase.</p>
          </div>

          <div className="why-card">
            <div className="why-ico">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
            </div>
            <h3><span className="o">Hours Back</span> on admin</h3>
            <p>No copy-pasting photos into decks at midnight. The daily report is already built by the time the team is ready to leave. Just hit export for a fully branded daily report.</p>
          </div>

          <div className="why-card">
            <div className="why-ico">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M4 8l1.5-3h13L20 8"/><path d="M10 12h4"/></svg>
            </div>
            <h3><span className="o">A Record</span> that lasts</h3>
            <p>Long after the build comes down, every photo is stored and in order. Export the full project in files by area or date ready. No searching through a individual photo galleries or an online bucket. It is all on the record, in place.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyBuildFolderV2;
