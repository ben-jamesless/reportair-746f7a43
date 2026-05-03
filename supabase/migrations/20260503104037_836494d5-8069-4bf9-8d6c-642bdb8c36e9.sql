ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS geo_lat numeric,
  ADD COLUMN IF NOT EXISTS geo_lng numeric,
  ADD COLUMN IF NOT EXISTS geo_location_query text;