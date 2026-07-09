
-- 1. Areas: color + boundary source
ALTER TABLE public.areas
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS boundary_source text NOT NULL DEFAULT 'none';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'areas_boundary_source_check'
  ) THEN
    ALTER TABLE public.areas
      ADD CONSTRAINT areas_boundary_source_check
      CHECK (boundary_source IN ('none','drawn','imported'));
  END IF;
END $$;

-- 2. Map features: is_primary
ALTER TABLE public.area_map_features
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS area_map_features_one_primary_per_area
  ON public.area_map_features (area_id)
  WHERE is_primary;

-- 3. Backfill primary flag: prefer polygon > rectangle > pin, oldest first
WITH ranked AS (
  SELECT id, area_id,
    row_number() OVER (
      PARTITION BY area_id
      ORDER BY CASE kind WHEN 'polygon' THEN 1 WHEN 'rectangle' THEN 2 ELSE 3 END,
               created_at ASC
    ) AS rn
  FROM public.area_map_features
  WHERE area_id IS NOT NULL
)
UPDATE public.area_map_features f
   SET is_primary = true
  FROM ranked r
 WHERE f.id = r.id AND r.rn = 1;

-- 4. Backfill areas.color and boundary_source
UPDATE public.areas a
   SET color = COALESCE(
     a.color,
     (SELECT f.color FROM public.area_map_features f
       WHERE f.area_id = a.id AND f.is_primary LIMIT 1),
     (SELECT p.color FROM public.projects p WHERE p.id = a.project_id)
   ),
   boundary_source = CASE
     WHEN EXISTS (
       SELECT 1 FROM public.area_map_features f
        WHERE f.area_id = a.id AND f.is_primary
          AND f.kind IN ('polygon','rectangle')
     ) THEN 'drawn'
     ELSE 'none'
   END;

-- 5. RPC: create_zone_with_geometry (area + primary feature in one shot)
CREATE OR REPLACE FUNCTION public.create_zone_with_geometry(
  _project_id uuid,
  _name text,
  _kind text,
  _geometry jsonb,
  _color text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_area_id uuid;
  v_sort int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_project_role(auth.uid(), _project_id,
       ARRAY['owner'::project_role,'editor'::project_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _kind NOT IN ('polygon','rectangle','pin') THEN
    RAISE EXCEPTION 'Invalid kind: %', _kind;
  END IF;

  SELECT COALESCE(MAX(sort_order),0)+1 INTO v_sort
    FROM public.areas WHERE project_id = _project_id;

  INSERT INTO public.areas
    (project_id, name, sort_order, color, boundary_source, created_by)
  VALUES
    (_project_id,
     COALESCE(NULLIF(trim(_name),''),'Zone '||v_sort),
     v_sort, _color,
     CASE WHEN _kind IN ('polygon','rectangle') THEN 'drawn' ELSE 'none' END,
     auth.uid())
  RETURNING id INTO v_area_id;

  INSERT INTO public.area_map_features
    (project_id, area_id, kind, geometry, color, is_primary, created_by)
  VALUES
    (_project_id, v_area_id, _kind, _geometry, _color, true, auth.uid());

  RETURN v_area_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_zone_with_geometry(uuid,text,text,jsonb,text) TO authenticated;

-- 6. RPC: set_primary_map_feature
CREATE OR REPLACE FUNCTION public.set_primary_map_feature(_feature_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_area uuid; v_project uuid;
BEGIN
  SELECT area_id, project_id INTO v_area, v_project
    FROM public.area_map_features WHERE id = _feature_id;
  IF v_area IS NULL THEN RAISE EXCEPTION 'Feature not found or has no area'; END IF;
  IF NOT public.has_project_role(auth.uid(), v_project,
       ARRAY['owner'::project_role,'editor'::project_role]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.area_map_features SET is_primary = false
    WHERE area_id = v_area AND is_primary AND id <> _feature_id;
  UPDATE public.area_map_features SET is_primary = true
    WHERE id = _feature_id;
END $$;

GRANT EXECUTE ON FUNCTION public.set_primary_map_feature(uuid) TO authenticated;
