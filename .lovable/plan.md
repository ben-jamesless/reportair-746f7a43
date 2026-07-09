## Session timeout policy: 12h idle / 7d absolute

Add a two-layer session policy to Build Folder:
- **Idle timeout:** 12 hours of no activity → sign out
- **Absolute timeout:** 7 days since sign-in → sign out regardless of activity

### Behaviour
- Any user interaction (mouse, keyboard, touch, scroll, route change) resets the idle timer.
- 2 minutes before idle logout, show a small toast: "You'll be signed out soon due to inactivity" with a "Stay signed in" button that resets the timer.
- On idle or absolute expiry: call `supabase.auth.signOut()`, redirect to `/auth?reason=timeout`, and show a friendly message on the auth page ("Signed out for your security").
- Share pages (`/s/...`), the marketing site, and other public routes are exempt — the timer only runs when a user is authenticated.
- Timer state is shared across tabs via a `localStorage` "last activity" timestamp so activity in one tab keeps the others alive, and sign-out in one tab signs out the others.

### Backend enforcement
- Set Supabase Auth JWT expiry to 12 hours (matches idle window; refresh token still allows silent renewal within the 7-day absolute cap).
- Set refresh token reuse interval / inactivity to 7 days so a truly idle session can't be silently refreshed past the absolute cap.
- These are configured via the `configure_auth` capability; no schema changes.

### Files to add / change
- **New:** `src/hooks/useSessionTimeout.ts` — tracks last-activity timestamp in `localStorage`, records sign-in time, runs the idle + absolute checks on an interval, fires the warning toast, and calls `signOut()` on expiry.
- **New:** `src/components/SessionTimeoutProvider.tsx` — thin wrapper that mounts the hook once for any authenticated route.
- **Edit:** `src/App.tsx` (or wherever the auth-gated layout lives) — mount `SessionTimeoutProvider` inside the authenticated tree so it doesn't run on public share/marketing pages.
- **Edit:** `src/pages/Auth.tsx` — read `?reason=timeout` and show a small "Signed out for your security" banner.
- **Backend:** update Supabase auth settings (JWT expiry 12h, refresh token absolute lifetime 7d).

### Edge cases
- User closes laptop for 3 hours then reopens: idle timer catches up on next tick and signs out if >12h passed.
- User leaves a tab open exactly at hour 12: warning toast fires at 11h58m; if ignored, sign-out at 12h00m.
- Multiple tabs: shared `localStorage` key means the most recent activity in any tab wins.
- Share links and unauthenticated visitors: unaffected — timer never mounts.
- Password reset / magic link flows: absolute timer starts at that new sign-in, as expected.

### Out of scope for this change
- Per-role timeouts (e.g. stricter for admins) — can add later if needed.
- Server-side "kill switch" to force-logout a specific user — separate feature.
- Remember-me toggle to opt into longer sessions.

After implementation I'll verify by simulating an expired `last activity` timestamp and confirming the sign-out + redirect + banner all fire cleanly.