## Goal
A one-shot SQL "clean refresh" that wipes all data and users **except** your admin account (`ben.jameslee@gmail.com`, id `47d784c3-c36d-44b3-9466-074007fe5efb`). No UI exposed — runs via the migration tool when you confirm.

## What gets deleted
All rows in:
- `notifications`, `comments`, `guest_notes`
- `area_day_status`, `area_day_notes`, `day_notes`
- `photos`, `areas`, `albums`
- `share_links`, `project_invites`, `project_exports`, `activity_events`
- `project_members`, `projects`
- `folders`
- `team_members`, `teams`
- `email_send_log`, `email_unsubscribe_tokens`, `suppressed_emails` (housekeeping)
- `profiles` (every row except yours)
- `user_roles` (every row except yours)
- `auth.users` (every row except yours)

Storage buckets (`photos`, `exports`, `export-assets`, `avatars`) — orphaned files will remain in object storage. I'll note this; if you want them purged too, say so and I'll add a storage cleanup step (requires an edge function or manual deletion since SQL can't reach the storage API directly, but `storage.objects` rows can be deleted in SQL which detaches them).

## What's preserved
- Your auth user, profile, and `platform_admin` role
- Schema, RLS, functions, triggers, secrets, edge functions — all untouched
- Your team membership? **No** — your old teams are deleted too, so on next login you'll be prompted through onboarding fresh. That matches "clean refresh."

## Approach
Single migration with `DELETE` statements ordered to respect logical dependencies (children → parents). Auth users deleted last via `DELETE FROM auth.users WHERE id <> '<your-id>'` — Supabase cascades clean up auth-internal rows.

```text
data tables → project tables → folders → teams →
profiles (except me) → user_roles (except me) →
auth.users (except me) → storage.objects (optional)
```

## Confirmation
Once you approve the plan, I'll generate the migration. You'll see the full SQL and approve it before it runs. **This is irreversible.**

## Open question
Do you also want me to delete `storage.objects` rows for the `photos`, `exports`, `export-assets`, and `avatars` buckets so the storage UI looks clean too? (Default: yes.)