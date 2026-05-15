-- Allow users to remove themselves from a project they belong to.
--
-- Background: The previous DELETE policy on project_members (`PM: owners delete`)
-- only let project owners delete rows. That meant invited/member users could
-- never leave a project they didn't own — the client's `Leave event` button
-- silently filtered to zero affected rows under RLS and the UI showed a
-- misleading "Left event" toast while the row remained.
--
-- This policy lets any authenticated user delete their own membership row.
-- Owners can still remove other people's rows via the existing owners-delete
-- policy. PostgreSQL OR-combines RLS DELETE policies, so both apply.

CREATE POLICY "PM: self leave"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
