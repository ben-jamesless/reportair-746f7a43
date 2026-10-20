CREATE OR REPLACE FUNCTION public.share_ops_contact(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  link RECORD;
  contact RECORD;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL OR (link.expires_at IS NOT NULL AND link.expires_at < now()) THEN
    RETURN NULL;
  END IF;

  SELECT pr.full_name, pr.email, pm.role::text AS role
    INTO contact
    FROM public.project_members pm
    JOIN public.profiles pr ON pr.id = pm.user_id
   WHERE pm.project_id = link.project_id
   ORDER BY CASE pm.role::text WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, pm.created_at
   LIMIT 1;

  IF contact.full_name IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('name', contact.full_name, 'role', contact.role, 'email', contact.email);
END $function$;