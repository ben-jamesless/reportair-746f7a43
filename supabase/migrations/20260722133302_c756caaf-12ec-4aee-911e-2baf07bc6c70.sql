-- Align team_external_approvals.status values with what the app writes:
-- 'pending' (was 'pending_approval') and 'denied' (was 'rejected').
ALTER TABLE public.team_external_approvals
  DROP CONSTRAINT IF EXISTS team_external_approvals_status_check;

UPDATE public.team_external_approvals SET status = 'pending' WHERE status = 'pending_approval';
UPDATE public.team_external_approvals SET status = 'denied'  WHERE status = 'rejected';

ALTER TABLE public.team_external_approvals
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.team_external_approvals
  ADD CONSTRAINT team_external_approvals_status_check
    CHECK (status IN ('pending','approved','denied'));

DROP INDEX IF EXISTS public.team_external_approvals_pending_uniq;
CREATE UNIQUE INDEX team_external_approvals_pending_uniq
  ON public.team_external_approvals(team_id, invitee_email)
  WHERE status = 'pending';