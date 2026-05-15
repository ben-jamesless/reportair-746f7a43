## Findings

**1. `project_role` enum values:** `owner`, `editor`, `commenter`, `viewer`. There is **no `invited` role** — invitations live in a separate `project_invites` table, and once accepted they become a row in `project_members` with one of those four roles. So we can't distinguish "invited" purely by role; we have to distinguish by *which team owns the project* vs. which projects the user merely has membership on.

**2. `team_role` enum values:** `owner`, `admin`, `member`. Each `teams` row has a single `billing_owner_user_id`.

**3. Current quota source:** `usePlan.ts` calls `my_accessible_projects()` and counts the array length. That RPC unions `project_members` (per-project invites) with `team_members` (team-mates), so a Solo user invited to one foreign project sees `1/1`.

**4. Canonical "counts toward quota" definition (confirming your intuition):** an event counts against a user's plan if it lives on a team they belong to — i.e. `projects.team_id IN (teams the user is a team_member of)`. This is correct because:
   - Solo plan = a one-person team where the user is the sole `team_member` and `billing_owner_user_id`. Their owned events are exactly the events on that team.
   - Pro/Studio = team-mates share the team's quota. A Pro team-mate creating an event consumes one of the team's 5 slots, even though they're not the billing owner. So filtering by `billing_owner_user_id = auth.uid()` would *under*-count for team-mates. Filtering by `team_members.user_id = auth.uid()` is the right pivot.
   - Invited users on `project_members` for a project on *someone else's* team are excluded, which is what we want.

**5. Archived events:** `projects.archived_at IS NOT NULL` should be excluded. The pricing page says "active events", and archiving is the user's escape hatch when they hit the limit, so it must drop the count.

## Plan

### a. New SQL migration

`supabase/migrations/<ts>_my_owned_projects_count.sql`:

```sql
CREATE OR REPLACE FUNCTION public.my_owned_projects_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.projects p
  WHERE auth.uid() IS NOT NULL
    AND p.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.my_owned_projects_count() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_owned_projects_count() TO authenticated;
```

Returning a scalar `int` keeps the wire payload tiny and avoids re-shaping a row type. `my_accessible_projects()` is left untouched and still feeds the visible list.

### b. `src/hooks/usePlan.ts`

Add a parallel `supabase.rpc("my_owned_projects_count")` call alongside the existing `my_accessible_projects()` call. Use the scalar return value for `projectCount` (and therefore `canCreateProject`). The accessible list keeps being fetched only if other hook consumers need it — a quick check shows it's only used here for `.length`, so we can drop that call entirely from `usePlan` and rely on the scalar. Confirm during impl by grepping for any other reader of the hook's `projectCount`.

### c. `src/pages/Projects.tsx`

- Counter + `canCreateProject` + the `atLimit` flag automatically pick up the corrected `projectCount` from the hook — no display change required.
- The page already calls `my_accessible_projects()` separately (via the `accessibleProjects` lib) for the list itself, so invited events keep showing up in the list.
- **No section-header redesign.** Keeping the existing flat list — the counter accurately reflecting "1/1" vs "0/1" already disambiguates ownership for the user, and a redesign is out of scope.

### d. Files NOT touched

- `LIMITS` constant (values are correct).
- `20260515135500_pm_self_leave_policy.sql` and the leave-event handler (PR #2 territory).
- `my_accessible_projects()` RPC (still needed for the list).

## Verification after implementation

- `npx tsc --noEmit -p tsconfig.app.json`
- `npx eslint .`
- Manual matrix against the four acceptance scenarios (Solo invited-only → 0/1, Solo owner → 1/1, Pro team with 3 events → 3/5, archived event excluded).

Approve and I'll run the migration + apply the code changes.