-- Retain legacy RPC signatures and generated has_password for compatibility.
-- Ensure all existing and future share links remain password-free.
CREATE OR REPLACE FUNCTION public.keep_share_links_password_free()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.password_hash := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_share_links_password_free() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER keep_share_links_password_free
BEFORE INSERT OR UPDATE ON public.share_links
FOR EACH ROW EXECUTE FUNCTION public.keep_share_links_password_free();

UPDATE public.share_links SET password_hash = NULL WHERE password_hash IS NOT NULL;