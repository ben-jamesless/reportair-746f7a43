## Status against your brief

Verified against the live schema and code — most of this slice already shipped in the previous turn. Remaining work is small.

### Already landed (verified)

- **Partial unique index on `growth_events`**: `growth_events_once_only_actor_verb ON (actor_id, verb) WHERE verb = 'external_user_started_own_team'`. The global `UNIQUE (actor_id, verb)` is gone, so `addon_seat_added`, `external_invite_blocked_ratio`, `external_approval_granted`, `external_approval_pending`, `crew_upsell_shown_from_solo`, `team_below_external_ratio` can insert freely.
- **`AFTER INSERT ON teams` trigger** (`log_external_user_started_own_team`): inserts into `growth_events` with `ON CONFLICT ... DO NOTHING` inside an `EXCEPTION WHEN OTHERS THEN NULL` block. Telemetry cannot abort team creation.
- **Edge function `classify-invitee`**: thin wrapper — single `supabase.rpc("classify_invitee", ...)`, no logic re-derivation. Enforces auth + team-membership so it can't be used to enumerate domains.
- **Schema deps for the classifier**: `public.free_email_domains` exists (seeded); `public.teams.domain_matching_override` exists; `public.team_external_approvals` exists. `classify_invitee` reads all three via `team_domain_matching_enabled` and returns `core | external | requires_explicit_choice`, with blocklisted invitees always `external` (checked before the shared-domain branch).
- **Invite modal live preview** in `InvitesManager.tsx`: 350ms debounce, three-way branch (core / external "Request collaborator" flow writing `team_external_approvals` as pending with use-case note / explicit Core-vs-External selector), non-blocking on slow or failed edge calls, surfaces trigger rejection messages (`seat_cap_core`, `external_not_approved`, ratio) cleanly on write.

### Small fixes to land this slice

1. **`ON CONFLICT` predicate mismatch** in `log_external_user_started_own_team`. Current code uses `ON CONFLICT (actor_id, verb) WHERE verb IN ('external_user_started_own_team') DO NOTHING`, which does not match the partial index's predicate form Postgres expects for arbiter inference. Today it's masked by the outer `EXCEPTION WHEN OTHERS` — duplicates silently exit through the exception path instead of the intended fast no-op. Rewrite as `ON CONFLICT (actor_id, verb) WHERE verb = 'external_user_started_own_team' DO NOTHING` so inference matches the partial index.

2. **Seat indicators inside the invite form** (finishes the UI half of "core → show core seats remaining / external → show external ratio status"). In `InvitesManager.tsx`, read `useTeamSeatSummary(teamId)` and render a one-line status directly below the classification preview:
   - `core` → `Core seats: {coreCount}/{coreCap} · {remaining} left` (amber when `remaining <= 1`, red at 0).
   - `external` → `External: {externalCount}/{externalCap} · ratio {externalCount}:{coreCount * 5}` (amber when `underRatio`).
   - `requires_explicit_choice` → both lines dimmed until the admin picks.
   - Debounce / failed / empty → render nothing (preview degrades, never gates).
   
   Styling matches `TeamSeatStrip`: JetBrains Mono uppercase caption, hairline `border-t border-dashed`, same `#E3DFD4` / `#FAF8F2` tokens. Reuses the existing `team_seat_summary` RPC and its realtime channel — no new hooks or queries.

### Acceptance tests (from brief)

- (a) Blocklisted invitee on the owner's own domain → preview `external`, write persists as `external`. Verified in `classify_invitee`: blocklist check runs before the shared-domain check.
- (b) Free-provider owner without override → `team_domain_matching_enabled` false → `requires_explicit_choice` → selector required before submit.
- (c) Edge function mocked to fail → `classifyState = "failed"`, submit still allowed, `enforce_team_member_caps` trigger authoritative on write.

### Out of scope (as stated)

Stripe multi-currency Prices, remaining B7 event wiring beyond this index/trigger fix, pricing page.

### Technical notes

- One migration: `CREATE OR REPLACE FUNCTION public.log_external_user_started_own_team()` with corrected `ON CONFLICT` predicate. No index or table changes.
- Frontend: edits confined to `src/components/InvitesManager.tsx`. No new files.
