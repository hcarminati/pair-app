import { test, expect } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";

// Unique email per run to avoid conflicts across test runs
const TEARDOWN_EMAIL = `test_e2e_auth_${Date.now()}@example.com`;
const TEARDOWN_PASSWORD = "Password123!";

// Pre-seeded existing user for login tests — set via env or fall back
const EXISTING_EMAIL = process.env.TEST_USER_EMAIL;
const EXISTING_PASSWORD = process.env.TEST_USER_PASSWORD;

test.describe("Auth Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Each test starts from a clean unauthenticated state
    await page.goto("/login");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.locator("h1")).toContainText("Log in");
  });

  test.afterAll(async () => {
    await deleteTestUser(TEARDOWN_EMAIL, TEARDOWN_PASSWORD);
  });

  test("registers a new user through all 3 steps", async ({ page }) => {
    await page.goto("/register");

    // Step 1: create account
    await page.locator("#displayName").fill("Test Auth User");
    await page.locator("#email").fill(TEARDOWN_EMAIL);
    await page.locator("#password").fill(TEARDOWN_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // Step 2: add interests (timeout covers the registration API round-trip)
    await expect(page).toHaveURL(/\/register\/interests/, { timeout: 15_000 });
    await page.getByRole("button", { name: "hiking" }).click();
    await page.getByRole("button", { name: "cooking" }).click();
    await page.getByRole("button", { name: "Save & continue" }).click();

    // Step 3: profile page — "Link partner" tab visible for unpaired user
    await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: "Link partner" }),
    ).toBeVisible();
  });

  test("logs in with valid credentials", async ({ page }) => {
    test.skip(!EXISTING_EMAIL || !EXISTING_PASSWORD, "TEST_USER_EMAIL / TEST_USER_PASSWORD not set");

    await page.locator("#email").fill(EXISTING_EMAIL!);
    await page.locator("#password").fill(EXISTING_PASSWORD!);
    await page.getByRole("button", { name: "Log in" }).click();

    // Unpaired user lands on /profile; paired user lands on /
    await expect(page).toHaveURL(/\/(profile)?$/, { timeout: 15_000 });
  });

  test("shows error with invalid credentials", async ({ page }) => {
    await page.locator("#email").fill(TEARDOWN_EMAIL);
    await page.locator("#password").fill("WrongPassword123!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user visiting / redirects to /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
