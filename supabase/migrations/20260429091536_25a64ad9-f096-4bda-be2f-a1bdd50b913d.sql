-- Attach the missing trigger so event_production projects auto-seed albums
DROP TRIGGER IF EXISTS on_project_created_seed_albums ON public.projects;
CREATE TRIGGER on_project_created_seed_albums
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.seed_event_production_albums();

-- Backfill albums for existing event_production projects that have none
INSERT INTO public.albums (project_id, name, slug, position, created_by)
SELECT p.id, v.name, v.slug, v.position, p.created_by
FROM public.projects p
CROSS JOIN (VALUES
  ('Pre-event','pre-event',0),
  ('Setup','setup',1),
  ('Live','live',2),
  ('Breakdown','breakdown',3)
) AS v(name, slug, position)
WHERE p.template = 'event_production'
  AND NOT EXISTS (SELECT 1 FROM public.albums a WHERE a.project_id = p.id);