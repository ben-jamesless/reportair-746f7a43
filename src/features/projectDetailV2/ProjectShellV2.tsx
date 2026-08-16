import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Upload, Share2, Camera, Users, Image as ImageIcon, Menu, LayoutDashboard, FileText, Images, Map as MapIcon, Check, FileDown, Sun, Moon, Settings as SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { inkButtonClass } from "@/features/projectSettings/settingsUi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { supabase } from "@/integrations/supabase/client";
import { OverviewTab } from "./tabs/OverviewTab";
import { DailyReportTab } from "./tabs/DailyReportTab";
import { LibraryTab } from "./tabs/LibraryTab";
import { MapTab } from "./tabs/MapTab";
import { UploadModalProvider, useUploadModal } from "@/features/upload/UploadModalContext";
import { useProjectDetail } from "@/features/projectDetail/useProjectDetail";
import { SharePanel } from "./SharePanel";
import { MembersPanel } from "./MembersPanel";
import { useAuth } from "@/hooks/useAuth";
import { canEditProject, isCrewOnly, type ProjectRole } from "@/lib/projectPermissions";
import { FreePlanUploadGate } from "@/components/FreePlanUploadGate";
import { useProjectPlan } from "@/hooks/useProjectPlan";
import { useProjectUpdateDays } from "@/hooks/useProjectUpdateDays";
import { ExportPdfDialog } from "@/components/ExportPdfDialog";
import { useTheme } from "@/hooks/useTheme";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}



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
        role={role}
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
  role,
  crewOnly,
}: {
  projectId: string;
  tab: TabKey;
  setTab: (t: string) => void;
  loading: boolean;
  projectName: string | null;
  role: ProjectRole | null;
  crewOnly: boolean;
}) {
  const { areas, photos, refetch, project } = useProjectDetail(projectId);
  const areaOptions = areas.map((a) => ({ id: a.id, name: a.name }));
  const [shareOpen, setShareOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canManageMembers = canEditProject(role);

  const { limits, isBillingOwner, teamName, billingOwnerName } = useProjectPlan(projectId);
  const { dayCount, loading: daysLoading } = useProjectUpdateDays(
    limits.maxUpdateDays !== -1 ? projectId : null
  );
  const planLimitReached =
    limits.maxUpdateDays !== -1 && !daysLoading && dayCount >= limits.maxUpdateDays;


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
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-between">
            <TabsList className="hidden sm:inline-grid w-auto grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="daily">Daily Report</TabsTrigger>
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-2">
              <UploadButton />
              <CaptureButton />
              <ExportPdfDialog
                projectId={projectId}
                photoCount={photos.length}
                trigger={
                  <Button variant="outline" size="sm" aria-label="Export PDF">
                    <FileDown className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                }
              />
              <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} aria-label="Share">
                <Share2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              {canManageMembers && (
                <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)} aria-label="Members">
                  <Users className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Members</span>
                </Button>
              )}
              {canManageMembers && (
                <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Project settings">
                  <SettingsIcon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              )}
              <ThemeToggleButton />
              <TabsMenu tab={tab} setTab={setTab} />

            </div>
          </div>

          <SharePanel projectId={projectId} open={shareOpen} onOpenChange={setShareOpen} />
          {canManageMembers && (
            <MembersPanel projectId={projectId} open={membersOpen} onOpenChange={setMembersOpen} />
          )}
          {canManageMembers && project && (
            <ProjectSettingsDialog
              projectId={projectId}
              project={project as any}
              trigger={null}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              onChanged={refetch}
            />
          )}


          {planLimitReached && (
            <div className="mt-6">
              <FreePlanUploadGate
                teamName={teamName}
                ownerName={billingOwnerName}
                isBillingOwner={isBillingOwner}
              />
            </div>
          )}

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
    <Button size="sm" onClick={() => open()} className={inkButtonClass}>
      <Upload className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Upload photos</span>
    </Button>
  );
}

/**
 * Mobile-only camera capture affordance. Opens the OS camera directly via
 * `capture="environment"` and stages the resulting file(s) in the standard
 * upload modal, so EXIF / GPS auto-assign runs unchanged.
 */
function CaptureButton() {
  const { open } = useUploadModal();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="sm:hidden"
        aria-label="Take photo"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-4 w-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) open({ initialFiles: files });
        }}
      />
    </>
  );
}

const TAB_ITEMS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "daily", label: "Daily Report", icon: FileText },
  { key: "library", label: "Library", icon: Images },
  { key: "map", label: "Map", icon: MapIcon },
];

function TabsMenu({ tab, setTab }: { tab: TabKey; setTab: (t: string) => void }) {
  const current = TAB_ITEMS.find((t) => t.key === tab);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="sm:hidden" aria-label="Navigate tabs">
          <Menu className="h-4 w-4" />
          <span className="ml-2 text-xs">{current?.label ?? "Menu"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.key === tab;
          return (
            <DropdownMenuItem key={item.key} onSelect={() => setTab(item.key)}>
              <Icon className="mr-2 h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {active && <Check className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Crew-only landing: no tabs, no report data, no share/settings. A dedicated
 * mobile-first capture surface — "Take photo" hits the camera directly,
 * "Choose from library" opens the standard picker.
 */
function CrewLanding({ projectName }: { projectName: string | null }) {
  const { open } = useUploadModal();
  const inputRef = useRef<HTMLInputElement>(null);

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
          Point, shoot, done. GPS sorts each photo into the right area
          automatically.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button
          size="lg"
          onClick={() => inputRef.current?.click()}
          className="h-14 w-full rounded-none text-base"
        >
          <Camera className="mr-2 h-5 w-5" />
          Take photo
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => open()}
          className="h-12 w-full rounded-none"
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Choose from library
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) open({ initialFiles: files });
        }}
      />
    </div>
  );
}

