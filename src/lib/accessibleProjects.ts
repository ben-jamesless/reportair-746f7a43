import { supabase } from "@/integrations/supabase/client";

export type AccessibleProject = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  created_at: string;
  color: string | null;
  event_date: string | null;
  event_location: string | null;
  overall_status: string | null;
  event_type: string | null;
  client_name: string | null;
  archived_at: string | null;
  folder_id: string | null;
};

const PROJECT_COLUMNS = "id, name, description, template, created_at, color, event_date, event_location, overall_status, event_type, client_name, archived_at, folder_id";

const uniqueById = (rows: AccessibleProject[]) =>
  Array.from(new Map(rows.map((project) => [project.id, project])).values());

export const fetchAccessibleProjects = async (userId: string): Promise<AccessibleProject[]> => {
  const { data: rpcData, error: rpcError } = await supabase.rpc("my_accessible_projects");
  if (!rpcError && rpcData) return rpcData as AccessibleProject[];

  const { data: rlsProjects, error: rlsError } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("created_at", { ascending: false });
  if (rlsError) throw rlsError;

  const projects = (rlsProjects ?? []) as AccessibleProject[];
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  const missingProjectIds = (memberships ?? [])
    .map((membership) => membership.project_id as string)
    .filter((projectId) => !projects.some((project) => project.id === projectId));

  if (!missingProjectIds.length) return projects;

  const { data: memberProjects } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .in("id", missingProjectIds);

  return uniqueById([...projects, ...((memberProjects ?? []) as AccessibleProject[])]).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
};

export const isProjectInFolderView = (
  project: Pick<AccessibleProject, "folder_id">,
  selectedFolder: string,
  visibleFolderIds: Set<string>,
  allFolderKey: string,
  unfolderedFolderKey: string,
) => {
  if (selectedFolder === unfolderedFolderKey) {
    return !project.folder_id || !visibleFolderIds.has(project.folder_id);
  }
  if (selectedFolder !== allFolderKey) {
    return project.folder_id === selectedFolder;
  }
  return true;
};