-- 1) Email system tables: scope policies to service_role explicitly + revoke app-role grants
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state" ON public.email_send_state
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role can manage send log" ON public.email_send_log
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can manage unsubscribe tokens" ON public.email_unsubscribe_tokens
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can manage suppressed emails" ON public.suppressed_emails
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.email_send_state FROM anon, authenticated;
REVOKE ALL ON public.email_send_log FROM anon, authenticated;
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon, authenticated;
REVOKE ALL ON public.suppressed_emails FROM anon, authenticated;
GRANT ALL ON public.email_send_state TO service_role;
GRANT ALL ON public.email_send_log TO service_role;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
GRANT ALL ON public.suppressed_emails TO service_role;

-- 2) guest_notes: make the deny-by-default INSERT explicit at the DB layer
REVOKE INSERT, UPDATE ON public.guest_notes FROM anon, authenticated;
GRANT SELECT, DELETE ON public.guest_notes TO authenticated;
GRANT ALL ON public.guest_notes TO service_role;

DROP POLICY IF EXISTS "GuestNotes: no direct inserts" ON public.guest_notes;
CREATE POLICY "GuestNotes: no direct inserts" ON public.guest_notes
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "GuestNotes: no direct updates" ON public.guest_notes;
CREATE POLICY "GuestNotes: no direct updates" ON public.guest_notes
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);