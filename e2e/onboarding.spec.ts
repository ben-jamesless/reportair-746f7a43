import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Onboarding happy path:
 *   1. Pre-create + auto-confirm a fresh user via the admin API
 *      (UI signup requires email confirmation, which we cannot
 *      complete inside a test, so we provision the user directly
 *      and then exercise the UI from sign-in onward).
 *   2. Sign in via /auth.
 *   3. Complete the onboarding "name + continue" step.
 *   4. Skip the plan picker (start the free trial).
 *   5. Land on /projects and create a new event.
 *   6. Assert we land on /projects/:id.
 */

const SUPABASE_URL    = process.env.SUPABASE_URL;
const SERVICE_ROLE    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL        = process.env.E2E_BASE_URL;

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE || !BASE_URL,
  "Set E2E_BASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run e2e.",
);

const admin = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

let testEmail = "";
let testUserId = "";
const TEST_PASSWORD = "PlaywrightTest!1234";
const TEST_NAME     = "Playwright Tester";

test.beforeAll(async () => {
  testEmail = `e2e+${Date.now()}@reportair.test`;
  const { data, error } = await admin!.auth.admin.createUser({
    email: testEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TEST_NAME },
  });
  if (error) throw error;
  testUserId = data.user!.id;
});

test.afterAll(async () => {
  if (testUserId && admin) {
    // Cascades through profiles / team_members / teams via FK + triggers.
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
});

test("new user can sign in, onboard, skip plan, and create a project", async ({ page }) => {
  // 1. Sign in
  await page.goto("/auth");
  await page.locator("#email-in").fill(testEmail);
  await page.locator("#pw-in").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // 2. Onboarding — name pre-filled from metadata; just continue.
  await page.waitForURL("**/onboarding", { timeout: 15_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  // 3. Plan picker — skip
  await page.waitForURL("**/plan", { timeout: 15_000 });
  await page.getByRole("button", { name: /Skip for now|Starting trial/ }).click();

  // 4. Projects page
  await page.waitForURL("**/projects", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /New Event/ })).toBeVisible();

  // 5. Create a new event
  await page.getByRole("button", { name: /New Event/ }).first().click();
  await page.locator("#proj-name").fill("Playwright Smoke Event");
  await page.getByRole("button", { name: /Create project/ }).click();

  // 6. We should land on the project detail page.
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/);
});
