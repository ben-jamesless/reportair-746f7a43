-- Clean up any pre-existing orphan rows before adding constraints
DELETE FROM public.project_members pm
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pm.user_id);

DELETE FROM public.project_invites pi
 WHERE pi.accepted_by IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pi.accepted_by);

UPDATE public.project_invites pi
   SET invited_by = NULL
 WHERE pi.invited_by IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pi.invited_by);

-- project_members.user_id -> profiles(id) CASCADE
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- project_invites.accepted_by -> profiles(id) CASCADE
ALTER TABLE public.project_invites
  DROP CONSTRAINT IF EXISTS project_invites_accepted_by_fkey;
ALTER TABLE public.project_invites
  ADD CONSTRAINT project_invites_accepted_by_fkey
  FOREIGN KEY (accepted_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- project_invites.invited_by -> profiles(id) SET NULL
ALTER TABLE public.project_invites
  DROP CONSTRAINT IF EXISTS project_invites_invited_by_fkey;
ALTER TABLE public.project_invites
  ADD CONSTRAINT project_invites_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;