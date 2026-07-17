-- Clean up existing orphan map features attached to soft-deleted areas
DELETE FROM public.area_map_features f
USING public.areas a
WHERE f.area_id = a.id AND a.deleted_at IS NOT NULL;

-- Prevent future orphans: when an area is soft-deleted, drop its map features
CREATE OR REPLACE FUNCTION public.cleanup_area_features_on_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.area_map_features WHERE area_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_area_features_on_soft_delete ON public.areas;
CREATE TRIGGER trg_cleanup_area_features_on_soft_delete
AFTER UPDATE OF deleted_at ON public.areas
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_area_features_on_soft_delete();