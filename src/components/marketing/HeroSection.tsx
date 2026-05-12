import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * ReportAir hero section — responsive (desktop / tablet / mobile).
 * Self-contained: scoped styles + animations + horizontal/vertical SVG swap.
 */
const HeroSection = () => {
  useEffect(() => {
    const isVertical = () => window.innerWidth < 1024;
    const apply = () => {
      const v = isVertical();
      const set = (sel: string, show: boolean) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (el) el.style.display = show ? "" : "none";
      };
      set(".ra-hero .lines-h", !v);
      set(".ra-hero .lines-v", v);
      set(".ra-hero .out-h", !v);
      set(".ra-hero .out-v", v);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return (
    <section className="ra-hero">
      <style>{`
        .ra-hero {
          --sky: #1A6EFF;
          --sky-soft: #A8C4FF;
          --ink: #0F1724;
          --slate: #3D4F66;
          --mist: #7A8FA8;
          --cloud: #EDF1F7;
          --fog: #F5F7FA;
          --border: #D0D9E8;
          --green: #1DB87A;
          --green-bg: #E8F8F1;
          --amber: #FF8C00;
          --amber-bg: #FFF4E5;
          --font-display: 'Plus Jakarta Sans', sans-serif;
          --font-body: 'Inter', sans-serif;
          background: #060D18;
          font-family: var(--font-body);
          display: block;
          width: 100%;
          position: relative;
        }
        .ra-hero * { box-sizing: border-box; }

        .ra-hero .hero-inner {
          display: flex;
          align-items: center;
          padding: 64px 48px 80px;
          gap: 48px;
          max-width: 1280px;
          margin: 0 auto;
          width: 100%;
          position: relative;
        }
        .ra-hero .hero-inner::before {
          content: '';
          position: absolute;
          top: 40%;
          left: 38%;
          transform: translate(-50%, -50%);
          width: 600px; height: 400px;
          background: radial-gradient(ellipse, rgba(26,110,255,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .ra-hero .hero-copy { flex: 0 0 420px; position: relative; z-index: 2; }
        .ra-hero .eyebrow {
          font-family: var(--font-display);
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(168,196,255,0.7);
          margin-bottom: 20px;
        }
        .ra-hero .headline {
          font-family: var(--font-display);
          font-size: 52px; font-weight: 800;
          line-height: 1.08; color: #fff;
          margin-bottom: 24px;
        }
        .ra-hero .headline .accent { color: var(--sky); }
        .ra-hero .subline {
          font-size: 16px; line-height: 1.65;
          color: rgba(255,255,255,0.5);
          margin-bottom: 40px; max-width: 360px;
        }
        .ra-hero .cta-row { display: flex; gap: 14px; align-items: center; }
        .ra-hero .btn-primary {
          background: var(--sky); color: #fff;
          font-family: var(--font-display);
          font-size: 15px; font-weight: 600;
          padding: 13px 28px; border-radius: 100px;
          border: none; cursor: pointer;
          text-decoration: none; display: inline-block;
        }
        .ra-hero .btn-primary:hover { background: #0D47B5; }
        .ra-hero .btn-secondary {
          color: rgba(255,255,255,0.65);
          font-family: var(--font-display);
          font-size: 15px; font-weight: 500;
          text-decoration: none; display: inline-flex;
          align-items: center; gap: 6px;
          border: 1px solid rgba(255,255,255,0.15);
          padding: 12px 24px; border-radius: 100px;
          transition: border-color 0.2s, color 0.2s;
        }
        .ra-hero .btn-secondary:hover { border-color: rgba(255,255,255,0.35); color: #fff; }

        .ra-hero .hero-graphic {
          flex: 1; display: flex;
          align-items: center; justify-content: center;
          position: relative; z-index: 2; min-width: 0;
        }
        .ra-hero .stage {
          width: 100%; max-width: 680px;
          background: linear-gradient(145deg, #0B1830 0%, #0E2040 50%, #0B1830 100%);
          border-radius: 24px;
          border: 1px solid rgba(26,110,255,0.18);
          padding: 44px 36px;
          display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
        }
        .ra-hero .stage::before {
          content: '';
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(26,110,255,0.13) 0%, transparent 70%);
          pointer-events: none; border-radius: 50%;
        }

        .ra-hero .inputs { display: flex; flex-direction: column; gap: 10px; flex: 0 0 auto; }
        .ra-hero .chip {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px 9px 9px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; width: 172px;
          opacity: 0; transform: translateX(-20px);
          animation: ra-chipIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .ra-hero .chip:nth-child(1) { animation-delay: 0.1s; }
        .ra-hero .chip:nth-child(2) { animation-delay: 0.25s; }
        .ra-hero .chip:nth-child(3) { animation-delay: 0.4s; }
        .ra-hero .chip:nth-child(4) { animation-delay: 0.55s; }
        .ra-hero .chip:nth-child(5) { animation-delay: 0.7s; }
        @keyframes ra-chipIn { to { opacity: 1; transform: translateX(0); } }

        .ra-hero .chip-icon {
          width: 34px; height: 34px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ra-hero .chip-icon.wa  { background: rgba(37,211,102,0.13); }
        .ra-hero .chip-icon.ph  { background: rgba(255,140,0,0.12); }
        .ra-hero .chip-icon.xl  { background: rgba(33,163,80,0.14); }
        .ra-hero .chip-icon.ppt { background: rgba(209,52,52,0.13); }
        .ra-hero .chip-icon.em  { background: rgba(26,110,255,0.14); }
        .ra-hero .chip-label {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 600;
          color: #C8D8EC; white-space: nowrap;
        }

        .ra-hero .lines-svg { flex: 0 0 88px; height: 272px; overflow: visible; }
        .ra-hero .flow-line { stroke-dasharray: 220; stroke-dashoffset: 220; animation: ra-drawLine 0.5s cubic-bezier(0.4,0,0.2,1) forwards; }
        .ra-hero .flow-line:nth-of-type(1) { animation-delay: 0.3s; }
        .ra-hero .flow-line:nth-of-type(2) { animation-delay: 0.45s; }
        .ra-hero .flow-line:nth-of-type(3) { animation-delay: 0.6s; }
        .ra-hero .flow-line:nth-of-type(4) { animation-delay: 0.75s; }
        .ra-hero .flow-line:nth-of-type(5) { animation-delay: 0.9s; }
        @keyframes ra-drawLine { to { stroke-dashoffset: 0; } }

        .ra-hero .node-wrap { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2; }
        .ra-hero .node {
          width: 80px; height: 80px; border-radius: 20px;
          background: var(--sky);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 5px; opacity: 0; transform: scale(0.7);
          box-shadow: 0 0 0 0 rgba(26,110,255,0.5), 0 8px 40px rgba(26,110,255,0.35);
          animation: ra-nodeIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.85s forwards,
                     ra-nodePulse 2.8s ease-in-out 1.6s infinite;
        }
        @keyframes ra-nodeIn { to { opacity: 1; transform: scale(1); } }
        @keyframes ra-nodePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(26,110,255,0.45), 0 8px 40px rgba(26,110,255,0.35); }
          50%      { box-shadow: 0 0 0 14px rgba(26,110,255,0), 0 8px 40px rgba(26,110,255,0.35); }
        }
        .ra-hero .node svg { width: 32px; height: 32px; }
        .ra-hero .node-label {
          font-family: var(--font-display);
          font-size: 7.5px; font-weight: 800;
          letter-spacing: 0.12em; color: rgba(255,255,255,0.92);
          text-transform: uppercase;
        }

        .ra-hero .out-line-svg { flex: 0 0 60px; height: 32px; overflow: visible; }
        .ra-hero .out-line { stroke-dasharray: 120; stroke-dashoffset: 120; animation: ra-drawLine 0.45s cubic-bezier(0.4,0,0.2,1) 1.3s forwards; }

        .ra-hero .report-card {
          background: #fff; border-radius: 14px; overflow: hidden;
          width: 256px; flex-shrink: 0; color: var(--ink);
          opacity: 0; transform: translateX(24px);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07);
          animation: ra-cardIn 0.6s cubic-bezier(0.16,1,0.3,1) 1.5s forwards;
        }
        @keyframes ra-cardIn { to { opacity: 1; transform: translateX(0); } }

        .ra-hero .rc-header {
          background: var(--ink); padding: 10px 14px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .ra-hero .rc-logo { display: flex; align-items: center; gap: 6px; }
        .ra-hero .rc-logo svg { width: 18px; height: 18px; }
        .ra-hero .rc-logo-text {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; color: #fff; text-transform: uppercase;
        }
        .ra-hero .rc-dr { font-size: 9px; color: #3A5070; }

        .ra-hero .rc-meta {
          background: var(--cloud); padding: 8px 14px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--border);
        }
        .ra-hero .rc-event { font-family: var(--font-display); font-size: 10px; font-weight: 700; color: var(--ink); }
        .ra-hero .rc-day { font-size: 9px; color: var(--mist); }

        .ra-hero .rc-status-row {
          padding: 7px 14px; display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--border);
        }
        .ra-hero .rc-status-label {
          font-size: 8px; font-weight: 600; letter-spacing: 0.07em;
          text-transform: uppercase; color: var(--mist);
        }
        .ra-hero .pill { font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 100px; }
        .ra-hero .pill-green { color: var(--green); background: var(--green-bg); }
        .ra-hero .pill-amber { color: var(--amber); background: var(--amber-bg); }

        .ra-hero .rc-th {
          display: grid; grid-template-columns: 1fr 76px 32px;
          padding: 4px 14px; font-size: 8px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--mist); background: var(--fog);
          border-bottom: 1px solid var(--border);
        }
        .ra-hero .rc-row {
          display: grid; grid-template-columns: 1fr 76px 32px;
          padding: 6px 14px; align-items: center;
          border-bottom: 1px solid var(--fog);
          position: relative; opacity: 0; transform: translateY(4px);
          animation: ra-rowIn 0.35s ease forwards;
        }
        .ra-hero .rc-row:nth-of-type(1) { animation-delay: 1.75s; }
        .ra-hero .rc-row:nth-of-type(2) { animation-delay: 1.9s; }
        .ra-hero .rc-row:nth-of-type(3) { animation-delay: 2.05s; }
        .ra-hero .rc-row::before {
          content: ''; position: absolute;
          left: 0; top: 4px; bottom: 4px; width: 3px; border-radius: 0 2px 2px 0;
        }
        .ra-hero .rc-row.green::before { background: var(--green); }
        .ra-hero .rc-row.amber::before { background: var(--amber); }
        .ra-hero .rc-row .area-name {
          font-family: var(--font-display); font-weight: 600;
          font-size: 10px; color: var(--ink); padding-left: 4px;
        }
        .ra-hero .rc-row .photos { font-size: 10px; color: var(--slate); text-align: center; }
        .ra-hero .pill-sm { font-size: 8px; font-weight: 600; padding: 2px 6px; border-radius: 100px; }

        .ra-hero .rc-footer {
          padding: 8px 14px; background: var(--fog);
          display: flex; align-items: center; gap: 5px;
          opacity: 0; animation: ra-rowIn 0.4s ease 2.2s forwards;
        }
        .ra-hero .rc-footer-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sky); }
        .ra-hero .rc-footer-text { font-size: 9px; color: var(--sky); font-weight: 500; }
        @keyframes ra-rowIn { to { opacity: 1; transform: translateY(0); } }

        /* Tablet */
        @media (min-width: 768px) and (max-width: 1023px) {
          .ra-hero .hero-inner { padding: 40px 32px 56px; gap: 28px; align-items: center; }
          .ra-hero .hero-copy { flex: 0 0 280px; }
          .ra-hero .headline { font-size: 34px; }
          .ra-hero .subline { font-size: 13px; margin-bottom: 28px; }
          .ra-hero .btn-primary, .ra-hero .btn-secondary { font-size: 13px; padding: 10px 18px; }
          .ra-hero .stage { flex-direction: column; padding: 28px 24px; border-radius: 18px; align-items: center; flex: 1; min-width: 0; }
          .ra-hero .inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
          .ra-hero .chip:last-child { grid-column: 1 / -1; }
          .ra-hero .chip { width: 100%; padding: 9px 12px 9px 9px; transform: none; animation: ra-fadeIn 0.5s ease forwards; }
          .ra-hero .chip-icon { width: 30px; height: 30px; }
          .ra-hero .chip-icon svg { width: 16px; height: 16px; }
          .ra-hero .lines-svg { flex: none; width: 100%; max-width: 320px; height: 64px; display: block; }
          .ra-hero .node { width: 68px; height: 68px; }
          .ra-hero .node svg { width: 27px; height: 27px; }
          .ra-hero .node-label { font-size: 6.5px; }
          .ra-hero .out-line-svg { flex: none; width: 32px; height: 48px; display: block; }
          .ra-hero .report-card { width: 100%; max-width: 360px; }
        }

        /* Mobile */
        @media (max-width: 767px) {
          .ra-hero .hero-inner {
            flex-direction: column; align-items: stretch;
            padding: 40px 20px 56px; gap: 36px; text-align: center;
          }
          .ra-hero .hero-inner::before { display: none; }
          .ra-hero .hero-copy { flex: none; width: 100%; }
          .ra-hero .eyebrow { font-size: 10px; }
          .ra-hero .headline { font-size: 36px; line-height: 1.1; }
          .ra-hero .subline { font-size: 14px; max-width: 100%; margin-left: auto; margin-right: auto; }
          .ra-hero .cta-row { justify-content: center; flex-wrap: wrap; }
          .ra-hero .hero-graphic { width: 100%; }
          .ra-hero .stage { flex-direction: column; padding: 28px 16px; border-radius: 20px; align-items: center; }
          .ra-hero .inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
          .ra-hero .chip:last-child { grid-column: 1 / -1; }
          .ra-hero .chip { width: 100%; padding: 10px 14px 10px 10px; transform: none; animation: ra-fadeIn 0.5s ease forwards; }
          .ra-hero .chip-icon { width: 28px; height: 28px; border-radius: 7px; }
          .ra-hero .chip-icon svg { width: 15px; height: 15px; }
          .ra-hero .chip-label { font-size: 12px; }
          .ra-hero .lines-svg { flex: none; width: 100%; max-width: 300px; height: 64px; display: block; }
          .ra-hero .node { width: 68px; height: 68px; border-radius: 17px; }
          .ra-hero .node svg { width: 28px; height: 28px; }
          .ra-hero .node-label { font-size: 7px; }
          .ra-hero .out-line-svg { flex: none; width: 32px; height: 52px; display: block; }
          .ra-hero .report-card { width: 100%; max-width: 340px; border-radius: 14px; }
        }
        @keyframes ra-fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div className="hero-inner">
        {/* LEFT: COPY */}
        <div className="hero-copy">
          <p className="eyebrow">From the field. In the air. Every time.</p>
          <h1 className="headline">
            Client-ready event build reports in <span className="accent">10 minutes.</span>
          </h1>
          <p className="subline">
            Capture and sort site photos. Export a polished PDF or client-safe link in minutes.
          </p>
          <div className="cta-row">
            <Link className="btn-primary" to="/auth">Sign in</Link>
            <a className="btn-secondary" href="#product">See how it works →</a>
          </div>
        </div>

        {/* RIGHT: GRAPHIC */}
        <div className="hero-graphic">
          <div className="stage">
            {/* INPUT CHIPS */}
            <div className="inputs">
              <div className="chip">
                <div className="chip-icon wa">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#25D366" opacity="0.9" />
                    <path d="M17.5 14.3c-.3-.1-1.6-.8-1.8-.9-.3-.1-.5-.1-.7.1-.2.2-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.2-.6-1.6-.9-2.1-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4C8 7.7 7 8.7 7 10.1s1 2.7 1.2 2.9c.2.2 2 3.1 5 4.2.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.1-1.4-.1-.2-.3-.2-.5-.3z" fill="#fff" />
                  </svg>
                </div>
                <span className="chip-label">WhatsApp</span>
              </div>
              <div className="chip">
                <div className="chip-icon ph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="rgba(255,140,0,0.15)" />
                    <rect x="3" y="6" width="18" height="13" rx="2" stroke="#FF8C00" strokeWidth="1.5" />
                    <circle cx="8.5" cy="11" r="2" fill="#FF8C00" opacity="0.7" />
                    <path d="M3 16l4-4 3 3 3-4 5 5" stroke="#FF8C00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="chip-label">Photos</span>
              </div>
              <div className="chip">
                <div className="chip-icon xl">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="rgba(33,163,80,0.15)" />
                    <path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-6-6z" stroke="#21A350" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M13 3v6h6" stroke="#21A350" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M9 13l2 2 4-4" stroke="#21A350" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="chip-label">Excel</span>
              </div>
              <div className="chip">
                <div className="chip-icon ppt">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="rgba(209,52,52,0.15)" />
                    <path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-6-6z" stroke="#D13434" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M13 3v6h6" stroke="#D13434" strokeWidth="1.5" strokeLinecap="round" />
                    <rect x="8" y="13" width="5" height="4" rx="1" stroke="#D13434" strokeWidth="1.3" />
                    <path d="M13 15h2" stroke="#D13434" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="chip-label">PowerPoint</span>
              </div>
              <div className="chip">
                <div className="chip-icon em">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="5" fill="rgba(26,110,255,0.15)" />
                    <rect x="3" y="6" width="18" height="13" rx="2" stroke="#1A6EFF" strokeWidth="1.5" />
                    <path d="M3 9l9 6 9-6" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="chip-label">Email</span>
              </div>
            </div>

            {/* Funnel — horizontal (desktop) */}
            <svg className="lines-svg lines-h" viewBox="0 0 88 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path className="flow-line" d="M0 26  C44 26  44 150 88 150" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
              <path className="flow-line" d="M0 88  C44 88  44 150 88 150" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              <path className="flow-line" d="M0 150 L88 150" stroke="#1A6EFF" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
              <path className="flow-line" d="M0 212 C44 212 44 150 88 150" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              <path className="flow-line" d="M0 274 C44 274 44 150 88 150" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
              <path d="M80 146 L88 150 L80 154" stroke="#1A6EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
            </svg>

            {/* Funnel — vertical (tablet/mobile) */}
            <svg className="lines-svg lines-v" viewBox="0 0 276 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "none" }}>
              <path className="flow-line" d="M26 0  C26 36 138 36 138 72" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
              <path className="flow-line" d="M82 0  C82 36 138 36 138 72" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              <path className="flow-line" d="M138 0 L138 72" stroke="#1A6EFF" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
              <path className="flow-line" d="M194 0 C194 36 138 36 138 72" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              <path className="flow-line" d="M250 0 C250 36 138 36 138 72" stroke="#1A6EFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
              <path d="M134 64 L138 72 L142 64" stroke="#1A6EFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
            </svg>

            {/* Centre node */}
            <div className="node-wrap">
              <div className="node">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="11" y="19" width="60" height="50" rx="6" stroke="rgba(168,196,255,0.7)" strokeWidth="5" />
                  <rect x="27" y="35" width="60" height="50" rx="6" stroke="#fff" strokeWidth="7.5" />
                </svg>
                <span className="node-label">ReportAir</span>
              </div>
            </div>

            {/* Output line — horizontal */}
            <svg className="out-line-svg out-h" viewBox="0 0 60 32" fill="none">
              <line className="out-line" x1="2" y1="16" x2="52" y2="16" stroke="#1A6EFF" strokeWidth="2" strokeLinecap="round" />
              <path d="M44 10 L54 16 L44 22" fill="none" stroke="#1A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* Output line — vertical */}
            <svg className="out-line-svg out-v" viewBox="0 0 32 52" fill="none" style={{ display: "none" }}>
              <line className="out-line" x1="16" y1="2" x2="16" y2="44" stroke="#1A6EFF" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 36 L16 46 L22 36" fill="none" stroke="#1A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* Report card */}
            <div className="report-card">
              <div className="rc-header">
                <div className="rc-logo">
                  <svg viewBox="0 0 100 100" fill="none">
                    <rect x="11" y="19" width="60" height="50" rx="6" stroke="#A8C4FF" strokeWidth="4.4" />
                    <rect x="27" y="35" width="60" height="50" rx="6" stroke="#1A6EFF" strokeWidth="6.8" />
                  </svg>
                  <span className="rc-logo-text">ReportAir</span>
                </div>
                <span className="rc-dr">No. DR-002</span>
              </div>
              <div className="rc-meta">
                <div className="rc-event">Northstar Festival · Day 3</div>
                <div className="rc-day">Tue 12 May 2026</div>
              </div>
              <div className="rc-status-row">
                <span className="rc-status-label">Overall Status</span>
                <span className="pill pill-green">On Track</span>
              </div>
              <div className="rc-th">
                <span>Area</span>
                <span>Status</span>
                <span>Photos</span>
              </div>
              <div className="rc-row green">
                <span className="area-name">Main Stage</span>
                <span className="pill-sm pill-green">On Track</span>
                <span className="photos">12</span>
              </div>
              <div className="rc-row amber">
                <span className="area-name">VIP Tent</span>
                <span className="pill-sm pill-amber">Discussion</span>
                <span className="photos">5</span>
              </div>
              <div className="rc-row green">
                <span className="area-name">Power & AV</span>
                <span className="pill-sm pill-green">Complete</span>
                <span className="photos">8</span>
              </div>
              <div className="rc-footer">
                <div className="rc-footer-dot" />
                <span className="rc-footer-text">PDF ready · Share link active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
