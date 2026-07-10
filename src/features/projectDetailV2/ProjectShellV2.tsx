import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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

type TabKey = "overview" | "daily" | "library" | "map";
const VALID: TabKey[] = ["overview", "daily", "library", "map"];

/**
 * Phase 0 v2 shell. Renders the new 4-tab bar. Overview / Daily / Library are
 * placeholders that link back to the classic view; Map ships real functionality.
 */
export default function ProjectShellV2() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const rawTab = searchParams.get("tab");
  const tab: TabKey = (VALID as string[]).includes(rawTab ?? "") ? (rawTab as TabKey) : "overview";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
      if (cancelled) return;
      setProjectName(data?.name ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
          <Button asChild variant="outline" size="sm">
            <Link to={`/projects/${id}?classic=1`}>Switch to classic view</Link>
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="daily">Daily Report</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <OverviewTab projectId={id} />
          </TabsContent>
          <TabsContent value="daily" className="mt-6">
            <DailyReportTab projectId={id} />
          </TabsContent>
          <TabsContent value="library" className="mt-6">
            <LibraryTab projectId={id} />
          </TabsContent>
          <TabsContent value="map" className="mt-6">
            <MapTab projectId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
