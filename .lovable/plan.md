# Phase 3 — Membership rev. 3 implementation

Plan builds against `buildfolder_membership_spec.md` rev. 3. Rollout follows B5 order (schema+backfill → trigger+RPC → UI → Stripe → telemetry → pricing page; B4 in parallel).

---

## Step 1 — Schema migration + B6 backfill

**Migration 1a — schema:**
- `teams.plan`: `UPDATE teams SET plan='crew' WHERE plan='pro'`. Column is `text` (no enum work needed); add `CHECK (plan IN ('free','solo','crew','studio'))` after the update.
- `teams.addon_seats int NOT NULL DEFAULT 0 CHECK (addon_seats BETWEEN 0 AND 5)`.
- `teams.domain_matching_override boolean NOT NULL DEFAULT false`.
- Drop `teams.grandfathered_until`.
- `team_members.member_type text NOT NULL DEFAULT 'core' CHECK (member_type IN ('core','external'))` — default exists only so backfill can populate; new inserts must supply it (trigger enforces).
- New table `public.free_email_domains(domain text PRIMARY KEY, added_at timestamptz default now())`. GRANT SELECT to `authenticated`; RLS on with authenticated-select policy. Seed with the A3 list.
- New table `public.team_external_approvals(id, team_id, invitee_email citext, invited_by_user_id, use_case_note, status ('pending_approval'|'approved'|'rejected') default 'pending_approval', approved_by_user_id, approved_at, created_at, updated_at)`. GRANTs + RLS: team admins/owners select/insert/update rows for their team; service_role full.
- Update `plan_monthly_hkd()` to new HKD prices (Solo 188 mo / 148 annual; Crew 748 / 598; add-on 158 / 128) via a `_interval text` parameter.
- Drop the Phase 1 `enforce_project_invite_seat_limit` trigger on `project_invites` — enforcement moves to team level.

**Migration 1b — B6 backfill + report:**
- Classify every existing `team_members` row: `member_type='core'` when the member's email domain equals the billing owner's domain and neither sits in `free_email_domains` (or the team has `domain_matching_override=true`); else `member_type='external'`.
- Convert un-accepted outside-domain `project_invites` into `team_external_approvals` (`pending_approval`); leave same-domain invites intact.
- For any team over cap (core > cap, or external > core×5), insert an `activity_events` row with verb `backfill.over_cap` for durable ops visibility.

## Step 2 — Trigger + `team_seat_summary` RPC

- `BEFORE INSERT ON team_members` trigger (SECURITY DEFINER):
  - Resolve `(core_cap, addons_allowed)` by plan; effective cap = base + `addon_seats`.
  - Classify `member_type` if not supplied (owner-on-blocklist + no override ⇒ require explicit value or reject).
  - `core` insert → reject if `core_count + 1 > effective_cap`.
  - `external` insert → require a matching `approved` row in `team_external_approvals`; reject if `external_count + 1 > core_count × 5`; always reject on Free/Solo.
  - Error codes (`SQLSTATE P0001` with prefix): `seat_cap_core`, `seat_cap_external`, `external_not_approved`, `plan_no_externals`, `member_type_required`.
- `BEFORE UPDATE ON teams` guard rejecting `addon_seats` reduction below current core count.
- `BEFORE UPDATE ON team_members` guard rejecting any change to `member_type` (immutable — remove + re-invite).
- `AFTER DELETE ON team_members` trigger: when the delete drops the team below external ratio, insert `activity_events` row `team_below_external_ratio`.
- `public.team_seat_summary(_team_id uuid) RETURNS jsonb` (SECURITY DEFINER, callable by team members) → `{plan, core_count, core_cap, addon_seats, external_count, external_cap, domain_matching_enabled}`. Sole counter surface.

## Step 3 — UI

- `src/hooks/planLimits.ts` — rename `pro` → `crew` throughout; keep `pro` as legacy alias in `normalisePlan()` until Stripe metadata is migrated.
- `src/hooks/useProjectPlan.ts` + `src/hooks/usePlan.ts` — replace ad-hoc member counts with a shared `useTeamSeatSummary(teamId)` hook backed by the new RPC.
- `src/components/InvitesManager.tsx` — split by live domain probe: same-domain → existing core invite path; outside-domain → creates `team_external_approvals` row + shows pending state; owner-on-blocklist teams get a Core/External radio.
- New `src/components/ApprovalsInbox.tsx` inside the Members panel: pending list with approve/reject; approve action opens an inline project picker (approve + assign in one step).
- `src/features/projectDetailV2/MembersPanel.tsx` — Core / External sections with counts vs caps and the below-ratio warning banner (B3.7).
- `src/pages/Team.tsx` — Crew-only add-on seat +/− controls calling a new `teams-update-addon-seats` edge function that updates the Stripe subscription quantity; `teams.addon_seats` is written on webhook confirmation.
- Upsell surfaces: Solo→Crew prompt on external-invite attempt; Crew-at-cap inline "Add a seat (HK$128/mo)" prompt; 10-core / external-cap Studio contact prompt.

## Step 4 — Stripe

- `supabase/functions/stripe-checkout` — pick currency from the pricing-page toggle; look up Price by `(plan, interval, currency)`; add-on seats as a line item with `quantity=addon_seats`.
- `supabase/functions/stripe-webhook` — on `customer.subscription.updated`, write `teams.addon_seats` from the add-on line quantity; parse `plan=crew` (legacy `pro` still accepted during changeover).
- Console-side (documented, not code): create multi-currency Prices for Solo/Crew monthly+annual and the add-on Price per A2.1; archive old Prices; product metadata `plan=crew`.

## Step 5 — Telemetry (B7)

Fire GA4 events via `src/lib/analytics.ts` from the correct call sites:
`external_invite_blocked_ratio`, `external_approval_pending`, `external_approval_granted`, `external_user_started_own_team` (fired from `handle_new_team` trigger when the new owner had a prior `external` `team_members` row), `crew_upsell_shown_from_solo`, `addon_seat_added`, `team_below_external_ratio`.

## Step 6 — Pricing page (last)

`src/components/marketing/PricingSectionV2.tsx` — currency toggle (HKD · USD · GBP · EUR · AUD, locale default, HKD fallback), new copy per B3.4, Crew headline "5 team seats + up to 25 external collaborators included", Solo copy calling out that externals require Crew, Studio unchanged. Ships last so nothing is advertised before enforced.

## Step 7 — B4 Studio readiness (parallel; blocks Studio sales)

- Scale check: script-seed a Studio team with >5 core and >25 external members; walk Members, invite flow, project list; confirm nothing assumes finite caps.
- White-label completeness: extend beyond PDF-only — honour team logo/colours in `SharePage.tsx` (hide `ShareBrandingFooter` when white-label is on) and in invite/share transactional email templates.

## Technical notes

- `teams.plan` is `text` — rename is a data update + CHECK, not an enum migration.
- Phase 1's `project_invites` seat trigger is dropped in the same migration that installs the new team-level trigger, so double-gating never exists.
- All UI counters flow through `team_seat_summary` — no residual client-side `team_members` counting.
- `free_email_domains` is a plain table so support can add/remove domains via SQL editor without a deploy.
- `member_type` is immutable in DB and UI; reclassification = remove + re-invite.
- Backfill is idempotent (safe to re-run on empty state).
