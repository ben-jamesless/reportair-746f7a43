# Prevent multiple teams per billing owner

## Context

Today, a user can end up as `billing_owner_user_id` of more than one team. We already have one such case in the database (`184b…972480` owns 2 teams). The biggest offender is the invited-user shortcut in onboarding: when an already-invited user logs in for the first time, `Onboarding.tsx` *unconditionally* creates a brand-new team for them at line 56 — even though they were just added to someone else's project. That's the duplicate generator.

Your two SQL options are both useful, but neither is sufficient on its own:

- **Option A (UNIQUE constraint)** — correct long-term guarantee, but the column is actually `billing_owner_user_id` (not `owner_user_id`), and the migration will fail until the existing duplicate is resolved.
- **Option B (pre-insert SELECT)** — race-prone (two parallel inserts can both pass the check), and only protects the code paths you remember to update.

Recommendation: do **both** — Option A as the hard guarantee in the database, plus fix the app logic so users don't hit it as a runtime error.

## Plan

### 1. Reconcile the existing duplicate
- Inspect the two teams owned by `184b…972480` (names, member counts, project counts, Stripe subscription).
- Either:
  - Reassign `billing_owner_user_id` of the secondary team to another team member (using `admin_set_team_billing_owner`), or
  - Delete the empty/unused one via `admin_delete_team` if it has no real content.
- Decide based on what the data shows — will surface options once we look.

### 2. Fix the onboarding logic that creates extra teams

In `src/pages/Onboarding.tsx`:

- **Invited-user shortcut (lines ~40–65)**: stop creating a team here. An invited user already belongs to someone else's project/team — they don't need their own workspace just to land in `/projects`. Mark `onboarded_at`, then redirect.
- **All 3 insert sites**: before inserting a team, check whether the current user is already `billing_owner_user_id` of an existing team. If so, skip the insert and reuse it. This makes the flows idempotent (e.g. retry after a transient failure won't double-create).
- Surface a friendly error if the DB constraint ever does fire ("You already own a workspace").

### 3. Add the database constraint (after step 1)

```sql
ALTER TABLE public.teams
  ADD CONSTRAINT teams_billing_owner_unique UNIQUE (billing_owner_user_id);
```

This is the durable guarantee. Even if some future code path tries to insert a second team for the same billing owner, Postgres will reject it.

### 4. Verify

- Re-run the duplicates query — should return 0 rows.
- Walk through the three onboarding paths mentally / via preview to confirm none of them double-insert.

## Notes / open question

Do you want this rule to be **permanent** ("a user can only ever billing-own one team")? That's what the UNIQUE constraint enforces. If you ever want to support a user owning multiple workspaces (common for agencies/consultants), we'd instead keep this as an app-level guard only and skip step 3. My read is you want the hard rule — but flag it before I run the migration.
