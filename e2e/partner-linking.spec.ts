import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";

const PASSWORD = "Password123!";
// Unique per run — suffix with index to keep emails distinct within this file
const TS = Date.now();
const EMAIL_A = `test_e2e_link_a_${TS}@example.com`;
const EMAIL_B = `test_e2e_link_b_${TS}@example.com`;

/** Register a new user through all 3 onboarding steps and land on /profile. */
async function registerUser(
  page: Page,
  email: string,
  displayName: string,
): Promise<void> {
  await page.goto("/register");
  await page.locator("#displayName").fill(displayName);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/register\/interests/);
  await page.getByRole("button", { name: "hiking" }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();

  await expect(page).toHaveURL(/\/profile/);
}

test.describe("Partner Linking", () => {
  test.afterAll(async () => {
    await Promise.all([
      deleteTestUser(EMAIL_A, PASSWORD),
      deleteTestUser(EMAIL_B, PASSWORD),
    ]);
  });

  test("two users can link via invite token and both reach discovery", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // ── User A registers and arrives at the Link partner tab ──────────────
      await registerUser(pageA, EMAIL_A, "User A");

      // The "Link partner" tab is active by default for unpaired users.
      // Wait for the invite token to be generated and shown in .token-box.
      await expect(pageA.locator(".token-box")).toBeVisible({ timeout: 10_000 });
      const inviteToken = (await pageA.locator(".token-box").innerText()).trim();
      expect(inviteToken).toBeTruthy();

      // ── User B registers and enters User A's token ────────────────────────
      await registerUser(pageB, EMAIL_B, "User B");

      // "Link partner" tab is already active; fill in the partner token field.
      await pageB.getByLabel("Partner invite token").fill(inviteToken);
      await pageB.getByRole("button", { name: "Link accounts" }).click();

      // User B should be redirected to the discovery page immediately.
      await expect(pageB).toHaveURL("/", { timeout: 10_000 });

      // User A's ProfilePage polls /auth/me every 3 s and navigates to / when
      // it detects a partnerId. Wait up to 10 s for that redirect.
      await expect(pageA).toHaveURL("/", { timeout: 10_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
