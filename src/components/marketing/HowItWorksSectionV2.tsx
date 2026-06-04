/**
 * "Build to report. Three steps." — two-column, three-row layout (V2 draft).
 * Light/paper version that sits over the .bs-paper-grid background.
 */
const STEPS = [
  {
    n: "01",
    label: "Capture",
    title: "Shoot on site. Tag as you go.",
    body: "Take photos as the build happens and upload them directly from the field — no chasing the team for files later.",
    pills: ["Any device", "Upload from anywhere", "Flag issues instantly"],
  },
  {
    n: "02",
    label: "Upload & Sort",
    title: "Sorted by day, area, and status.",
    body: "Drop a batch in and BuildFolder organises everything by date and area, ready to review.",
    pills: ["Auto-grouped by day", "Area tagging", "Status pills"],
  },
  {
    n: "03",
    label: "Export & Share",
    title: "Share a link or export a PDF.",
    body: "One click sends a client-safe link or a polished PDF — branded, ordered, ready to present.",
    pills: ["Client-safe link", "Branded PDF", "Realtime updates"],
  },
] as const;

const HowItWorksSectionV2 = () => {
  return (
    <section id="how-it-works" className="hiw2">
      <style>{`
        .hiw2 {
          --ink: #0F1417;
          --paper: #FAF7F0;
          --paper-2: #F4F1EA;
          --accent: #D94F2A;
          --mute: #6B6B66;
          --line: #E5E1D6;
          --line-strong: #D9D4C5;
          font-family: 'Geist', system-ui, sans-serif;
          color: var(--ink);
          padding: 128px 48px 144px;
        }
        .hiw2 * { box-sizing: border-box; }
        .hiw2-inner { max-width: 1200px; margin: 0 auto; }

        .hiw2-head { text-align: center; margin: 0 auto 88px; max-width: 640px; }
        .hiw2-eyebrow {
          font-family: 'Geist Mono', ui-monospace, monospace;
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--accent); margin: 0 0 14px;
        }
        .hiw2-title {
          font-size: clamp(32px, 4vw, 44px);
          font-weight: 900; line-height: 1.08;
          letter-spacing: -0.02em; color: var(--ink);
          margin: 0 0 14px;
        }
        .hiw2-title .accent { color: var(--accent); }
        .hiw2-sub {
          font-size: 16px; line-height: 1.6;
          color: var(--mute); margin: 0;
        }

        .hiw2-steps { display: flex; flex-direction: column; gap: 72px; }
        .hiw2-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 48px;
          align-items: center;
          background: #FFFFFF;
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 40px 44px;
          position: relative;
        }
        /* corner brackets removed per request */
        .hiw2-row.reverse .hiw2-copy { order: 2; }
        .hiw2-row.reverse .hiw2-visual { order: 1; }

        .hiw2-num {
          display: inline-flex; align-items: baseline; gap: 10px;
          font-family: 'Geist Mono', ui-monospace, monospace;
          font-size: 13px; font-weight: 600;
          color: var(--accent);
          letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 14px;
        }
        .hiw2-num .big {
          font-family: 'Geist', system-ui, sans-serif;
          font-size: 28px; font-weight: 900;
          color: var(--ink); letter-spacing: -0.02em;
        }
        .hiw2-num .brk { color: var(--accent); font-weight: 700; }

        .hiw2-h3 {
          font-size: 26px; font-weight: 800; line-height: 1.18;
          letter-spacing: -0.018em; color: var(--ink); margin: 0 0 12px;
        }
        .hiw2-body {
          font-size: 15.5px; line-height: 1.6;
          color: var(--mute); margin: 0 0 20px;
          max-width: 460px;
        }
        .hiw2-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .hiw2-pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600;
          padding: 5px 11px; border-radius: 100px;
          background: var(--paper-2); color: var(--ink);
          border: 1px solid var(--line);
        }
        .hiw2-pill::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
        }

        /* visual placeholders */
        .hiw2-visual {
          aspect-ratio: 4 / 3;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 18px;
          display: flex; flex-direction: column; gap: 10px;
          position: relative; overflow: hidden;
        }

        /* Visual 1 — photo grid */
        .hiw2-photo-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
          gap: 8px; flex: 1;
        }
        .hiw2-photo {
          border-radius: 8px; position: relative; overflow: hidden;
          border: 1px solid var(--line);
        }
        .hiw2-photo.p1 { background: linear-gradient(135deg,#D4C9B0,#B8A87E); }
        .hiw2-photo.p2 { background: linear-gradient(135deg,#A8B5A0,#7D9B76); }
        .hiw2-photo.p3 { background: linear-gradient(135deg,#C9B099,#9E7A5C); }
        .hiw2-photo.p4 { background: linear-gradient(135deg,#B5BCC4,#7D8A98); }
        .hiw2-photo.p5 { background: linear-gradient(135deg,#D9C7B0,#A88E68); }
        .hiw2-photo.p6 { background: linear-gradient(135deg,#9FA8B0,#6B7680); }
        .hiw2-photo .tick {
          position: absolute; bottom: 6px; right: 6px;
          width: 16px; height: 16px; border-radius: 50%;
          background: #1E8A5A; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 800;
        }

        /* Visual 2 — sort cards */
        .hiw2-sort {
          display: flex; flex-direction: column; gap: 8px; flex: 1; justify-content: center;
        }
        .hiw2-sort-row {
          background: #fff; border: 1px solid var(--line); border-radius: 10px;
          padding: 10px 12px; display: flex; align-items: center; gap: 10px;
        }
        .hiw2-sort-chip {
          width: 36px; height: 36px; border-radius: 8px;
          background: var(--paper-2); border: 1px solid var(--line);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-family: 'Geist Mono', ui-monospace, monospace; line-height: 1;
        }
        .hiw2-sort-chip .d { font-size: 13px; font-weight: 700; color: var(--ink); }
        .hiw2-sort-chip .m { font-size: 8px; color: var(--mute); letter-spacing: 0.1em; margin-top: 2px; }
        .hiw2-sort-row .lbl { font-size: 13px; font-weight: 600; color: var(--ink); flex: 1; }
        .hiw2-sort-row .cnt { font-size: 11px; color: var(--mute); font-family: 'Geist Mono', ui-monospace, monospace; }

        /* Visual 3 — share/export card */
        .hiw2-share {
          flex: 1; display: flex; flex-direction: column; gap: 10px; justify-content: center;
        }
        .hiw2-link-card {
          background: #fff; border: 1px solid var(--line); border-radius: 10px;
          padding: 12px 14px; display: flex; align-items: center; gap: 10px;
        }
        .hiw2-link-card .ic {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(217,79,42,0.10); color: var(--accent);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .hiw2-link-card .body { flex: 1; min-width: 0; }
        .hiw2-link-card .t { font-size: 12.5px; font-weight: 700; color: var(--ink); }
        .hiw2-link-card .u {
          font-family: 'Geist Mono', ui-monospace, monospace;
          font-size: 10.5px; color: var(--mute);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hiw2-link-card .btn {
          background: var(--accent); color: #fff;
          font-size: 10.5px; font-weight: 700;
          padding: 6px 11px; border-radius: 100px; border: none;
        }

        /* responsive */
        @media (max-width: 1023px) {
          .hiw2 { padding: 88px 32px 96px; }
          .hiw2-steps { gap: 48px; }
          .hiw2-row { grid-template-columns: 1fr; gap: 28px; padding: 32px 28px; }
          .hiw2-row.reverse .hiw2-copy { order: 1; }
          .hiw2-row.reverse .hiw2-visual { order: 2; }
        }
        @media (max-width: 640px) {
          .hiw2 { padding: 64px 18px 72px; }
          .hiw2-steps { gap: 36px; }
          .hiw2-row { padding: 26px 22px; border-radius: 16px; }
          .hiw2-h3 { font-size: 22px; }
          .hiw2-num .big { font-size: 24px; }
        }
      `}</style>

      <div className="hiw2-inner">
        <header className="hiw2-head">
          <p className="hiw2-eyebrow">How it works</p>
          <h2 className="hiw2-title">
            Build to report. <span className="accent">Three steps.</span>
          </h2>
          <p className="hiw2-sub">
            No rebuilds. No chasing photos. Just a clean report, ready to share.
          </p>
        </header>

        <div className="hiw2-steps">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`hiw2-row${i % 2 === 1 ? " reverse" : ""}`}>
              <div className="hiw2-copy">
                <div className="hiw2-num">
                  <span className="brk">[</span>
                  <span className="big">{s.n}</span>
                  <span className="brk">]</span>
                  <span>{s.label}</span>
                </div>
                <h3 className="hiw2-h3">{s.title}</h3>
                <p className="hiw2-body">{s.body}</p>
                <div className="hiw2-pills">
                  {s.pills.map((p) => <span key={p} className="hiw2-pill">{p}</span>)}
                </div>
              </div>
              <div className="hiw2-visual" aria-hidden="true">
                {i === 0 && (
                  <>
                    <div className="hiw2-photo-grid">
                      <div className="hiw2-photo p1"><span className="tick">✓</span></div>
                      <div className="hiw2-photo p2"><span className="tick">✓</span></div>
                      <div className="hiw2-photo p3"><span className="tick">✓</span></div>
                      <div className="hiw2-photo p4"><span className="tick">✓</span></div>
                      <div className="hiw2-photo p5"></div>
                      <div className="hiw2-photo p6"></div>
                    </div>
                  </>
                )}
                {i === 1 && (
                  <div className="hiw2-sort">
                    {[
                      { d: "30", m: "OCT", label: "Hospitality", cnt: "12" },
                      { d: "30", m: "OCT", label: "Media Centre", cnt: "8" },
                      { d: "30", m: "OCT", label: "Main Stage", cnt: "15" },
                      { d: "28", m: "OCT", label: "Broadcast / TV", cnt: "6" },
                    ].map((r) => (
                      <div key={r.label + r.cnt} className="hiw2-sort-row">
                        <div className="hiw2-sort-chip">
                          <span className="d">{r.d}</span>
                          <span className="m">{r.m}</span>
                        </div>
                        <span className="lbl">{r.label}</span>
                        <span className="cnt">{r.cnt} photos</span>
                      </div>
                    ))}
                  </div>
                )}
                {i === 2 && (
                  <div className="hiw2-share">
                    <div className="hiw2-link-card">
                      <div className="ic">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      </div>
                      <div className="body">
                        <div className="t">Client share link</div>
                        <div className="u">buildfolder.app/s/hk-open-2026</div>
                      </div>
                      <button type="button" className="btn">Copy</button>
                    </div>
                    <div className="hiw2-link-card">
                      <div className="ic">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div className="body">
                        <div className="t">Hong Kong Open — Build Report.pdf</div>
                        <div className="u">12 pages · 4.2 MB · Branded</div>
                      </div>
                      <button type="button" className="btn">Export</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSectionV2;
