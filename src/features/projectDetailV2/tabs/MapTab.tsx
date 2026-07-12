import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteMapTab } from "@/features/projectMap/SiteMapTab";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  projectId: string;
}

/**
 * v2 Map tab — a single surface with View / Edit modes toggled from the header
 * (see SiteMapTab). Tapping a polygon in View mode routes to the Library tab
 * filtered to that area.
 */
export function MapTab({ projectId }: Props) {
  const [color, setColor] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: project } = await supabase
        .from("projects")
        .select("color, created_by, team_id")
        .eq("id", projectId)
        .maybeSingle();

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;

      let edit = false;
      if (uid && project) {
        if (project.created_by === uid) {
          edit = true;
        } else {
          const { data: pm } = await supabase
            .from("project_members")
            .select("role")
            .eq("project_id", projectId)
            .eq("user_id", uid)
            .maybeSingle();
          if (pm?.role && ["owner", "editor"].includes(pm.role)) edit = true;
          if (!edit && project.team_id) {
            const { data: tm } = await supabase
              .from("team_members")
              .select("role")
              .eq("team_id", project.team_id)
              .eq("user_id", uid)
              .maybeSingle();
            if (tm?.role && ["owner", "admin", "editor"].includes(tm.role)) edit = true;
          }
        }
      }

      if (cancelled) return;
      setColor(project?.color ?? null);
      setCanEdit(edit);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const openAreaInLibrary = (areaId: string) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", "library");
    p.set("filter", areaId);
    setSearchParams(p, { replace: false });
  };

  if (loading) return <Skeleton className="h-[600px] w-full" />;
  return (
    <SiteMapTab
      projectId={projectId}
      color={color}
      canEdit={canEdit}
      onAreaOpen={openAreaInLibrary}
    />
  );
}
