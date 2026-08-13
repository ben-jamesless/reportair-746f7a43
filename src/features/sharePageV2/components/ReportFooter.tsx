import { V2, DATE_LONG } from "../tokens";
import type { ShareMode } from "../types";

/** Terminates the artifact: closing rule, provenance line, delivery lockup. */
export function ReportFooter({
  projectName,
  mode,
  generatedAt,
  reportDate,
  teamName,
  teamPlan,
  hideBranding,
  filedAt,
}: {
  projectName: string;
  mode: ShareMode;
  generatedAt: string | null;
  /** Filed mode: stamps the footer with the finalise date. */
  filedAt?: string | null;
  /** ISO date of the day being viewed, so the two dates explain each other. */
  reportDate?: string | null;
  teamName: string | null;
  teamPlan: string;
  hideBranding: boolean;
}) {
  const stamp = generatedAt ? new Date(generatedAt) : new Date();
  const todayLong = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
  const filedStamp = filedAt
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(filedAt))
    : null;


  return (
    <footer className="mt-14" style={{ borderTop: `2px solid ${V2.ink}`, paddingTop: 10 }}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
        <div className="flex items-center gap-3">
          {!hideBranding && (
            <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: V2.muted }}>
              <span>Delivered by</span>
              <a
                href="https://buildfolder.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
                style={{ color: V2.ink, fontWeight: 700 }}
              >
                <img src="/brand-mark.svg" alt="" style={{ width: 14, height: 14, display: "block" }} />
                BuildFolder
              </a>
            </div>
          )}
          {mode === "filed" && (
            <div
              className="uppercase"
              style={{ fontFamily: V2.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.13em", color: V2.muted }}
            >
              {`Event record — ${projectName}${filedStamp ? ` · Filed ${filedStamp}` : ""}`}
            </div>
          )}
        </div>
        <div style={{ fontFamily: V2.mono, fontSize: 9.5, letterSpacing: "0.08em", color: V2.muted }}>
          {mode === "filed" ? `Generated ${DATE_LONG.format(stamp)}` : `Report day: ${todayLong}`}
        </div>
      </div>
    </footer>
  );
}
