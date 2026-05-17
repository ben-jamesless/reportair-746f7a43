CREATE POLICY "Invites: invitee reads own email"
ON public.project_invites
FOR SELECT
TO authenticated
USING (
  accepted_at IS NULL
  AND lower(email) = lower(COALESCE((auth.jwt() ->> 'email')::text, ''))
);