import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end tests against the deployed preview.
 *
 * Required env vars (set in CI or a local `.env.e2e`):
 *   E2E_BASE_URL                — e.g. https://id-preview--<id>.lovable.app
 *   SUPABASE_URL                — your Lovable Cloud project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — used to pre-create + auto-confirm the test user
 *
 * Run:
 *   npx playwright install chromium     # one-time, downloads browser binary
 *   npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
