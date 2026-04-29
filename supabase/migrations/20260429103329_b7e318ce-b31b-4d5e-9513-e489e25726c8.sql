-- Update the seed function to only add Pre-event
CREATE OR REPLACE FUNCTION public.seed_event_production_albums()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.template = 'event_production'::project_template THEN
    INSERT INTO public.albums (project_id, name, slug, position, created_by) VALUES
      (NEW.id, 'Pre-event', 'pre-event', 0, NEW.created_by);
  END IF;
  RETURN NEW;
END; $function$;

-- Detach photos from to-be-removed albums, then drop those albums
UPDATE public.photos p
  SET album_id = NULL
  FROM public.albums a
  WHERE p.album_id = a.id
    AND a.slug IN ('setup','live','breakdown');

DELETE FROM public.albums WHERE slug IN ('setup','live','breakdown');