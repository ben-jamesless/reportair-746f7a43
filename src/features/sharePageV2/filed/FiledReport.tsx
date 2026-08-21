import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, Download } from "lucide-react";
import { V2 } from "../tokens";
import type { ShareV2Meta } from "../types";
import { Masthead } from "../components/Masthead";
import { ReportFooter } from "../components/ReportFooter";
import { ReportFeedback } from "../components/ReportFeedback";
import { Counted, FlatButton, MONO_LABEL, fmtDayYear } from "./ui";
import { closingSummary, useFiledModel } from "./useFiledModel";
import { OverviewTab } from "./OverviewTab";
import { AreasTab } from "./AreasTab";
import { DaysTab } from "./DaysTab";
import { SiteMapTab } from "./SiteMapTab";

const TABS = ["overview", "areas", "days", "map"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  areas: "Areas",
  days: "Days",
  map: "Site map",
};

/**
 * The finalised (filed) client record: a four-tab, full-width, single-column
 * *document*. No right rail — the rail belongs to the live dashboard. Each tab
 * answers exactly one question and no component appears on two tabs, which is
 * what stops the same photograph rendering twice on one page.
 */
export function FiledReport({
  token,
  meta,
  logoUrl,
  filedAt,
  tzNote,
  theme,
  onToggleTheme,
  onExport,
  filedRange,
}: {
  token: string;
  meta: ShareV2Meta;
  logoUrl: string | null;
  filedAt: string | null;
  tzNote: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onExport: () => void;
  filedRange: string | null;
}) {
  const project = meta.project!;
  const model = useFiledModel(meta);

  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get("tab") as Tab | null;
    return t && (TABS as readonly string[]).includes(t) ? t : "overview";
  });
  const [openAreaId, setOpenAreaId] = useState<string | null>(() => params.get("area"));
  const [focusPoint, setFocusPoint] = useState<
    { lat: number; lng: number; photoId: string; label?: string } | null
  >(null);
  const [activeDay, setActiveDay] = useState<string | null>(
    () => params.get("day") ?? model.defaultDay
  );

  // Deep links: ?tab=areas&area=<id>, ?tab=days&day=2026-08-13.
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("tab", tab);
    if (tab === "areas" && openAreaId) u.searchParams.set("area", openAreaId);
    else u.searchParams.delete("area");
    if (tab === "days" && activeDay) u.searchParams.set("day", activeDay);
    else u.searchParams.delete("day");
    window.history.replaceState(null, "", u.toString());
  }, [tab, openAreaId, activeDay]);

  useEffect(() => {
    if (!activeDay && model.defaultDay) setActiveDay(model.defaultDay);
  }, [activeDay, model.defaultDay]);

  const summary = useMemo(
    () => closingSummary(model, filedAt, project.event_summary_text),
    [model, filedAt, project.event_summary_text]
  );

  const openAlbum = (areaId: string) => {
    setOpenAreaId(areaId);
    setTab("areas");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /** Lightbox → Site map tab: drop a pulsing marker where the photo was taken. */
  const showOnMap = meta.show_photo_pins
    ? (photo: { id: string; gps_lat: number | null; gps_lng: number | null; caption: string | null; captured_at: string | null }) => {
        if (photo.gps_lat == null || photo.gps_lng == null) return;
        setFocusPoint({
          lat: photo.gps_lat,
          lng: photo.gps_lng,
          photoId: photo.id,
          label: photo.caption || undefined,
        });
        setTab("map");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    : undefined;

  const openDay = (date: string) => {
    setActiveDay(date);
    setTab("days");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={{ backgroundColor: V2.paper, color: V2.ink, minHeight: "100vh" }} className="overflow-x-hidden">
      <div className="mx-auto w-full px-4 pb-16 sm:px-6 md:px-10 lg:px-14">
        <Masthead
          project={project}
          mode="filed"
          activeDate={null}
          buildDay={null}
          buildTotal={null}
          logoUrl={logoUrl}
          filedRange={filedRange}
        />

        {/* The one and only place project totals are stated. */}
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2.5"
          style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
        >
          <span
            style={{
              ...MONO_LABEL,
              backgroundColor: V2.ink,
              color: V2.bandFg,
              padding: "4px 9px",
            }}
          >
            Filed
          </span>
          <Counted label="Areas" value={model.totals.areas} />
          <Counted label="Photographs" value={model.totals.photos} />
          <Counted label="Days documented" value={model.totals.daysDocumented} />
          <Counted label="Filed" value={filedAt ? fmtDayYear(filedAt.slice(0, 10)) : "—"} />
          <span className="ml-auto flex items-center gap-1.5">
            <FlatButton onClick={onToggleTheme} title="Switch theme">
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </FlatButton>
            <FlatButton onClick={onExport} title="Download a PDF of this record">
              <span className="flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> PDF
              </span>
            </FlatButton>
          </span>
        </div>

        <div className="sticky top-0 z-20 mb-7 flex gap-1 overflow-x-auto py-2" style={{ backgroundColor: V2.paper }}>
          {TABS.map((t) => (
            <FlatButton key={t} active={tab === t} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </FlatButton>
          ))}
        </div>

        {tab === "overview" && (
          <OverviewTab
            token={token}
            summary={summary}
            areas={model.areas}
            grid={meta.grid ?? []}
            phases={meta.phases ?? []}
            activityDates={model.activeDays.map((d) => d.date)}
            onOpenDay={openDay}
            onOpenAlbum={openAlbum}
            onOpenMap={() => setTab("map")}
          />
        )}

        {tab === "areas" && (
          <AreasTab
            token={token}
            areas={model.areas}
            openAreaId={openAreaId}
            onOpenArea={setOpenAreaId}
            onShowOnMap={showOnMap}
          />
        )}

        {tab === "days" && (
          <DaysTab
            token={token}
            days={model.activeDays}
            allDays={model.allDays.map((d) => ({ ...d, hasActivity: d.photo_count > 0 || d.has_notes }))}
            areas={model.areas}
            phases={meta.phases ?? []}
            activeDate={activeDay}
            onSelectDay={setActiveDay}
            filedAt={filedAt}
            onOpenAlbum={openAlbum}
            onShowOnMap={showOnMap}
          />
        )}

        {tab === "map" && (
          <SiteMapTab
            token={token}
            project={project}
            areas={model.areas}
            provenance={meta.map_provenance}
            onOpenAlbum={openAlbum}
            focusPoint={focusPoint}
            onFocusClear={() => setFocusPoint(null)}
          />
        )}

        {/* No ops contact card here: it carries a name and no way to make
            contact, which is an empty card by any useful definition. */}
        <div className="mt-10">
          <ReportFeedback token={token} readOnly hideWhenEmpty />
        </div>

        <ReportFooter
          projectName={project.name}
          mode="filed"
          generatedAt={meta.generated_at ?? null}
          reportDate={null}
          teamName={meta.team_name ?? null}
          teamPlan={meta.team_plan ?? "free"}
          hideBranding={!!meta.hide_buildslides_branding}
          filedAt={filedAt}
          tzNote={tzNote}
        />
      </div>
    </div>
  );
}
