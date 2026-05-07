import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProjectRole = "owner" | "editor" | "viewer";

export type ProjectMember = {
  user_id: string;
  role: ProjectRole;
  full_name: string | null;
  email: string | null;
};

export const useProjectMembers = (projectId: string) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: pm } = await supabase
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);
    const rows = (pm ?? []) as { user_id: string; role: ProjectRole }[];
    if (!rows.length) {
      setMembers([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", rows.map((r) => r.user_id));
    const profMap = new Map(
      ((profs ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
        (p) => [p.id, p],
      ),
    );
    setMembers(
      rows.map((r) => ({
        user_id: r.user_id,
        role: r.role,
        full_name: profMap.get(r.user_id)?.full_name ?? null,
        email: profMap.get(r.user_id)?.email ?? null,
      })),
    );
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const ownerCount = members.filter((m) => m.role === "owner").length;

  const invite = useCallback(
    async (email: string, role: ProjectRole) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("project_invites")
        .insert({
          project_id: projectId,
          email: email.toLowerCase(),
          role,
          invited_by: auth.user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted?.id) {
        await supabase.functions.invoke("send-invite-email", { body: { inviteId: inserted.id } });
      }
      return inserted;
    },
    [projectId],
  );

  const updateRole = useCallback(
    async (userId: string, newRole: ProjectRole) => {
      const { error } = await supabase
        .from("project_members")
        .update({ role: newRole })
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
      await load();
    },
    [projectId, load],
  );

  const remove = useCallback(
    async (userId: string) => {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
      await load();
    },
    [projectId, load],
  );

  return { members, loading, ownerCount, reload: load, invite, updateRole, remove };
};
