import { useState } from "react";
import { display, body } from "./brand-tokens";

const faqs = [
  {
    question: "What exactly does BuildSlides do?",
    answer:
      "BuildSlides turns your on-site photos and notes into a professional, client-ready PDF report — automatically. Upload photos from the day, tag them by area, add notes, and BuildSlides organises everything into a polished daily progress report. No formatting, no copy-pasting, no time wasted back at the desk.",
  },
  {
    question: "Who is BuildSlides built for?",
    answer:
      "Event build professionals — site managers, production coordinators, and freelancers working on builds from multi-month tournaments to 2-day brand activations. Works for solo operators and larger teams running multiple concurrent builds.",
  },
  {
    question: "How does the PDF report get generated?",
    answer:
      "Once you've uploaded your photos and notes, BuildSlides compiles everything into a clean, structured PDF organised by date and area. Generate a report for any day with one click — end-of-day reporting becomes a 2-minute task, not a 2-hour one.",
  },
  {
    question: "Can I use BuildSlides on-site from my phone?",
    answer:
      "Yes — fully mobile-responsive and designed for the field. Upload photos, add notes, and tag locations directly from your phone as you walk the site. Everything syncs instantly.",
  },
  {
    question: "Is my data and photos secure?",
    answer:
      "Absolutely. All photos and project data are stored securely with role-based access controls. Only you and team members you invite can access your projects. Your content is never shared or used outside your account.",
  },
  {
    question: "Can multiple people work on the same event at once?",
    answer:
      "Yes. Invite your team to any event and everyone works in the same project in real time. A site photographer uploads from the ground, a site manager adds notes from the office, and the producer generates the report — all without stepping on each other.",
  },
  {
    question: "Do I need to organise photos before uploading?",
    answer:
      "No. Upload in any order from any device. Reportair sorts everything by time and date automatically. You spend time on-site, not on filing.",
  },
  {
    question: "What's the difference between a team owner and an invited member?",
    answer:
      "Owners create events, manage team members, and control billing. Invited members can upload photos, add notes, and view reports for the events they're added to — nothing outside their access. You control exactly who sees what.",
  },
  {
    question: "Can I share a report with a client who doesn't have an account?",
    answer:
      "Yes. Generate a shareable link for any daily report which your client can open in any browser. The link shows them a clean, read-only view of that day and the overall project's progress.",
  },
  {
    question: "What happens to reports after the event wraps?",
    answer:
      "Everything stays in your account and is archived, not deleted. You can pull up photos, notes, and reports from any past event at any time — useful for client disputes, handover documentation, or reference on the next build.",
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
            fontWeight: 700,
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
            fontSize: "clamp(28px, 4vw, 40px)",
            color: "#ffffff",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          Everything you need to know.
        </h2>
        <p style={{ ...body, fontSize: 15, fontWeight: 400, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
          Can't find an answer? Drop us a message.
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
