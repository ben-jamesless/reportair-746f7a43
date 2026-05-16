# End-to-end tests

These tests drive the deployed preview with Playwright + Chromium.

## One-time setup

```bash
npx playwright install chromium
```

## Required env vars

| Var | Purpose |
| --- | --- |
| `E2E_BASE_URL` | URL of the running app, e.g. `https://id-preview--<project-id>.lovable.app` |
| `SUPABASE_URL` | Lovable Cloud project URL (from `.env` as `VITE_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — used to pre-create + auto-confirm the test user. Never commit this. |

Tests are auto-skipped if any are missing, so it's safe to run them in environments where they're not configured.

## Run

```bash
npm run e2e            # headless
npm run e2e:headed     # watch the browser
npm run e2e:ui         # Playwright UI mode
```

## What's covered

- `onboarding.spec.ts` — signup → onboarding → skip plan → create event happy path.

Each run uses a unique throwaway email (`e2e+<timestamp>@reportair.test`) and deletes the user in `afterAll`.
