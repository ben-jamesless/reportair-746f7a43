-- Make invite auto-accept trigger defensive so it can never break signup.
-- Invites are also accepted post-login via accept_project_invite RPC, so this is safe.
CREATE OR REPLACE FUNCTION public.accept_invites_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  BEGIN
    FOR inv IN
      SELECT * FROM public.project_invites
      WHERE lower(email) = lower(NEW.email)
        AND accepted_at IS NULL
    LOOP
      BEGIN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (inv.project_id, NEW.id, inv.role)
        ON CONFLICT DO NOTHING;
        UPDATE public.project_invites
          SET accepted_at = now(), accepted_by = NEW.id
          WHERE id = inv.id;
      EXCEPTION WHEN OTHERS THEN
        -- swallow per-invite errors; user can still accept via RPC after login
        NULL;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END $$;