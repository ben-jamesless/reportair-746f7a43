import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportFooter } from "./components/ReportFooter";
import { useShareV2 } from "./useShareV2";
import { V2, daysBetween, deriveAreaStatus, isoToday, normaliseStatus, parseISO, timeLabel, worstStatus } from "./tokens";
import { Masthead } from "./components/Masthead";
import { StatusBar } from "./components/StatusBar";
import { StatStrip } from "./components/StatStrip";
import { ZoneCard } from "./components/ZoneCard";
import { CollapsibleSectionLabel, SectionLabel } from "./components/Primitives";
import { AreaGlance, DayTimeline, TodayBox } from "./components/Sidebar";
import { BuildCalendar } from "./components/BuildCalendar";
import { BuildHeatmap } from "./components/BuildHeatmap";
import { ShareMapV2 } from "./components/ShareMapV2";
import { ShareLightboxV2 } from "./components/ShareLightboxV2";
import { EventSummary, FiledAreasGrid, FiledHero } from "./components/FiledMain";
import { ReportFeedback, OpsContact } from "./components/ReportFeedback";
import { supabase } from "@/integrations/supabase/client";
import { ExportPdfDialog } from "@/components/ExportPdfDialog";
import type { ShareMode } from "./types";


export default function SharePageV2() {
  const { token } = useParams<{ token: string }>();
  const { meta, day, loading, needPassword, passwordError, activeDate, submitPassword, setActiveDate } =
    useShareV2(token);
  const [password, setPassword] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [refLightboxIndex, setRefLightboxIndex] = useState<number | null>(null);
  const [refExpanded, setRefExpanded] = useState(false);
  /** Set when a client clicks a map area before the build starts. */
  const [refAreaFilter, setRefAreaFilter] = useState<string | null>(null);
  // Label of the specific map feature clicked (a feature is narrower than its area group).
  const [refFilterLabel, setRefFilterLabel] = useState<string | null>(null);
  const [opsContact, setOpsContact] = useState<{ name: string; role?: string | null } | null>(null);
  // Export uses the app's existing PDF export dialog when the viewer is signed
  // in (ops/team). Public visitors without an account fall back to print-to-PDF.
  const [exportOpen, setExportOpen] = useState(false);
  // Reader theme for the public report — remembered per browser.
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("bf.share.theme") === "dark" ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-v2-theme", theme);
    window.localStorage.setItem("bf.share.theme", theme);
    return () => document.documentElement.removeAttribute("data-v2-theme");
  }, [theme]);

  useEffect(() => {
    if (!token || !meta?.ok) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("share_ops_contact" as never, { _token: token } as never);
      if (alive) setOpsContact((data as { name: string; role?: string | null } | null) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [token, meta?.ok]);


  useEffect(() => {
    if (meta?.project?.name) document.title = `${meta.project.name} — Build report`;
  }, [meta?.project?.name]);

  useEffect(() => {
    if (!token || !meta?.ok) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-logo-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = await res.json();
        if (alive) setLogoUrl(typeof j?.url === "string" ? j.url : null);
      } catch {
        /* no logo */
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, meta?.ok]);

  const project = meta?.project ?? null;

  const buildWindow = useMemo(() => {
    if (!project?.build_start_date) return { dayNo: null as number | null, total: null as number | null };
    const start = project.build_start_date;
    const end = project.build_end_date ?? project.event_date ?? null;
    const ref = activeDate ?? isoToday();
    const dayNo = daysBetween(start, ref) + 1;
    const total = end ? daysBetween(start, end) + 1 : null;
    return { dayNo: dayNo > 0 ? dayNo : null, total };
  }, [project, activeDate]);

  const dayAreas = day?.areas ?? [];
  const dayPhotos = day?.photos ?? [];
  // Days offered in the export dialog's date-range mode.
  const exportDays = useMemo(
    () =>
      (meta?.days ?? [])
        .filter((d) => d.photo_count > 0 || d.has_notes)
        .map((d) => {
          const [y, m, dd] = d.date.split("-").map(Number);
          const date = new Date(y, m - 1, dd);
          return {
            key: d.date,
            label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
            date,
            photoCount: d.photo_count,
          };
        }),
    [meta?.days],
  );

  const photosByArea = useMemo(() => {
    const m = new Map<string, typeof dayPhotos>();
    for (const p of dayPhotos) {
      const k = p.area_id ?? "__unassigned";
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [dayPhotos]);

  /** Derived display status per area — photos captured count as an update. */
  const areaStatus = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of dayAreas) {
      m.set(
        a.area_id,
        a.display_status ?? deriveAreaStatus(a.status, photosByArea.get(a.area_id)?.length ?? 0)
      );
    }
    return m;
  }, [dayAreas, photosByArea]);

  const openIssuesCount = day?.open_issues ? 1 : 0;
  const activeAreas = dayAreas.filter(
    (a) => normaliseStatus(areaStatus.get(a.area_id)) !== "not_started" || !!a.notes
  );
  const flaggedAreas = dayAreas.filter((a) =>
    ["flagged", "delayed"].includes(normaliseStatus(areaStatus.get(a.area_id)))
  );

  // Headline status = MAX(area display status) by severity, with the stored
  // day status as a floor. Shared helper so the calendar rolls up identically.
  const derivedWorst = worstStatus([
    day?.worst_status,
    day?.day_status,
    ...dayAreas.map((a) => areaStatus.get(a.area_id)),
  ]);

  // Reference photos (pre-build / last-year) sit outside the build timeline —
  // they never affect the calendar, day counts or area statuses.
  const referencePhotos = meta?.reference_photos ?? [];
  const areaNameById = useMemo(
    () => new Map((meta?.areas ?? []).map((a) => [a.id, a.name])),
    [meta?.areas]
  );
  const visibleRefPhotos = refAreaFilter
    ? referencePhotos.filter((p) => p.area_id === refAreaFilter)
    : referencePhotos;
  /** Labels photo-scoped feedback with its area. */
  const areaNameByPhoto = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of [...(meta?.reference_photos ?? []), ...(day?.photos ?? [])]) {
      const n = p.area_id ? areaNameById.get(p.area_id) : null;
      if (n) m.set(p.id, n);
    }
    return m;
  }, [meta?.reference_photos, day?.photos, areaNameById]);


  const openPhoto = (photoId: string) => {
    const i = dayPhotos.findIndex((p) => p.id === photoId);
    if (i >= 0) setLightboxIndex(i);
  };

  const scrollToArea = (areaId: string) => {
    document.getElementById(`area-${areaId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };



  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: V2.paper }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: V2.muted }} />
      </div>
    );
  }

  if (needPassword || !meta?.ok || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: V2.paper }}>
        <form
          className="w-full max-w-sm p-6"
          style={{ backgroundColor: V2.white, border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}
          onSubmit={(e) => {
            e.preventDefault();
            submitPassword(password);
          }}
        >
          <div className="mb-4 flex items-center gap-2" style={{ color: V2.ink }}>
            <Lock className="h-4 w-4" />
            <span style={{ fontWeight: 700 }}>This report is protected</span>
          </div>
          <Label htmlFor="v2-pwd" style={{ color: V2.soft }}>
            Password
          </Label>
          <Input
            id="v2-pwd"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
            autoFocus
          />
          {passwordError && (
            <p className="mt-2" style={{ fontSize: 12, color: "#A11616" }}>
              That link or password isn't valid.
            </p>
          )}
          <Button type="submit" className="mt-4 w-full">
            View report
          </Button>
        </form>
      </div>
    );
  }

  const mode: ShareMode = meta.mode ?? "build";
  const isFiled = mode === "filed";
  const filedAt = project.finalised_at ?? null;
  const isToday = !isFiled && activeDate === isoToday();

  // Filed: the map paints final area statuses rather than the active day's.
  const filedMapAreas = (meta.areas ?? []).map((a) => ({
    area_id: a.id,
    name: a.name,
    sort_order: a.sort_order,
    status: a.latest_status,
    notes: null,
  }));
  const dayWord = isToday ? "today" : "this day";

  // No build dates set and nothing captured yet (reference photos excluded
  // server-side) → the timeline is meaningless, so hide calendar/heatmap/rail.
  const hasBuildTimeline =
    (meta.days ?? []).some((d) => d.photo_count > 0 || d.has_notes) ||
    (meta.photo_count ?? 0) > 0;

  // Contiguous run of days from the build start (or first recorded day) to the
  // last recorded day, so the timeline never reads as sparse.
  const dayMap = new Map((meta.days ?? []).map((d) => [d.date, d]));
  const recorded = (meta.days ?? []).map((d) => d.date).sort();
  const firstDay = project.build_start_date ?? recorded[0] ?? null;
  const lastDay = recorded[recorded.length - 1] ?? project.build_end_date ?? firstDay;
  const timelineDays =
    firstDay && lastDay && daysBetween(firstDay, lastDay) >= 0 && daysBetween(firstDay, lastDay) < 400
      ? Array.from({ length: daysBetween(firstDay, lastDay) + 1 }, (_, i) => {
          const d = new Date(new Date(firstDay).getTime() + i * 86400000);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return (
            dayMap.get(iso) ?? { date: iso, day_status: null, worst_status: null, photo_count: 0, has_notes: false }
          );
        })
      : meta.days ?? [];

  // Keeps the strip at four cells: the build-window slot falls back to
  // "Days recorded" while event phases / build dates are unset.
  const daysRecorded = (meta.days ?? []).filter((d) => d.photo_count > 0 || d.has_notes).length;
  const lastCapture = dayPhotos
    .map((p) => p.captured_at ?? p.created_at)
    .filter(Boolean)
    .sort()
    .pop();

  // Filed: the masthead shows the event span (first recorded day → filed date).
  const filedRange = (() => {
    if (!isFiled) return null;
    const first = recorded[0] ?? project.build_start_date ?? null;
    const end = filedAt ? filedAt.slice(0, 10) : recorded[recorded.length - 1] ?? null;
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(parseISO(iso));
    const fmtLong = (iso: string) =>
      new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parseISO(iso));
    if (first && end && first !== end) return `${fmt(first)} — ${fmtLong(end)}`;
    return first ? fmtLong(first) : end ? fmtLong(end) : null;
  })();

  const stats = [
    buildWindow.dayNo
      ? {
          label: "Build day",
          value: String(buildWindow.dayNo),
          unit: buildWindow.total ? `/ ${buildWindow.total}` : undefined,
          sub:
            buildWindow.total !== null
              ? `${Math.max(buildWindow.total - buildWindow.dayNo, 0)} days remaining`
              : undefined,
        }
      : {
          label: "Days recorded",
          value: String(daysRecorded),
          sub: lastCapture ? `Last capture ${timeLabel(lastCapture)}` : "No captures yet",
        },
    {
      label: !isToday ? "Photos" : "Photos today",
      value: String(dayPhotos.length),
      sub: `Across ${photosByArea.size} area${photosByArea.size === 1 ? "" : "s"}`,
    },
    {
      label: "Areas active",
      value: String(activeAreas.length),
      unit: `/ ${dayAreas.length}`,
      sub: activeAreas.length === dayAreas.length && dayAreas.length > 0 ? `All updated ${dayWord}` : undefined,
    },
    {
      label: "Open issues",
      value: String(openIssuesCount + flaggedAreas.length),
      tone: openIssuesCount + flaggedAreas.length > 0 ? "#B4720F" : undefined,
      sub: flaggedAreas.length ? flaggedAreas.map((a) => a.name).join(", ") : "None raised",
    },
  ];

  return (
    <div style={{ backgroundColor: V2.paper, color: V2.ink, minHeight: "100vh" }} className="overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1800px] px-4 pb-16 sm:px-6 md:px-10 lg:px-16">
        <Masthead
          project={project}
          mode={mode}
          activeDate={activeDate}
          buildDay={buildWindow.dayNo}
          buildTotal={buildWindow.total}
          logoUrl={logoUrl}
          filedRange={filedRange}
        />
        <StatusBar
          worstStatus={derivedWorst}
          areaCount={dayAreas.length}
          photoCount={dayPhotos.length}
          mode={mode}
          lastUpdated={day?.last_updated_at}
          isToday={isToday}
          filedAt={filedAt}
          referenceCount={referencePhotos.length}
          onOpenReference={() => {
            setRefAreaFilter(null);
            setRefFilterLabel(null);
            setRefExpanded(true);

            window.requestAnimationFrame(() =>
              document
                .getElementById("reference-photos")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            );
          }}
          onExport={() => setExportOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        />

        <div className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0">

            {isFiled ? (
              <>
                {/* Filed landing: hero → summary → map → areas grid. */}
                <FiledHero token={token ?? ""} photoId={meta.hero_photo_id ?? null} projectName={project.name} />
                <EventSummary text={project.event_summary_text} />

                {token && (
                  <>
                    <SectionLabel>Site map</SectionLabel>
                    <ShareMapV2 token={token} areas={filedMapAreas} />
                  </>
                )}

                <SectionLabel className="mt-8">Areas</SectionLabel>
                <FiledAreasGrid token={token ?? ""} areas={meta.areas ?? []} />
              </>
            ) : (
              <>
                {hasBuildTimeline && <StatStrip stats={stats} />}

                {hasBuildTimeline && (meta.areas?.length ?? 0) > 0 && (
                  <>
                    <SectionLabel>Build calendar</SectionLabel>
                    <BuildHeatmap
                      areas={meta.areas ?? []}
                      grid={meta.grid ?? []}
                      phases={meta.phases ?? []}
                      activeDate={activeDate}
                      activityDates={(meta.days ?? []).map((d) => d.date)}
                      onSelect={setActiveDate}
                      onSelectArea={scrollToArea}
                    />
                  </>
                )}

                {hasBuildTimeline && (
                  <>
                <SectionLabel className="mt-7">Area-by-area update</SectionLabel>
                {dayAreas.length === 0 ? (
                  <p style={{ fontSize: 13, color: V2.muted }}>No areas have been defined for this event yet.</p>
                ) : (
                  <div style={{ borderBottom: `1px solid ${V2.rule}` }}>
                    {dayAreas.map((a) => (
                      <div key={a.area_id} id={`area-${a.area_id}`} style={{ scrollMarginTop: 24 }}>
                        <ZoneCard
                          token={token ?? ""}
                          name={a.name}
                          status={areaStatus.get(a.area_id) ?? null}
                          notes={a.notes}
                          photos={photosByArea.get(a.area_id) ?? []}
                          onOpenPhoto={openPhoto}
                          isToday={isToday}
                        />
                      </div>
                    ))}
                  </div>
                )}
                  </>
                )}

                {token && (
                  <>
                    <SectionLabel className={hasBuildTimeline ? "mt-7" : undefined}>Site map</SectionLabel>
                    <ShareMapV2
                      token={token}
                      areas={
                        dayAreas.length > 0
                          ? dayAreas
                          : (meta.areas ?? []).map((a) => ({
                              area_id: a.id,
                              name: a.name,
                              sort_order: a.sort_order,
                              status: a.latest_status,
                              notes: null,
                            }))
                      }
                      onAreaClick={(areaId, featureLabel) => {
                        // Before the build starts there are no area cards to jump
                        // to — show that area's reference photos instead.
                        if (hasBuildTimeline) {
                          scrollToArea(areaId);
                          return;
                        }
                        setRefAreaFilter(areaId);
                        setRefFilterLabel(featureLabel ?? null);
                        setRefExpanded(true);
                        window.requestAnimationFrame(() =>
                          document
                            .getElementById("reference-photos")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" })
                        );
                      }}
                    />
                  </>
                )}


                {(photosByArea.get("__unassigned")?.length ?? 0) > 0 && (
                  <>
                    <SectionLabel className="mt-7">Unassigned photos</SectionLabel>
                    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                      {(photosByArea.get("__unassigned") ?? []).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => openPhoto(p.id)}
                          className="overflow-hidden"
                          style={{ aspectRatio: "4 / 3", borderRadius: 3, backgroundColor: V2.rule }}
                        >
                          <ZoneThumb token={token ?? ""} photoId={p.id} alt={p.caption || p.file_name} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {referencePhotos.length > 0 && (
              <div className="mt-7" id="reference-photos" style={{ scrollMarginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setRefExpanded((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  style={{ border: `1px solid ${V2.rule}`, backgroundColor: V2.white }}
                >
                  <span>
                    <span
                      className="block uppercase"
                      style={{ fontFamily: V2.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: V2.soft }}
                    >
                      Reference photos
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span style={{ fontFamily: V2.mono, fontSize: 12, color: V2.ink }}>{referencePhotos.length}</span>
                    <ChevronDown
                      className="h-4 w-4 transition-transform"
                      style={{ color: V2.muted, transform: refExpanded ? "rotate(180deg)" : "none" }}
                    />
                  </span>
                </button>

                {refExpanded && refAreaFilter && (
                  <div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ border: `1px solid ${V2.rule}`, borderTop: "none", backgroundColor: V2.paperDim }}
                  >
                    <span
                      className="uppercase"
                      style={{ fontFamily: V2.mono, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", color: V2.soft }}
                    >
                      {refFilterLabel ?? areaNameById.get(refAreaFilter) ?? "Area"} · {visibleRefPhotos.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRefAreaFilter(null);
                        setRefFilterLabel(null);
                      }}
                      style={{ fontSize: 11.5, color: V2.ink, textDecoration: "underline" }}
                    >
                      Show all
                    </button>
                  </div>
                )}

                {refExpanded && (
                  <div
                    className="grid grid-cols-2 gap-1 p-1 sm:grid-cols-3 lg:grid-cols-5"
                    style={{
                      border: `1px solid ${V2.rule}`,
                      borderTop: "none",
                      backgroundColor: V2.white,
                    }}
                  >
                    {visibleRefPhotos.length === 0 && (
                      <p className="px-3 py-4" style={{ fontSize: 12.5, color: V2.muted }}>
                        No reference photos for this area yet.
                      </p>
                    )}
                    {visibleRefPhotos.map((p, i) => {
                      const areaName = areaNameById.get(p.area_id ?? "") ?? null;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setRefLightboxIndex(i)}
                          className="relative overflow-hidden"
                          style={{ aspectRatio: "4 / 3", backgroundColor: V2.rule }}
                        >
                          <ZoneThumb token={token ?? ""} photoId={p.id} alt={p.caption || p.file_name} />
                          {areaName && (
                            <span
                              className="absolute bottom-0 left-0 right-0 truncate px-1.5 py-1 text-left"
                              style={{ fontSize: 10, color: "#fff", backgroundColor: "rgba(0,0,0,0.45)" }}
                            >
                              {areaName}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

              </div>
            )}
          </div>

          <aside className="min-w-0">
            {isFiled ? (
              <>
                {/* Filed rail: final area status, timeline, then the archived
                    feedback thread (read-only) and the ops contact. */}
                <AreaGlance
                  rows={(meta.areas ?? []).map((a) => ({
                    id: a.id,
                    name: a.name,
                    status: a.latest_status,
                    noUpdate: false,
                    photos: a.photo_count,
                  }))}
                />
                <DayTimeline days={timelineDays} activeDate={activeDate} onSelect={setActiveDate} />
                <div className="mt-7">
                  <ReportFeedback token={token ?? ""} areaNameByPhoto={areaNameByPhoto} readOnly />
                  <OpsContact contact={opsContact} />
                </div>
              </>
            ) : (
              <>
                {hasBuildTimeline && (
                  <BuildCalendar
                    days={meta.days ?? []}
                    phases={meta.phases ?? []}
                    activeDate={activeDate}
                    buildStart={project.build_start_date}
                    buildEnd={project.build_end_date ?? project.event_date}
                    onSelect={setActiveDate}
                  />
                )}
                {hasBuildTimeline && day && <TodayBox day={day} />}
                {hasBuildTimeline && (
                <AreaGlance
                  rows={dayAreas.map((a) => ({
                    id: a.area_id,
                    name: a.name,
                    status: areaStatus.get(a.area_id) ?? null,
                    noUpdate:
                      normaliseStatus(areaStatus.get(a.area_id)) === "not_started" && !a.notes,
                    photos: photosByArea.get(a.area_id)?.length ?? 0,
                  }))}
                />
                )}
                {/* Redundant with the build calendar heatmap on desktop. */}
                {hasBuildTimeline && (
                  <div className="lg:hidden">
                    <DayTimeline days={timelineDays} activeDate={activeDate} onSelect={setActiveDate} />
                  </div>
                )}
                {/* Feedback + ops contact anchor the rail: the only thing in it
                    pre-build, and the bottom block once the build is running. */}
                <div className={hasBuildTimeline ? "mt-7" : undefined}>
                  <ReportFeedback token={token ?? ""} areaNameByPhoto={areaNameByPhoto} />
                  <OpsContact contact={opsContact} />
                </div>
              </>
            )}

          </aside>
        </div>


        <ReportFooter
          projectName={project.name}
          mode={mode}
          generatedAt={meta.generated_at ?? null}
          reportDate={activeDate}
          teamName={meta.team_name ?? null}
          teamPlan={meta.team_plan ?? "free"}
          hideBranding={!!meta.hide_buildslides_branding}
          filedAt={filedAt}
        />
      </div>



      {refLightboxIndex !== null && (
        <ShareLightboxV2
          token={token ?? ""}
          photos={visibleRefPhotos}
          index={refLightboxIndex}
          onClose={() => setRefLightboxIndex(null)}
          onIndexChange={setRefLightboxIndex}
        />
      )}

      {lightboxIndex !== null && (
        <ShareLightboxV2
          token={token ?? ""}
          photos={dayPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}

      {project?.id && token && (
        <ExportPdfDialog
          projectId={project.id}
          shareToken={token}
          photoCount={dayPhotos.length}
          dayKey={activeDate ?? null}
          dayLabel={activeDate ?? null}
          availableDays={exportDays}
          open={exportOpen}
          onOpenChange={setExportOpen}
          trigger={<span className="hidden" aria-hidden />}
        />
      )}
    </div>
  );
}

function ZoneThumb({ token, photoId, alt }: { token: string; photoId: string; alt: string }) {
  const url = useSharePhotoUrlLocal(token, photoId);
  return url ? <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" /> : null;
}

// Small local re-export so the unassigned grid doesn't need its own component file.
import { useSharePhotoUrl as useSharePhotoUrlLocal } from "./useSharePhotoUrl";
