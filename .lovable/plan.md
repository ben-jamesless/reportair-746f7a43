# Phase 1 — Fix invited-member mis-tier + close seat-limit bypass

## 1. Expand `useProjectPlan(projectId)` to full parity with `usePlan()`

Rewrite `src/hooks/useProjectPlan.ts` so it returns the same shape as `usePlan()`, resolved via `project → team → plan` instead of `billing_owner_user_id = auth.uid()`.

Add to the returned state:
- Full `PlanLimits` (all keys — reuse the `LIMITS` map, don't duplicate). Move the `LIMITS` + `PlanName` + `PlanLimits` types into a shared `src/hooks/planLimits.ts` and import from both hooks so there is one source of truth.
- `plan`, `teamId`, `teamName`, `billingOwnerUserId`, `billingOwnerName`, `isBillingOwner` (already present).
- `showBuildSlidesBranding`, `subscriptionStatus`, `trialEndsAt`, `currentPeriodEnd`, `paymentFailedAt`, `exportsThisMonth` (from the team row).
- `projectCount` (owner-scoped — only meaningful for the billing owner; fine to return 0 for non-owners since project-scoped surfaces don't gate on it).
- `memberCount` — resolved via the new `team_member_count` RPC (below), not a client `team_members` select.
- All `canX` booleans derived the same way as in `usePlan()`:
  `canCreateProject, canInviteMember, canExportPdf, canUseShareLink, canUseShareLinkEmail, canUsePasswordLinks, canUseCustomLogo, canUseWhiteLabel, canUseFolders, planIncludesInvites, isFree`.
- `refetch()` + realtime subscription on `teams` row updates (mirror the pattern in `usePlan`).

Keep the hook resilient to `projectId === null` (returns loading:false, free defaults).

## 2. Migrate project-context call sites from `usePlan()` → `useProjectPlan(projectId)`

Each file below: swap the import, pass the current `projectId` (already available in each), and read the same destructured fields. No behavior change beyond correct tiering.

- `src/components/InvitesManager.tsx` — needs `projectId` prop (check callers) or resolve via context.
- `src/components/ShareLinksManager.tsx`
- `src/components/ProjectSettingsDialog.tsx`
- `src/components/ExportPdfDialog.tsx`
- `src/components/ProjectEditForm.tsx`
- `src/pages/ProjectDetail.tsx`
- `src/features/projectDetail/useProjectDetail.ts` — currently uses `projectCount`/`limits` for the create-project gate; this is a project-scoped hook but the check is account-scoped. Keep this one on `usePlan()` since it gates project creation, not project usage. **Correction:** leave `useProjectDetail.ts` on `usePlan()` if the only usage is create-project math; verify during implementation and only migrate the gates that concern the currently-viewed project's plan.

**Leave unchanged (account-scoped):** `AppSidebar`, `TrialBanner`, `PaymentFailedBanner`, `PlanGuard`, `pages/Projects.tsx` (create-project), `pages/Settings.tsx` (white-label toggle), `pages/Billing.tsx`, `pages/Team.tsx`.

## 3. Seat counting — correct display + server enforcement

### 3a. `team_member_count` RPC (SECURITY DEFINER)
Returns accurate seat count for a team regardless of caller RLS. Counts distinct users across `team_members` for `_team_id`, plus the billing owner if not already in `team_members` (match whatever `usePlan` intends — verify current semantics during implementation and mirror them). Grant EXECUTE to `authenticated`.

Use it in:
- `useProjectPlan` for `memberCount` / `canInviteMember`.
- `InvitesManager.tsx` (replaces the current `team_members` select which under-counts for non-owners).

### 3b. Server-side seat cap enforcement on `project_invites`
Add a `BEFORE INSERT` trigger on `public.project_invites` (SECURITY DEFINER function) that:
1. Resolves the project's `team_id`.
2. Reads `teams.plan`, maps to `maxMembers` via a SQL equivalent of the LIMITS map (inline `CASE` on plan is fine — small, stable set).
3. If `maxMembers <> -1` AND `team_member_count(team_id) + pending_invite_count(team_id) >= maxMembers`, raise `EXCEPTION 'seat_limit_reached'` with a clear SQLSTATE.
4. Also block if `planIncludesInvites` is false for the plan (free/solo).

Pending invites: count rows in `project_invites` for projects on that team where `status = 'pending'` (or equivalent — confirm column names when writing the migration).

Client surfaces the resulting error as the existing "upgrade to invite more" upsell.

## Acceptance tests (manual)

- Invited editor on a Studio team: can invite members, create password-protected share links, export PDF with custom logo, no build-day banner.
- Invited editor on a Free team: still hits 3-build-day banner, PDF export blocked, share-link email/password blocked.
- Team at `maxMembers` cap: direct `supabase.from('project_invites').insert(...)` from browser console fails with `seat_limit_reached`.
- Billing owner UIs (Team, Billing, Settings > white-label) unchanged.

## Technical notes

- Single source of truth for `LIMITS` avoids drift — extract to `src/hooks/planLimits.ts` before touching either hook.
- `useProjectPlan` becomes the canonical hook for anything scoped to a viewed project; `usePlan` remains for global/account UI (sidebar, billing, create-project math).
- The DB trigger is the real fix for the seat bypass — the RPC is only for accurate display; RLS alone cannot express "count vs. plan limit".
- No changes to Classic UI, tier definitions, or Stripe wiring in this phase.
