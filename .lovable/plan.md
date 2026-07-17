## Confirmed findings

- The invite is valid and still pending in the database.
- The app has a working `/invite/:token` route.
- The email builds its invite URL from `APP_URL`, which currently resolves to the legacy `buildslides.com` domain; its fallback, favicon, and footer are also hardcoded to that domain.
- The canonical `buildfolder.com/invite/...` path correctly reaches the sign-in flow.
- Email/password sign-in retains the invite return path, but Google sign-in and email-confirmation signup currently redirect to `/projects`, dropping the invite token before it can be accepted.

## Implementation

1. Update the invite email to use `https://buildfolder.com` for:
   - The **Accept invite** button.
   - The visible fallback invite URL.
   - The footer domain/link.
   - The email logo/favicon asset.
2. Stop deriving invite links from the legacy `APP_URL` value; use the canonical BuildFolder origin for all invite emails while retaining legacy domains in the CORS allow-list.
3. Preserve `/invite/{token}` through every authentication route:
   - Email/password sign-in.
   - New-account email confirmation.
   - Google sign-in and callback.
4. Deploy the updated invite email function.
5. Validate the pending invite end to end on `buildfolder.com`: open email link, authenticate, return to the invite route, accept membership, and reach the project.