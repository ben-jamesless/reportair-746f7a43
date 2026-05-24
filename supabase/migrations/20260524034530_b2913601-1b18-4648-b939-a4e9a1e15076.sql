CREATE POLICY "Profiles: read project co-members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.project_members pm_other
    WHERE pm_other.user_id = profiles.id
      AND (
        public.is_project_member(auth.uid(), pm_other.project_id)
        OR public.is_team_member(auth.uid(), public.project_team_id(pm_other.project_id))
      )
  )
);