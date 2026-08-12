import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShareBrandingFooter } from "@/components/ShareBrandingFooter";
import { useShareV2 } from "./useShareV2";
import { V2, daysBetween, isoToday, normaliseStatus } from "./tokens";
import { Masthead } from "./components/Masthead";
import { StatusBar } from "./components/StatusBar";
import { StatStrip } from "./components/StatStrip";
import { ZoneCard } from "./components/ZoneCard";
import { SectionLabel } from "./components/Primitives";
import { AreaGlance, DayTimeline, TodayBox } from "./components/Sidebar";
import { BuildCalendar } from "./components/BuildCalendar";
import { ShareMapV2 } from "./components/ShareMapV2";
import { ShareLightboxV2 } from "./components/ShareLightboxV2";

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

  const openIssuesCount = day?.open_issues ? 1 : 0;
  const activeAreas = dayAreas.filter((a) => a.status || a.notes || (photosByArea.get(a.area_id)?.length ?? 0) > 0);
  const flaggedAreas = dayAreas.filter((a) => ["flagged", "delayed"].includes(normaliseStatus(a.status)));

  const openPhoto = (photoId: string) => {
    const i = dayPhotos.findIndex((p) => p.id === photoId);
    if (i >= 0) setLightboxIndex(i);
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

  const mode = meta.mode ?? "build";

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
          worstStatus={day?.worst_status ?? day?.day_status}
          areaCount={dayAreas.length}
          photoCount={dayPhotos.length}
          mode={mode}
          lastUpdated={day?.last_updated_at}
        />

        <div className="mt-7 grid gap-11 lg:grid-cols-[1fr_400px]">
          <div>
            <StatStrip
              stats={[
                {
                  label: "Build day",
                  value: buildWindow.dayNo ? String(buildWindow.dayNo) : "—",
                  unit: buildWindow.total ? `/ ${buildWindow.total}` : undefined,
                  sub:
                    buildWindow.dayNo && buildWindow.total
                      ? `${Math.max(buildWindow.total - buildWindow.dayNo, 0)} days remaining`
                      : undefined,
                },
                {
                  label: "Photos today",
                  value: String(dayPhotos.length),
                  sub: `Across ${photosByArea.size} area${photosByArea.size === 1 ? "" : "s"}`,
                },
                {
                  label: "Areas active",
                  value: String(activeAreas.length),
                  unit: `/ ${dayAreas.length}`,
                  sub: activeAreas.length === dayAreas.length && dayAreas.length > 0 ? "All updated today" : undefined,
                },
                {
                  label: "Open issues",
                  value: String(openIssuesCount + flaggedAreas.length),
                  tone: openIssuesCount + flaggedAreas.length > 0 ? "#B4720F" : undefined,
                  sub: flaggedAreas.length ? flaggedAreas.map((a) => a.name).join(", ") : "None raised",
                },
              ]}
            />

            <SectionLabel>Area-by-area update</SectionLabel>
            {dayAreas.length === 0 ? (
              <p style={{ fontSize: 13, color: V2.muted }}>No areas have been defined for this event yet.</p>
            ) : (
              <div style={{ borderBottom: `1px solid ${V2.rule}` }}>
                {dayAreas.map((a) => (
                  <ZoneCard
                    key={a.area_id}
                    token={token ?? ""}
                    name={a.name}
                    status={a.status}
                    notes={a.notes}
                    photos={photosByArea.get(a.area_id) ?? []}
                    onOpenPhoto={openPhoto}
                  />
                ))}
              </div>
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
            {day && <TodayBox day={day} />}
            <AreaGlance
              rows={dayAreas.map((a) => ({
                id: a.area_id,
                name: a.name,
                status: a.status,
                noUpdate: !a.status && !a.notes,
                photos: photosByArea.get(a.area_id)?.length ?? 0,
              }))}
            />
            <DayTimeline days={meta.days ?? []} activeDate={activeDate} onSelect={setActiveDate} />
          </aside>
        </div>

        <div className="mt-10">
          <ShareBrandingFooter
            teamPlan={meta.team_plan ?? "free"}
            teamName={meta.team_name ?? null}
            hideBranding={!!meta.hide_buildslides_branding}
          />
        </div>
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
