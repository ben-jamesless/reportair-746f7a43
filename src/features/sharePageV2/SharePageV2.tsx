import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportFooter } from "./components/ReportFooter";
import { useShareV2 } from "./useShareV2";
import { V2, daysBetween, deriveAreaStatus, isoToday, normaliseStatus, timeLabel, worstStatus } from "./tokens";
import { Masthead } from "./components/Masthead";
import { StatusBar } from "./components/StatusBar";
import { StatStrip } from "./components/StatStrip";
import { ZoneCard } from "./components/ZoneCard";
import { SectionLabel } from "./components/Primitives";
import { AreaGlance, DayTimeline, TodayBox } from "./components/Sidebar";
import { BuildCalendar } from "./components/BuildCalendar";
import { BuildHeatmap } from "./components/BuildHeatmap";
import { ShareMapV2 } from "./components/ShareMapV2";
import { ShareLightboxV2 } from "./components/ShareLightboxV2";
import type { ShareMode } from "./types";

export default function SharePageV2() {
  const { token } = useParams<{ token: string }>();
  const { meta, day, loading, needPassword, passwordError, activeDate, submitPassword, setActiveDate } =
    useShareV2(token);
  const [password, setPassword] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
  const dayWord = isToday ? "today" : "this day";

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
      label: mode === "filed" || !isToday ? "Photos" : "Photos today",
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
    <div style={{ backgroundColor: V2.paper, color: V2.ink, minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-[1800px] px-6 pb-16 md:px-10 lg:px-16">
        <Masthead
          project={project}
          mode={mode}
          activeDate={activeDate}
          buildDay={buildWindow.dayNo}
          buildTotal={buildWindow.total}
          logoUrl={logoUrl}
        />
        <StatusBar
          worstStatus={derivedWorst}
          areaCount={dayAreas.length}
          photoCount={dayPhotos.length}
          mode={mode}
          lastUpdated={day?.last_updated_at}
          isToday={isToday}
        />

        <div className="mt-7 grid gap-11 lg:grid-cols-[1fr_400px]">
          <div>
            <StatStrip stats={stats} />

            {(meta.areas?.length ?? 0) > 0 && (
              <>
                <SectionLabel>Build calendar</SectionLabel>
                <BuildHeatmap
                  areas={meta.areas ?? []}
                  grid={meta.grid ?? []}
                  phases={meta.phases ?? []}
                  activeDate={activeDate}
                  activityDates={(meta.days ?? []).map((d) => d.date)}
                  onSelect={setActiveDate}
                />
              </>
            )}

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
                      isToday={isToday && mode !== "filed"}
                    />
                  </div>
                ))}
              </div>
            )}

            {token && (
              <>
                <SectionLabel className="mt-7">Site map</SectionLabel>
                <ShareMapV2 token={token} areas={dayAreas} onAreaClick={scrollToArea} />
              </>
            )}

            {(photosByArea.get("__unassigned")?.length ?? 0) > 0 && (
              <>
                <SectionLabel className="mt-7">Unassigned photos</SectionLabel>
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
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
          </div>

          <aside>
            <BuildCalendar
              days={meta.days ?? []}
              phases={meta.phases ?? []}
              activeDate={activeDate}
              buildStart={project.build_start_date}
              buildEnd={project.build_end_date ?? project.event_date}
              onSelect={setActiveDate}
            />
            {day && <TodayBox day={day} />}
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
            {/* Redundant with the build calendar heatmap on desktop. */}
            <div className="lg:hidden">
              <DayTimeline days={timelineDays} activeDate={activeDate} onSelect={setActiveDate} />
            </div>
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
        />
      </div>


      {lightboxIndex !== null && (
        <ShareLightboxV2
          token={token ?? ""}
          photos={dayPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
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
