import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fileExt } from "./planRules";

export type PlanCategory = { id: string; name: string; sort_order: number; is_hidden: boolean };
export type PlanVersion = {
  id: string; plan_file_id: string; revision_label: string | null; change_note: string | null;
  storage_path: string; preview_storage_path: string | null; mime_type: string | null;
  file_ext: string | null; size_bytes: number | null; uploaded_by: string | null; uploaded_at: string;
};
export type PlanFile = {
  id: string; project_id: string; team_id: string; category_id: string | null; area_ids: string[];
  name: string; kind: "file" | "link"; url: string | null; current_version_id: string | null;
  client_visible: boolean; created_by: string | null; created_at: string; updated_at: string;
  deleted_at: string | null;
};

// The new tables are not yet in the generated client types everywhere; keep a loose handle.
const db = supabase as any;
const BUCKET = "plan-files";

export function usePlans(projectId: string) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [categories, setCategories] = useState<PlanCategory[]>([]);
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: proj } = await db.from("projects").select("team_id").eq("id", projectId).maybeSingle();
    const tId = proj?.team_id ?? null;
    setTeamId(tId);
    const [{ data: cats }, { data: fs }, { data: vs }] = await Promise.all([
      tId ? db.from("plan_categories").select("id,name,sort_order,is_hidden").eq("team_id", tId).order("sort_order") : { data: [] },
      db.from("plan_files").select("*").eq("project_id", projectId).order("updated_at", { ascending: false }),
      db.from("plan_file_versions").select("*").eq("project_id", projectId).order("uploaded_at", { ascending: false }),
    ]);
    setCategories(cats ?? []);
    setFiles(fs ?? []);
    setVersions(vs ?? []);
    const ids = Array.from(new Set([...(vs ?? []).map((v: PlanVersion) => v.uploaded_by), ...(fs ?? []).map((f: PlanFile) => f.created_by)].filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await db.from("profiles").select("id,full_name,email").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => (m[p.id] = p.full_name || p.email?.split("@")[0] || "Team member"));
      setNames(m);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const versionsByFile = useMemo(() => {
    const m = new Map<string, PlanVersion[]>();
    versions.forEach((v) => m.set(v.plan_file_id, [...(m.get(v.plan_file_id) ?? []), v]));
    return m;
  }, [versions]);

  return { teamId, categories, files, versions, versionsByFile, names, loading, reload: load };
}

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);

async function putObject(projectId: string, fileId: string, file: File) {
  const path = `${projectId}/${fileId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

/** Store the file first; the record is only written once the bytes are safe. */
export async function createPlanFile(args: {
  projectId: string; userId: string; file: File; categoryId: string | null; areaIds: string[]; revision: string;
}) {
  const fileId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const path = await putObject(args.projectId, fileId, args.file);
  const name = args.file.name.replace(/\.[^.]+$/, "");
  const { error: e1 } = await db.from("plan_files").insert({
    id: fileId, project_id: args.projectId, team_id: "00000000-0000-0000-0000-000000000000",
    category_id: args.categoryId, area_ids: args.areaIds, name, kind: "file", created_by: args.userId,
  });
  if (e1) throw e1;
  const { error: e2 } = await db.from("plan_file_versions").insert({
    id: versionId, plan_file_id: fileId, project_id: args.projectId, revision_label: args.revision.trim() || null,
    storage_path: path, mime_type: args.file.type || null, file_ext: fileExt(args.file.name),
    size_bytes: args.file.size, uploaded_by: args.userId,
  });
  if (e2) throw e2;
  const { error: e3 } = await db.from("plan_files").update({ current_version_id: versionId }).eq("id", fileId);
  if (e3) throw e3;
}

export async function createPlanLink(args: {
  projectId: string; userId: string; url: string; name: string; categoryId: string | null; areaIds: string[];
}) {
  const { error } = await db.from("plan_files").insert({
    project_id: args.projectId, team_id: "00000000-0000-0000-0000-000000000000", category_id: args.categoryId,
    area_ids: args.areaIds, name: args.name, kind: "link", url: args.url, created_by: args.userId,
  });
  if (error) throw error;
}

export async function uploadRevision(args: {
  projectId: string; fileId: string; userId: string; file: File; label: string; note: string;
}) {
  const path = await putObject(args.projectId, args.fileId, args.file);
  const versionId = crypto.randomUUID();
  const { error } = await db.from("plan_file_versions").insert({
    id: versionId, plan_file_id: args.fileId, project_id: args.projectId, revision_label: args.label.trim(),
    change_note: args.note.trim() || null, storage_path: path, mime_type: args.file.type || null,
    file_ext: fileExt(args.file.name), size_bytes: args.file.size, uploaded_by: args.userId,
  });
  if (error) throw error;
  const { error: e2 } = await db.from("plan_files").update({ current_version_id: versionId }).eq("id", args.fileId);
  if (e2) throw e2;
}

export async function attachPreview(projectId: string, fileId: string, versionId: string, pdf: File) {
  const path = await putObject(projectId, fileId, pdf);
  const { error } = await db.from("plan_file_versions").update({ preview_storage_path: path }).eq("id", versionId);
  if (error) throw error;
}

export async function updatePlanFile(id: string, patch: Partial<PlanFile> & { deleted_by?: string | null }) {
  const { error } = await db.from("plan_files").update(patch).eq("id", id);
  if (error) throw error;
}

export async function signedPlanUrl(path: string, download = false) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300, download ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
