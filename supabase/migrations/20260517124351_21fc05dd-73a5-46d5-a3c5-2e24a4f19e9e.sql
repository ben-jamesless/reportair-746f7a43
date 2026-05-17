-- Add 'project_invite' to notification type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'project_invite';

-- Function to create an in-app notification for the invitee when their email
-- matches an existing user profile.
CREATE OR REPLACE FUNCTION public.notify_user_of_invite(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_target_user uuid;
  v_inviter_name text;
  v_project_name text;
BEGIN
  SELECT i.id, i.email, i.role, i.project_id, i.invited_by, i.accepted_at
    INTO v_invite
    FROM public.project_invites i
   WHERE i.id = _invite_id;
  IF v_invite.id IS NULL OR v_invite.accepted_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- Match against existing auth user by email (case-insensitive).
  SELECT id INTO v_target_user
    FROM auth.users
   WHERE lower(email) = lower(v_invite.email)
   LIMIT 1;
  IF v_target_user IS NULL THEN
    RETURN;
  END IF;

  SELECT name INTO v_project_name FROM public.projects WHERE id = v_invite.project_id;
  IF v_invite.invited_by IS NOT NULL THEN
    SELECT full_name INTO v_inviter_name FROM public.profiles WHERE id = v_invite.invited_by;
  END IF;

  -- De-dupe: don't re-insert if an unread invite notification already exists for the same project.
  IF EXISTS (
    SELECT 1 FROM public.notifications n
     WHERE n.user_id = v_target_user
       AND n.project_id = v_invite.project_id
       AND n.type = 'project_invite'
       AND n.read_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, project_id, type, body, actor_id, actor_name)
  VALUES (
    v_target_user,
    v_invite.project_id,
    'project_invite'::public.notification_type,
    'invited you to ' || COALESCE(v_project_name, 'a project') || ' as ' || v_invite.role::text,
    v_invite.invited_by,
    COALESCE(v_inviter_name, 'Someone')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user_of_invite(uuid) TO authenticated, service_role;