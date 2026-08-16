CREATE OR REPLACE FUNCTION public.share_preview_selftest()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sl RECORD; uid uuid; tok text; res jsonb;
BEGIN
  SELECT s.id, s.project_id INTO sl FROM public.share_links s WHERE s.revoked_at IS NULL LIMIT 1;
  IF sl.id IS NULL THEN RETURN jsonb_build_object('error','no share links'); END IF;
  SELECT m.user_id INTO uid FROM public.project_members m WHERE m.project_id = sl.project_id LIMIT 1;
  tok := uid::text || '.' || public.share_preview_sign(sl.id, uid);
  RETURN jsonb_build_object(
    'no_token', public.share_preview_is_team(sl.id, sl.project_id, NULL),
    'valid', public.share_preview_is_team(sl.id, sl.project_id, tok),
    'forged_sig', public.share_preview_is_team(sl.id, sl.project_id, uid::text || '.deadbeef'),
    'valid_sig_wrong_user', public.share_preview_is_team(sl.id, sl.project_id, gen_random_uuid()::text || '.' || split_part(tok,'.',2)),
    'non_member', public.share_preview_is_team(sl.id, sl.project_id, gen_random_uuid()::text || '.' || public.share_preview_sign(sl.id, gen_random_uuid())),
    'garbage', public.share_preview_is_team(sl.id, sl.project_id, 'not-a-token')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.share_preview_selftest() TO PUBLIC;