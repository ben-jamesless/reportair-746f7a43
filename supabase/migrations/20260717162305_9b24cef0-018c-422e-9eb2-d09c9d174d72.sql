
-- Helper: reader = any project_member NOT in crew role.
CREATE OR REPLACE FUNCTION public.is_project_reader(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND role::text <> 'crew'
  )
$$;

-- Helper: is this user a crew member on this project?
CREATE OR REPLACE FUNCTION public.is_project_crew(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
      AND role::text = 'crew'
  )
$$;

-- ---------- Swap SELECT policies to exclude crew on report-content tables.
-- Pattern: reader OR team_member (same as before, minus crew).

DROP POLICY IF EXISTS "DayNotes: members read" ON public.day_notes;
CREATE POLICY "DayNotes: members read" ON public.day_notes
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "AreaDayStatus: members read" ON public.area_day_status;
CREATE POLICY "AreaDayStatus: members read" ON public.area_day_status
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "AreaDayNotes: members read" ON public.area_day_notes;
CREATE POLICY "AreaDayNotes: members read" ON public.area_day_notes
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "Comments: members read" ON public.comments;
CREATE POLICY "Comments: members read" ON public.comments
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "GuestNotes: members read" ON public.guest_notes;
CREATE POLICY "GuestNotes: members read" ON public.guest_notes
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "Exports: members read" ON public.project_exports;
CREATE POLICY "Exports: members read" ON public.project_exports
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "Activity: members read" ON public.activity_events;
CREATE POLICY "Activity: members read" ON public.activity_events
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "Albums: members read" ON public.albums;
CREATE POLICY "Albums: members read" ON public.albums
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

DROP POLICY IF EXISTS "Members can view map features" ON public.area_map_features;
CREATE POLICY "Members can view map features" ON public.area_map_features
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id));

DROP POLICY IF EXISTS "Project members can view photo_day_hidden" ON public.photo_day_hidden;
CREATE POLICY "Project readers can view photo_day_hidden" ON public.photo_day_hidden
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id));

-- Share links: only readers can see; existing invitee-email read policy stays.
DROP POLICY IF EXISTS "Share: members read" ON public.share_links;
CREATE POLICY "Share: readers read" ON public.share_links
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

-- Invites: keep owner-manage + invitee-email read, but restrict editors read to readers.
DROP POLICY IF EXISTS "Invites: editors read" ON public.project_invites;
CREATE POLICY "Invites: editors read" ON public.project_invites
  FOR SELECT TO authenticated
  USING (public.has_project_role(auth.uid(), project_id,
    ARRAY['owner'::project_role, 'editor'::project_role]));

-- ---------- Photos: crew sees only own uploads; can INSERT their own.
DROP POLICY IF EXISTS "Photos: members read" ON public.photos;
CREATE POLICY "Photos: readers read" ON public.photos
  FOR SELECT TO authenticated
  USING (public.is_project_reader(auth.uid(), project_id)
      OR public.is_team_member(auth.uid(), public.project_team_id(project_id))
      OR (public.is_project_crew(auth.uid(), project_id) AND uploaded_by = auth.uid()));

-- Add crew INSERT alongside existing editor INSERT (both policies OR together).
DROP POLICY IF EXISTS "Photos: crew insert" ON public.photos;
CREATE POLICY "Photos: crew insert" ON public.photos
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND public.is_project_crew(auth.uid(), project_id)
  );

-- Crew can delete their own not-yet-anything photos? Spec: capture-only, no delete.
-- Skip.

-- ---------- Area day notes: crew INSERT allowed (area-note capture).
-- Existing editor INSERT stays. Add crew INSERT.
DROP POLICY IF EXISTS "AreaDayNotes: crew insert" ON public.area_day_notes;
CREATE POLICY "AreaDayNotes: crew insert" ON public.area_day_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_crew(auth.uid(), project_id));

-- Crew SELECT on own area_day_notes so their just-written note doesn't 404.
DROP POLICY IF EXISTS "AreaDayNotes: crew read own" ON public.area_day_notes;
CREATE POLICY "AreaDayNotes: crew read own" ON public.area_day_notes
  FOR SELECT TO authenticated
  USING (public.is_project_crew(auth.uid(), project_id)
     AND auth.uid() = updated_by);

-- ---------- Projects: crew still needs to see the project row (name) for the shell.
-- Existing "Projects: members read" uses is_project_member OR is_team_member, which already
-- includes crew. Leave as-is so crew can render the project header.
-- Sensitive project settings columns are gated by UPDATE policy which crew never satisfies.
