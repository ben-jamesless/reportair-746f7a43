import { Download, Moon, Sun } from "lucide-react";
import { V2, statusMeta } from "../tokens";
import type { ShareMode } from "../types";

export function StatusBar({
  worstStatus,
  areaCount,
  photoCount,
  mode,
  lastUpdated,
  isToday = true,
  filedAt,
  referenceCount = 0,
  onOpenReference,
  onExport,
  theme = "light",
  onToggleTheme,
}: {
  worstStatus: string | null | undefined;
  areaCount: number;
  photoCount: number;
  mode: ShareMode;
  lastUpdated: string | null | undefined;
  /** LIVE only makes sense when the viewed day is actually today. */
  isToday?: boolean;
  /** Filed mode: replaces "updated" with "Filed · date". */
  filedAt?: string | null;
  /** Reference photo count; renders a jump-to-gallery chip when > 0. */
  referenceCount?: number;
  onOpenReference?: () => void;
  /** Export the report (print → PDF). */
  onExport?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}) {
  const meta = statusMeta(worstStatus);
  const filed = mode === "filed";
  const live = !filed && isToday;
  const updated =
    !filed && lastUpdated
      ? new Date(lastUpdated).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : null;
  const filedStamp =
    filed && filedAt
      ? new Date(filedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5"
      style={{ borderBottom: `1px solid ${V2.rule}` }}
    >
      {referenceCount > 0 && onOpenReference && (
        <button
          type="button"
          onClick={onOpenReference}
          className="uppercase"
          style={{
            fontFamily: V2.mono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.09em",
            color: V2.ink,
            border: `1px solid ${V2.rule}`,
            backgroundColor: V2.white,
            padding: "4px 8px",
          }}
        >
          Reference photos · {referenceCount}
        </button>
      )}
      <div className="flex items-center gap-2">
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: meta.fg }} />
        <span className="uppercase" style={{ fontSize: 12, fontWeight: 700, color: meta.fg, letterSpacing: "0.07em" }}>
          {meta.label}
        </span>
      </div>
      <span style={{ width: 1, height: 16, backgroundColor: V2.rule }} />
      <span style={{ fontSize: 12, color: V2.muted }}>
        {areaCount} area{areaCount === 1 ? "" : "s"}
      </span>
      <span style={{ width: 1, height: 16, backgroundColor: V2.rule }} />
      <span style={{ fontSize: 12, color: V2.muted }}>
        {photoCount} photo{photoCount === 1 ? "" : "s"}
        {live ? " today" : ""}
      </span>
      {filedStamp && (
        <>
          <span style={{ width: 1, height: 16, backgroundColor: V2.rule }} />
          <span
            className="uppercase"
            style={{ fontFamily: V2.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: V2.ink }}
          >
            Filed · {filedStamp}
          </span>
        </>
      )}
      {updated && (
        <>
          <span className="hidden sm:block" style={{ width: 1, height: 16, backgroundColor: V2.rule }} />
          <span className="hidden sm:block" style={{ fontSize: 12, color: V2.muted }}>
            Updated {updated}
          </span>
        </>
      )}
      <span className="ml-auto flex items-center gap-2.5">
        {live && (
          <span className="flex items-center gap-1.5">
            <span
              className="animate-pulse"
              style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: V2.signalRed }}
            />
            <span
              className="uppercase"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: V2.ink }}
            >
              Live
            </span>
          </span>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            title="Export this report as a PDF"
            className="v2-no-print flex items-center gap-1.5 uppercase"
            style={{
              fontFamily: V2.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.09em",
              color: V2.ink,
              border: `1px solid ${V2.rule}`,
              backgroundColor: V2.white,
              padding: "4px 8px",
            }}
          >
            <Download style={{ width: 12, height: 12 }} />
            Export
          </button>
        )}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="v2-no-print flex items-center justify-center"
            style={{
              width: 26,
              height: 24,
              color: V2.soft,
              border: `1px solid ${V2.rule}`,
              backgroundColor: V2.white,
            }}
          >
            {theme === "dark" ? <Sun style={{ width: 13, height: 13 }} /> : <Moon style={{ width: 13, height: 13 }} />}
          </button>
        )}
      </span>
    </div>
  );
}
