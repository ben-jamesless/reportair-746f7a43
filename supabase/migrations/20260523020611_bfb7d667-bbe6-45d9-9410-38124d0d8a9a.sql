-- 1. Restrict project_invites read access: only owners/editors can list invites for a project.
--    Invitees can still read their own pending invite via the existing "Invites: invitee reads own email" policy.
DROP POLICY IF EXISTS "Invites: members read" ON public.project_invites;
CREATE POLICY "Invites: editors read"
  ON public.project_invites
  FOR SELECT
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

-- 2. Restrict share_links read access: only owners/editors (who also manage them) can read.
DROP POLICY IF EXISTS "Share: members read" ON public.share_links;
CREATE POLICY "Share: editors read"
  ON public.share_links
  FOR SELECT
  USING (has_project_role(auth.uid(), project_id, ARRAY['owner'::project_role, 'editor'::project_role]));

-- 3. Hide Stripe identifiers on teams from clients (only service role / edge functions need them).
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.teams FROM authenticated, anon;

-- 4. Pin search_path on internal email queue helpers (they call pgmq.*).
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb)               SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint)               SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- 5. Lock down Realtime Broadcast/Presence channels. The app only uses postgres_changes
--    (which is gated by per-table RLS), so denying all broadcast/presence is safe.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;