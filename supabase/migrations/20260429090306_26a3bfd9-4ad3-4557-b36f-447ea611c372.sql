-- Albums table
CREATE TABLE public.albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE INDEX idx_albums_project ON public.albums(project_id, position);

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Albums: members read"
  ON public.albums FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id)
         OR public.is_team_member(auth.uid(), public.project_team_id(project_id)));

CREATE POLICY "Albums: editors insert"
  ON public.albums FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE POLICY "Albums: editors update"
  ON public.albums FOR UPDATE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role,'editor'::project_role]));

CREATE POLICY "Albums: owners delete"
  ON public.albums FOR DELETE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role]));

CREATE TRIGGER albums_set_updated_at
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed albums when an Event Production project is created
CREATE OR REPLACE FUNCTION public.seed_event_production_albums()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.template = 'event_production'::project_template THEN
    INSERT INTO public.albums (project_id, name, slug, position, created_by) VALUES
      (NEW.id, 'Pre-event', 'pre-event', 0, NEW.created_by),
      (NEW.id, 'Setup',     'setup',     1, NEW.created_by),
      (NEW.id, 'Live',      'live',      2, NEW.created_by),
      (NEW.id, 'Breakdown', 'breakdown', 3, NEW.created_by);
  END IF;
  RETURN NEW;
END; $$;

-- Make sure project owner trigger + albums seed both fire on project insert
DROP TRIGGER IF EXISTS on_project_created_owner ON public.projects;
CREATE TRIGGER on_project_created_owner
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

DROP TRIGGER IF EXISTS on_project_created_seed_albums ON public.projects;
CREATE TRIGGER on_project_created_seed_albums
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.seed_event_production_albums();

-- Also ensure the new-user and new-team triggers exist (idempotent re-creation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_team_created_owner ON public.teams;
CREATE TRIGGER on_team_created_owner
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

DROP TRIGGER IF EXISTS teams_set_updated_at ON public.teams;
CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS projects_set_updated_at ON public.projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();