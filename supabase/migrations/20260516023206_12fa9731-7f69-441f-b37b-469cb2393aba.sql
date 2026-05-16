CREATE OR REPLACE FUNCTION public.admin_list_team_members(_team_id uuid)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT tm.user_id, p.email, p.full_name, tm.role::text, tm.created_at
  FROM public.team_members tm
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  WHERE tm.team_id = _team_id
  ORDER BY tm.role::text, p.full_name;
END $$;