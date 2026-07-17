import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Upload, Share2, Camera, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { OverviewTab } from "./tabs/OverviewTab";
import { DailyReportTab } from "./tabs/DailyReportTab";
import { LibraryTab } from "./tabs/LibraryTab";
import { MapTab } from "./tabs/MapTab";
import { UploadModalProvider, useUploadModal } from "@/features/upload/UploadModalContext";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";
import { SharePanel } from "./SharePanel";
import { useAuth } from "@/hooks/useAuth";
import { isCrewOnly, type ProjectRole } from "@/lib/projectPermissions";


type TabKey = "overview" | "daily" | "library" | "map";
const VALID: TabKey[] = ["overview", "daily", "library", "map"];

/**
 * Phase 0 v2 shell. Renders the new 4-tab bar plus the global "Upload photos"
 * button (Phase 3) which is available across every tab.
 */
export default function ProjectShellV2() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<ProjectRole | null>(null);
  const { user } = useAuth();

  const rawTab = searchParams.get("tab");
  const tab: TabKey = (VALID as string[]).includes(rawTab ?? "") ? (rawTab as TabKey) : "overview";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [{ data: proj }, { data: pm }] = await Promise.all([
        supabase.from("projects").select("name").eq("id", id).maybeSingle(),
        user?.id
          ? supabase
              .from("project_members")
              .select("role")
              .eq("project_id", id)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setProjectName(proj?.name ?? null);
      setRole(((pm as { role?: ProjectRole } | null)?.role) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  if (!id) return null;

  return (
    <AppShell
      crumbs={[
        { label: "Projects", to: "/projects" },
        { label: loading ? "…" : projectName ?? "Project" },
      ]}
    >
      <ShellBody
        projectId={id}
        tab={tab}
        setTab={setTab}
        loading={loading}
        projectName={projectName}
        crewOnly={isCrewOnly(role)}
      />
    </AppShell>
  );
}

/**
 * Inner body is a separate component so it can hook into useProjectDetail
 * (for areas + refetch) and wrap children in the upload-modal provider.
 */
function ShellBody({
  projectId,
  tab,
  setTab,
  loading,
  projectName,
  crewOnly,
}: {
  projectId: string;
  tab: TabKey;
  setTab: (t: string) => void;
  loading: boolean;
  projectName: string | null;
  crewOnly: boolean;
}) {
  const { areas, refetch } = useProjectDetail(projectId);
  const areaOptions = areas.map((a) => ({ id: a.id, name: a.name }));
  const [shareOpen, setShareOpen] = useState(false);

  if (crewOnly) {
    return (
      <UploadModalProvider projectId={projectId} areas={areaOptions} onUploaded={refetch}>
        <CrewLanding projectName={loading ? null : projectName} />
      </UploadModalProvider>
    );
  }

  return (
    <UploadModalProvider projectId={projectId} areas={areaOptions} onUploaded={refetch}>
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {loading ? <Skeleton className="h-6 w-48" /> : projectName ?? "Project"}
              </h1>
              <Badge variant="secondary" className="uppercase tracking-wide">Beta</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              You're previewing the new project workspace. Some tabs land in later phases.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UploadButton />
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/projects/${projectId}?classic=1`}>Switch to classic view</Link>
            </Button>
          </div>
        </div>

        <SharePanel projectId={projectId} open={shareOpen} onOpenChange={setShareOpen} />


        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="daily">Daily Report</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <OverviewTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="daily" className="mt-6">
            <DailyReportTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="library" className="mt-6">
            <LibraryTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="map" className="mt-6">
            <MapTab projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </UploadModalProvider>
  );
}

function UploadButton() {
  const { open } = useUploadModal();
  return (
    <Button size="sm" onClick={() => open()}>
      <Upload className="mr-2 h-4 w-4" />
      Upload photos
    </Button>
  );
}

/**
 * Crew-only landing: no tabs, no report data, no share/settings. A single
 * prominent "Upload photos" button that opens the standard upload modal
 * (which handles area selection + GPS auto-assign).
 */
function CrewLanding({ projectName }: { projectName: string | null }) {
  const { open } = useUploadModal();
  // Auto-open the upload modal on entry so crew members land in capture flow.
  useEffect(() => {
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center border border-[#E3DFD4] bg-[#FAF8F2]">
        <Camera className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {projectName ?? "Project"}
        </h1>
        <p className="text-sm text-muted-foreground">
          You're signed in as crew. Upload photos to the project — they'll be
          sorted into the right area automatically when they have GPS data.
        </p>
      </div>
      <Button size="lg" onClick={() => open()} className="rounded-none">
        <Upload className="mr-2 h-4 w-4" />
        Upload photos
      </Button>
    </div>
  );
}
