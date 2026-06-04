import { useState } from "react";
import { display, body } from "./brand-tokens";

const faqs = [
  {
    question: "Who is this actually for?",
    answer:
      "Production managers, agency owners, and venue ops teams running live events, exhibitions, and brand activations. If your day ends with you rebuilding a deck on the train home — you're our person.",
  },
  {
    question: "Can I brand the PDF with our logo and colours?",
    answer:
      "Yes. Drop in your logo and your brand colour and every export comes out with your cover page, header, and footer. White-label PDFs (no BuildFolder watermark) are included on the Studio tier.",
  },
  {
    question: "What does the PDF look like?",
    answer:
      "Cover with your client's name and event title, then photos grouped by zone and time, each zone tagged with a clear status — On track, Needs discussion, Concern, or Complete. Print-clean. Client-safe. A sample lands in the welcome email.",
  },
  {
    question: "How is this different from a shared Google Drive?",
    answer:
      "Drive is a bucket. BuildFolder is a workflow — auto-tagging, structured reports, branded export, audit history. The deck-build step disappears.",
  },
  {
    question: "When can I use it?",
    answer:
      "Closed beta is running with Hong Kong and London crews now. Public beta opens Q2 2026. Drop your email below and you'll get an invite slot.",
  },
  {
    question: "What does it cost?",
    answer:
      "Solo HK$128/mo, Crew HK$298/mo, Studio HK$688/mo. Annual billing saves 20%. 7-day free trial on every tier — see the pricing section below.",
  },
  {
    question: "Can multiple people work on the same event at once?",
    answer:
      "Yes. Invite your team to any event and everyone works in the same project in real time. A site photographer uploads from the ground, a site manager adds notes from the office, and the producer generates the report — all without stepping on each other.",
  },
  {
    question: "Can I share a report with a client who doesn't have an account?",
    answer:
      "Yes. Generate a shareable link for any daily report which your client can open in any browser. The link shows them a clean, read-only view of that day and the overall project's progress.",
  },
];

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <section className="py-[86px] px-6 max-md:py-[43px]" style={{ background: "#0F1417" }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <p
          style={{
            ...display,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#D94F2A",
            marginBottom: 16,
          }}
        >
          FAQ
        </p>
        <h2
          style={{
            ...display,
            fontWeight: 800,
            fontSize: "clamp(32px, 4vw, 52px)",
            color: "#ffffff",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          The honest answers.
        </h2>
        <p style={{ ...body, fontSize: 15, fontWeight: 400, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
          Can't find what you're looking for?{" "}
          <a
            href="mailto:ben@buildslides.com"
            style={{ color: "#D94F2A", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            Drop us a message →
          </a>
        </p>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {faqs.map((f, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                borderTop: i === 0 ? "1px solid rgba(255,255,255,0.07)" : undefined,
              }}
            >
              <button
                onClick={() => setOpenIdx(isOpen ? -1 : i)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "22px 0",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    ...display,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#ffffff",
                    lineHeight: 1.5,
                  }}
                >
                  {f.question}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    marginLeft: 16,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: `1.5px solid ${isOpen ? "#D94F2A" : "rgba(255,255,255,0.15)"}`,
                    color: isOpen ? "#D94F2A" : "rgba(255,255,255,0.4)",
                    background: isOpen ? "rgba(217,79,42,0.1)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    transition: "border-color 0.2s ease, color 0.2s ease, background 0.2s ease",
                  }}
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              <div
                style={{
                  maxHeight: isOpen ? 500 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <p
                  style={{
                    ...body,
                    fontSize: 14,
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: 1.72,
                    paddingBottom: 20,
                    paddingRight: 42,
                    margin: 0,
                  }}
                >
                  {f.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
