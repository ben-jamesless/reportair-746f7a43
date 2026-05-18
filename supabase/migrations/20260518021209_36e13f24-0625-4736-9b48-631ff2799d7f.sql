ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS brand_colour varchar(7) DEFAULT NULL;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS white_label_pdf boolean NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_photo_id uuid DEFAULT NULL
  REFERENCES public.photos(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_asset_path text DEFAULT NULL;