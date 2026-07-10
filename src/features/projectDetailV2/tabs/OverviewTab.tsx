import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { CalendarDays, MapPin, Users, Image as ImageIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";

const DATE_FMT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

export function OverviewTab({ projectId }: { projectId: string }) {
  const { project, areas, photos, dailyFields, loading, loadError } = useProjectDetail(projectId);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const todaysObjectives = dailyFields.get(today)?.today_objectives ?? null;
  const openIssues = dailyFields.get(today)?.open_issues ?? null;

  const photoCount = photos.length;
  const daysWithPhotos = useMemo(() => {
    const s = new Set<string>();
    for (const p of photos) {
      const raw = p.captured_at || p.created_at;
      if (!raw) continue;
      const d = new Date(raw);
      s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return s.size;
  }, [photos]);

  const latestPhoto = photos[0];
  const latestUpload = latestPhoto?.created_at
    ? formatDistanceToNow(new Date(latestPhoto.created_at), { addSuffix: true })
    : null;


  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (loadError || !project) return <p className="text-sm text-destructive">Failed to load project.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">{project.name}</h2>
            {project.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
              {project.event_date && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {DATE_FMT.format(new Date(project.event_date))}
                </span>
              )}
              {project.event_location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {project.event_location}
                </span>
              )}
              {project.client_name && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {project.client_name}
                </span>
              )}
            </div>
          </div>
          <Button asChild>
            <Link to={`/projects/${projectId}?tab=daily`}>
              Open today's report <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Photos" value={photoCount} icon={<ImageIcon className="h-4 w-4" />} />
        <StatCard label="Days documented" value={daysWithPhotos} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Areas" value={areas.length} icon={<MapPin className="h-4 w-4" />} />
        <StatCard
          label="Last upload"
          value={latestUpload ?? "—"}
          icon={<ImageIcon className="h-4 w-4" />}
        />
      </div>

      {/* Today's snapshot */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Today's objectives" tint="#3A6EA5">
          {todaysObjectives ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground" dangerouslySetInnerHTML={{ __html: todaysObjectives }} />
          ) : (
            <EmptyLine label="Nothing planned for today yet." to={`/projects/${projectId}?tab=daily`} cta="Set objectives" />
          )}
        </Panel>
        <Panel title="Open issues" tint="#ef4444">
          {openIssues ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground" dangerouslySetInnerHTML={{ __html: openIssues }} />
          ) : (
            <EmptyLine label="No open issues logged." to={`/projects/${projectId}?tab=daily`} cta="Log an issue" />
          )}
        </Panel>
      </div>

    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Panel({ title, tint, children }: { title: string; tint?: string; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={tint ? { borderLeft: `4px solid ${tint}` } : undefined}
    >
      <p
        className="px-4 py-2 text-xs font-medium uppercase tracking-wide"
        style={tint ? { backgroundColor: `${tint}14`, color: tint } : { color: "hsl(var(--muted-foreground))" }}
      >
        {title}
      </p>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyLine({ label, to, cta }: { label: string; to: string; cta: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <Button asChild variant="ghost" size="sm">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
