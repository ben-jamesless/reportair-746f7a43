## Goal
Make Google login practical for the majority of users, including users on restrictive VPNs where `oauth.lovable.app` cannot be reached.

## Key finding
The app already uses the Lovable Cloud Google OAuth flow correctly via `lovable.auth.signInWithOAuth("google")`. The failure is not an app-code auth bug: restrictive VPN/DNS filtering is blocking the OAuth broker host before the login flow can complete.

## Plan
1. **Keep email/password as a guaranteed fallback**
   - Preserve the existing email/password sign-in and signup flow so VPN users are not locked out.

2. **Improve Google login failure handling**
   - Update the Google sign-in handler to detect network/broker failures and show a clear, actionable message instead of a generic error.
   - Message direction: “Google sign-in could not be reached. If you’re using a VPN or privacy DNS, allow `oauth.lovable.app`, switch VPN server, or use email sign-in.”

3. **Add a lightweight fallback prompt near Google login**
   - Add concise helper text near the Google button only when relevant, not as a permanent warning-heavy banner.
   - Keep the primary UX Google-first, with email still available.

4. **Optional stronger fix outside code**
   - If you want the best possible mitigation, configure your own branded Google OAuth credentials in Lovable Cloud. This improves trust/branding, but the managed broker may still be part of the hosted OAuth routing, so it may not fully eliminate VPN DNS blocking.
   - If VPN-blocked OAuth must be fully avoided, the only reliable product strategy is to maintain email/password fallback.

## Technical details
- File to update: `src/pages/Auth.tsx`.
- Do not edit the auto-generated Lovable integration file.
- Do not change database/auth tables or edge functions.
- No service worker/PWA OAuth caching issue was found in the current project search.