DO $$
DECLARE
  keep_id uuid := '47d784c3-c36d-44b3-9466-074007fe5efb';
BEGIN
  DELETE FROM public.notifications;
  DELETE FROM public.comments;
  DELETE FROM public.guest_notes;
  DELETE FROM public.area_day_status;
  DELETE FROM public.area_day_notes;
  DELETE FROM public.day_notes;
  DELETE FROM public.photos;
  DELETE FROM public.areas;
  DELETE FROM public.albums;
  DELETE FROM public.share_links;
  DELETE FROM public.project_invites;
  DELETE FROM public.project_exports;
  DELETE FROM public.activity_events;
  DELETE FROM public.project_members;
  DELETE FROM public.projects;

  DELETE FROM public.folders;
  DELETE FROM public.team_members;
  DELETE FROM public.teams;

  DELETE FROM public.email_send_log;
  DELETE FROM public.email_unsubscribe_tokens;
  DELETE FROM public.suppressed_emails;

  DELETE FROM public.profiles WHERE id <> keep_id;
  DELETE FROM public.user_roles WHERE user_id <> keep_id;
  DELETE FROM auth.users WHERE id <> keep_id;
END $$;