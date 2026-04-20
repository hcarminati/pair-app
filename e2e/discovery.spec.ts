import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";
import { linkCouple } from "./helpers/couple";
import { registerUser, PASSWORD } from "./helpers/register";

const TS = Date.now();
const EMAIL_A = `test_e2e_disc_a_${TS}@example.com`;
const EMAIL_B = `test_e2e_disc_b_${TS}@example.com`;
const EMAIL_C = `test_e2e_disc_c_${TS}@example.com`;
const EMAIL_D = `test_e2e_disc_d_${TS}@example.com`;
const EMAIL_E = `test_e2e_disc_e_${TS}@example.com`;
const EMAIL_F = `test_e2e_disc_f_${TS}@example.com`;
const EMAIL_UNLINKED = `test_e2e_disc_u_${TS}@example.com`;

const NAME_A = "Disc User A";
const NAME_B = "Disc User B";
const NAME_C = "Target User C";
const NAME_D = "Target User D";
const NAME_E = "Target User E";
const NAME_F = "Target User F";

const ABOUT_US = "We love adventures";
const LOCATION = "Portland, OR";

/**
 * Sign in as an already-paired user and wait to land on the discovery page.
 * All subsequent navigation must use SPA link/button clicks — page.goto() causes
 * a full page reload that resets the in-memory authStore (token + isPaired).
 */
async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/", { timeout: 10_000 });
}

test.describe.serial("Discovery Feed", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);

    // Couple A+B: requesting couple — hiking only (registerUser default)
    await linkCouple(browser, EMAIL_A, NAME_A, EMAIL_B, NAME_B);

    // Couple C+D: target couple 1 — hiking + cooking, with about_us and location
    await linkCouple(browser, EMAIL_C, NAME_C, EMAIL_D, NAME_D);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, EMAIL_C);
      await page.getByRole("link", { name: "My Profile" }).click();
      await expect(page).toHaveURL("/profile");
      await expect(
        page.getByRole("button", { name: "Save profile" }),
      ).toBeVisible({ timeout: 5_000 });

      await page.getByRole("button", { name: "cooking" }).click();
      const profileSaveResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/profiles/me") &&
          resp.request().method() === "PATCH",
        { timeout: 10_000 },
      );
      await page.getByRole("button", { name: "Save profile" }).click();
      expect((await profileSaveResp).status()).toBe(200);

      const coupleDataLoaded = page.waitForResponse(
        (resp) => resp.url().includes("/pairs/me"),
        { timeout: 10_000 },
      );
      await page.getByRole("button", { name: "Couple preview" }).click();
      await expect(page.locator("#aboutUs")).toBeVisible({ timeout: 5_000 });
      expect((await coupleDataLoaded).status()).toBe(200);

      await page.locator("#aboutUs").fill(ABOUT_US);
      await page.locator("#coupleLocation").fill(LOCATION);
      const coupleSaveResp = page.waitForResponse(
        (resp) =>
          resp.url().includes("/couples/me") &&
          resp.request().method() === "PATCH",
        { timeout: 10_000 },
      );
      await page.getByRole("button", { name: "Save couple profile" }).click();
      expect((await coupleSaveResp).status()).toBe(200);
    } finally {
      await ctx.close();
    }

    // Couple E+F: target couple 2 — hiking only, no extra data
    await linkCouple(browser, EMAIL_E, NAME_E, EMAIL_F, NAME_F);
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteTestUser(EMAIL_A, PASSWORD),
      deleteTestUser(EMAIL_B, PASSWORD),
      deleteTestUser(EMAIL_C, PASSWORD),
      deleteTestUser(EMAIL_D, PASSWORD),
      deleteTestUser(EMAIL_E, PASSWORD),
      deleteTestUser(EMAIL_F, PASSWORD),
    ]);
  });

  test("linked couple sees other couple cards with names, about_us, location, tags, and X tags in common badge", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, EMAIL_A);

      const cardC = page
        .locator(".couple-grid .couple-card")
        .filter({ hasText: NAME_C });
      await expect(cardC).toBeVisible({ timeout: 10_000 });

      // Both partner names on the card
      await expect(cardC).toContainText(NAME_D);

      // "X in common" badge (shared hiking tag)
      await expect(cardC).toContainText("in common");

      // At least one interest tag visible on the card
      await expect(
        cardC.locator(".interest-pills .pill--sm").first(),
      ).toBeVisible();

      // Open modal to verify about_us and location
      await cardC.locator(".couple-card-header").click();
      await expect(page.locator(".discovery-modal")).toBeVisible({
        timeout: 5_000,
      });

      // Location in modal header subtitle
      await expect(
        page.locator(".discovery-modal-header .discovery-subtitle"),
      ).toContainText(LOCATION);

      // about_us in the "About us" section
      await expect(
        page
          .locator(".discovery-modal-section")
          .filter({ hasText: "About us" })
          .locator(".text-muted"),
      ).toContainText(ABOUT_US);

      // Interests in common counter
      await expect(page.locator(".discovery-modal-common")).toContainText(
        "in common",
      );
    } finally {
      await ctx.close();
    }
  });

  test("tag filter narrows results to matching couples; clearing filter restores full feed", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, EMAIL_A);

      // Wait for feed to load
      await expect(
        page.locator(".couple-grid .couple-card").first(),
      ).toBeVisible({ timeout: 10_000 });

      // Apply cooking filter — C+D has cooking, E+F does not
      await page.getByRole("button", { name: "cooking" }).click();
      await expect(
        page.locator(".couple-grid .couple-card").filter({ hasText: NAME_C }),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.locator(".couple-grid .couple-card").filter({ hasText: NAME_F }),
      ).not.toBeVisible();

      // Deselect filter — E+F reappears
      await page.getByRole("button", { name: "cooking" }).click();
      await expect(
        page.locator(".couple-grid .couple-card").filter({ hasText: NAME_F }),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test("requesting couple's own profile does not appear in discovery results", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, EMAIL_A);

      // Wait for feed to load
      await expect(
        page.locator(".couple-grid .couple-card").first(),
      ).toBeVisible({ timeout: 10_000 });

      // Own couple (A+B) must not appear in the results
      await expect(
        page.locator(".couple-grid .couple-card").filter({ hasText: NAME_A }),
      ).not.toBeVisible({ timeout: 5_000 });
      await expect(
        page.locator(".couple-grid .couple-card").filter({ hasText: NAME_B }),
      ).not.toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });
});

test.describe("Discovery Feed - Access Control", () => {
  test.afterAll(async () => {
    await deleteTestUser(EMAIL_UNLINKED, PASSWORD);
  });

  test("unlinked registered user is redirected to profile instead of discovery", async ({
    page,
  }) => {
    await registerUser(page, EMAIL_UNLINKED, "Unlinked Disc User");

    // RequireAuthAndPaired redirects logged-in but unlinked users to /profile
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByRole("heading", { name: "Discover couples" }),
    ).not.toBeVisible();
  });
});
