/**
 * Compare-plans table for the V2 pricing page. Paper canvas, yellow Crew column.
 */

type Cell = string | boolean;

type Row = {
  feature: string;
  free: Cell;
  solo: Cell;
  crew: Cell;
  studio: Cell;
};

const ROWS: Row[] = [
  { feature: "Active builds",         free: "1",         solo: "1",         crew: "5",         studio: "Unlimited" },
  { feature: "Build-day reports",     free: "3",         solo: "Unlimited", crew: "Unlimited", studio: "Unlimited" },
  { feature: "Photo uploads",         free: "Unlimited", solo: "Unlimited", crew: "Unlimited", studio: "Unlimited" },
  { feature: "Team members",          free: "1",         solo: "1",         crew: "5",         studio: "Unlimited" },
  { feature: "Free guests on reports",free: "Unlimited", solo: "Unlimited", crew: "Unlimited", studio: "Unlimited" },
  { feature: "Live share link",       free: true,        solo: true,        crew: true,        studio: true },
  { feature: "Password-protected links", free: false,    solo: false,       crew: true,        studio: true },
  { feature: "PDF export",            free: false,       solo: false,       crew: true,        studio: true },
  { feature: "Project folders & invites", free: false,   solo: false,       crew: true,        studio: true },
  { feature: "BuildFolder branding",  free: "Required",  solo: "Required",  crew: "Your logo + BF", studio: "Your logo only" },
  { feature: "White-label reports",   free: false,       solo: false,       crew: false,       studio: "Coming soon" },
  { feature: "Custom domain",         free: false,       solo: false,       crew: false,       studio: "Coming soon" },
  { feature: "Priority support",      free: false,       solo: false,       crew: false,       studio: true },
];

const renderCell = (c: Cell) => {
  if (c === true) return <span aria-label="Included">✓</span>;
  if (c === false) return <span style={{ opacity: 0.4 }} aria-label="Not included">✕</span>;
  return c;
};

const ComparePlansV2 = () => (
  <section className="compare-v2">
    <style>{`
      .compare-v2 {
        --ink: #0F1417;
        --paper-2: #F4F1EA;
        --accent: #D94F2A;
        --highlight: #FBF1ED;
        --highlight-border: rgba(217,79,42,0.35);
        --mute: #6B6B66;
        --line: #E5E1D6;
        font-family: 'Geist', system-ui, sans-serif;
        color: var(--ink);
        padding: 80px 32px 128px;
      }
      .compare-v2-inner { max-width: 1200px; margin: 0 auto; }
      .compare-v2-head { text-align: center; margin: 0 auto 48px; }
      .compare-v2-title {
        font-size: clamp(32px, 4vw, 44px);
        font-weight: 900; letter-spacing: -0.02em; margin: 0;
      }
      .compare-v2-sub {
        font-size: 15px; color: var(--mute); margin: 12px 0 0;
      }

      .compare-v2-wrap {
        overflow-x: auto;
        background: #FFFFFF;
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: 0 18px 40px -22px rgba(15,20,23,0.18);
      }
      .compare-v2-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        min-width: 760px;
        font-size: 14px;
      }
      .compare-v2-table thead th {
        text-align: left;
        font-weight: 700;
        font-size: 15px;
        padding: 22px 20px 16px;
        border-bottom: 1px solid var(--line);
        background: #FFFFFF;
        vertical-align: bottom;
      }
      .compare-v2-table thead th .plan-name { font-size: 16px; font-weight: 800; }
      .compare-v2-table thead th .plan-price {
        display: block; font-size: 13px; font-weight: 500; color: var(--mute); margin-top: 2px;
      }
      .compare-v2-table thead th.featured-col {
        background: var(--highlight);
        border-left: 1px solid var(--highlight-border);
        border-right: 1px solid var(--highlight-border);
        border-top-right-radius: 12px;
      }
      .compare-v2-table thead th.featured-col .badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--accent); color: #FFFFFF;
        font-family: 'Geist Mono', ui-monospace, monospace;
        font-size: 10.5px; font-weight: 700;
        padding: 4px 10px; border-radius: 100px;
        margin-left: 8px; vertical-align: middle;
      }
      .compare-v2-table tbody td {
        padding: 16px 20px;
        border-bottom: 1px solid var(--line);
        color: var(--ink);
      }
      .compare-v2-table tbody td.featured-col {
        background: var(--highlight);
        border-left: 1px solid var(--highlight-border);
        border-right: 1px solid var(--highlight-border);
      }
      .compare-v2-table tbody tr:last-child td { border-bottom: none; }
      .compare-v2-table tbody tr:last-child td.featured-col { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
      .compare-v2-table tbody td:first-child {
        font-weight: 500; color: var(--ink);
      }
      .compare-v2-table .cell-center { text-align: left; }
    `}</style>

    <div className="compare-v2-inner">
      <header className="compare-v2-head">
        <h2 className="compare-v2-title">Compare Plans</h2>
        <p className="compare-v2-sub">Every feature, side by side.</p>
      </header>

      <div className="compare-v2-wrap">
        <table className="compare-v2-table">
          <thead>
            <tr>
              <th>Features</th>
              <th><span className="plan-name">Free</span><span className="plan-price">HK$0</span></th>
              <th><span className="plan-name">Solo</span><span className="plan-price">HK$128/mo</span></th>
              <th className="featured-col">
                <span className="plan-name">Crew</span>
                <span className="badge">✓ Most Popular</span>
                <span className="plan-price">HK$298/mo</span>
              </th>
              <th><span className="plan-name">Studio</span><span className="plan-price">Custom</span></th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <td>{r.feature}</td>
                <td className="cell-center">{renderCell(r.free)}</td>
                <td className="cell-center">{renderCell(r.solo)}</td>
                <td className="cell-center featured-col">{renderCell(r.crew)}</td>
                <td className="cell-center">{renderCell(r.studio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export default ComparePlansV2;
