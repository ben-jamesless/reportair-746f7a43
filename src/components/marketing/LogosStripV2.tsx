/**
 * "Built for builds like these" — logo strip on paper canvas.
 */
const LOGOS = ["Ryder Cup", "Art Basel", "F1 Paddock", "LFW", "Clockenflap", "ComplexCon"];

const LogosStripV2 = () => (
  <section className="logos-v2">
    <style>{`
      .logos-v2 { padding: 56px 32px 72px; text-align: center; font-family: 'Geist', system-ui, sans-serif; }
      .logos-v2 .lbl {
        font-family: 'Geist Mono', ui-monospace, monospace;
        font-size: 11px; font-weight: 500;
        letter-spacing: 0.22em; text-transform: uppercase;
        color: #6B6B66; margin: 0 0 28px;
      }
      .logos-v2 .row {
        display: flex; flex-wrap: wrap; justify-content: center;
        gap: 48px 56px; max-width: 1080px; margin: 0 auto;
      }
      .logos-v2 .item {
        font-size: 22px; font-weight: 700; color: #0F1417;
        letter-spacing: -0.01em; opacity: 0.78;
      }
      @media (max-width: 640px) {
        .logos-v2 { padding: 40px 18px 48px; }
        .logos-v2 .row { gap: 22px 28px; }
        .logos-v2 .item { font-size: 17px; }
      }
    `}</style>
    <p className="lbl font-bold text-orange-600">Built for builds like these</p>
    <div className="row">
      {LOGOS.map((l) => <span key={l} className="item">{l}</span>)}
    </div>
  </section>
);

export default LogosStripV2;
