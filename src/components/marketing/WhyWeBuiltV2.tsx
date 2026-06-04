/**
 * "Why we built this" — dark manifesto card on the paper canvas.
 */
const WhyWeBuiltV2 = () => (
  <section className="why-v2">
    <style>{`
      .why-v2 { padding: 96px 32px 128px; font-family: 'Geist', system-ui, sans-serif; text-align: center; }
      .why-v2 .eyebrow {
        font-family: 'Geist Mono', ui-monospace, monospace;
        font-size: 11px; font-weight: 500;
        letter-spacing: 0.22em; text-transform: uppercase;
        color: #D94F2A; margin: 0 0 32px;
      }
      .why-v2 .card {
        max-width: 1200px; margin: 0 auto;
        background: #0F1417; color: #F4F1EA;
        border-radius: 22px; padding: 64px 72px;
        box-shadow: 0 30px 80px rgba(15,20,23,0.12);
        text-align: left;
      }
      .why-v2 .copy {
        font-size: clamp(32px, 4.2vw, 52px);
        font-weight: 800; line-height: 1.18;
        letter-spacing: -0.018em; color: #F4F1EA; margin: 0;
      }
      .why-v2 .copy .accent { color: #E96A45; }
      @media (max-width: 640px) {
        .why-v2 { padding: 48px 18px 64px; }
        .why-v2 .card { padding: 36px 28px; border-radius: 18px; }
      }
    `}</style>
    <p className="eyebrow font-bold">Why we built this</p>
    <div className="card">
      <p className="copy">
        Photos are lost between WhatsApp messages, a camera roll accessible to one person, a share drive no one opens. The daily report becomes an unnecessary two-hour project. So <span className="accent">we built the platform we always wanted,</span> a place to store, share and review project progress.
      </p>
    </div>
  </section>
);

export default WhyWeBuiltV2;
