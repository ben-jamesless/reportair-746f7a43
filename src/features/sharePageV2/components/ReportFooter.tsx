import { V2, DATE_LONG } from "../tokens";
import type { ShareMode } from "../types";

const MODE_WORD: Record<ShareMode, string> = {
  build: "build report",
  on_show: "event report",
  takedown: "takedown report",
  filed: "event record",
};

/** Terminates the artifact: closing rule, provenance line, delivery lockup. */
export function ReportFooter({
  projectName,
  mode,
  generatedAt,
  reportDate,
  teamName,
  teamPlan,
  hideBranding,
}: {
  projectName: string;
  mode: ShareMode;
  generatedAt: string | null;
  /** ISO date of the day being viewed, so the two dates explain each other. */
  reportDate?: string | null;
  teamName: string | null;
  teamPlan: string;
  hideBranding: boolean;
}) {
  const stamp = generatedAt ? new Date(generatedAt) : new Date();
  const branded = teamName && ["crew", "pro", "team", "studio"].includes(teamPlan);
  const dayStamp = reportDate ? new Date(`${reportDate}T00:00:00`) : null;
  const generatedShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(stamp);
  const dayLong = dayStamp
    ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(
        dayStamp
      )
    : null;

  return (
    <footer className="mt-14" style={{ borderTop: `2px solid ${V2.ink}`, paddingTop: 14 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div
          className="uppercase"
          style={{ fontFamily: V2.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.13em", color: V2.muted }}
        >
          End of {MODE_WORD[mode]} — {projectName}
        </div>
        <div style={{ fontFamily: V2.mono, fontSize: 9.5, letterSpacing: "0.08em", color: V2.muted }}>
          Generated {DATE_LONG.format(stamp)}
        </div>
      </div>

      {!hideBranding && (
        <div className="mt-3 flex items-center gap-1.5" style={{ fontSize: 11.5, color: V2.muted }}>
          {branded && (
            <>
              <span>Prepared by</span>
              <span style={{ color: V2.ink, fontWeight: 700 }}>{teamName}</span>
              <span style={{ opacity: 0.4 }}>·</span>
            </>
          )}
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
    </footer>
  );
}
