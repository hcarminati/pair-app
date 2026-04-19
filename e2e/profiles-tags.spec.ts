import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";
import { registerUser, PASSWORD } from "./helpers/register";

const TS = Date.now();
const EMAIL_A = `test_e2e_profile_a_${TS}@example.com`;
const EMAIL_B = `test_e2e_profile_b_${TS}@example.com`;

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

/** Navigate to /profile via the sidebar link (SPA navigation, no page reload). */
async function goToProfile(page: Page): Promise<void> {
  await page.getByRole("link", { name: "My Profile" }).click();
  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("button", { name: "Save profile" })).toBeVisible({
    timeout: 5_000,
  });
}

test.describe.serial("Profiles and Tags", () => {
  test.beforeAll(async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await registerUser(pageA, EMAIL_A, "User A");
      await registerUser(pageB, EMAIL_B, "User B");

      await expect(pageA.locator(".token-box")).toBeVisible({
        timeout: 10_000,
      });
      const inviteToken = (
        await pageA.locator(".token-box").innerText()
      ).trim();

      await pageB.getByLabel("Partner invite token").fill(inviteToken);
      await pageB.getByRole("button", { name: "Link accounts" }).click();
      await expect(pageB).toHaveURL("/", { timeout: 10_000 });

      await expect(pageA).toHaveURL("/", { timeout: 10_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteTestUser(EMAIL_A, PASSWORD),
      deleteTestUser(EMAIL_B, PASSWORD),
    ]);
  });

  test("user edits display_name, about_me, and location and sees updated values", async ({
    page,
  }) => {
    await loginAs(page, EMAIL_A);
    await goToProfile(page);

    await page.locator("#displayName").fill("Updated User A");
    await page.locator("#aboutMe").fill("I love hiking and exploring.");
    await page.locator("#profileLocation").fill("Denver, CO");

    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved successfully.")).toBeVisible();

    // Switch to another tab and back — unmount/remount triggers a fresh DB fetch
    await page.getByRole("button", { name: "Couple preview" }).click();
    await expect(page.locator("#aboutUs")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "My profile" }).click();
    await expect(
      page.getByRole("button", { name: "Save profile" }),
    ).toBeVisible({
      timeout: 5_000,
    });

    await expect(page.locator("#displayName")).toHaveValue("Updated User A");
    await expect(page.locator("#aboutMe")).toHaveValue(
      "I love hiking and exploring.",
    );
    await expect(page.locator("#profileLocation")).toHaveValue("Denver, CO");
  });

  test("user adds tags including a custom tag and sees them as chips", async ({
    page,
  }) => {
    await loginAs(page, EMAIL_A);
    await goToProfile(page);

    // Wait for tag buttons to render
    await expect(page.getByRole("button", { name: "hiking" })).toBeVisible();

    await page.getByRole("button", { name: "board games" }).click();
    await page.getByRole("button", { name: "cooking" }).click();

    await page
      .locator("input[placeholder='Add custom tag']")
      .fill("mountainbiking");
    await page.getByRole("button", { name: "Add" }).click();

    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved successfully.")).toBeVisible();

    // Switch tabs to trigger a fresh DB fetch on remount
    await page.getByRole("button", { name: "Couple preview" }).click();
    await expect(page.locator("#aboutUs")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "My profile" }).click();
    await expect(
      page.getByRole("button", { name: "Save profile" }),
    ).toBeVisible({
      timeout: 5_000,
    });

    // hiking (registration) + board games + cooking + mountainbiking = 4 selected
    await expect(page.locator("button.tag--selected")).toHaveCount(4);
    await expect(
      page.locator("button.tag--selected", { hasText: "mountainbiking" }),
    ).toBeVisible();
  });

  test("user edits about_us and couple location and they persist", async ({
    page,
  }) => {
    await loginAs(page, EMAIL_A);
    await goToProfile(page);

    await page.getByRole("button", { name: "Couple preview" }).click();
    await expect(page.locator("#aboutUs")).toBeVisible({ timeout: 5_000 });

    await page.locator("#aboutUs").fill("We love outdoor adventures.");
    await page.locator("#coupleLocation").fill("Portland, OR");

    await page.getByRole("button", { name: "Save couple profile" }).click();
    await expect(
      page.getByText("Couple profile saved successfully."),
    ).toBeVisible();

    // Switch to My profile tab and back — CouplePreviewTab remounts and re-fetches
    await page.getByRole("button", { name: "My profile" }).click();
    await expect(
      page.getByRole("button", { name: "Save profile" }),
    ).toBeVisible({
      timeout: 5_000,
    });
    await page.getByRole("button", { name: "Couple preview" }).click();
    await expect(page.locator("#aboutUs")).toBeVisible({ timeout: 5_000 });

    // Edit form pre-populates from the fresh DB fetch
    await expect(page.locator("#aboutUs")).toHaveValue(
      "We love outdoor adventures.",
    );
    await expect(page.locator("#coupleLocation")).toHaveValue("Portland, OR");

    // Preview card at the top of the tab also reflects the saved values
    await expect(
      page
        .locator(".couple-card--static")
        .getByText("We love outdoor adventures."),
    ).toBeVisible();
    await expect(
      page.locator(".couple-card--static .discovery-subtitle").first(),
    ).toHaveText("Portland, OR");
  });

  test("couple preview tab shows aggregated partner data", async ({ page }) => {
    await loginAs(page, EMAIL_A);
    await goToProfile(page);

    await page.getByRole("button", { name: "Couple preview" }).click();
    await expect(page.locator("#aboutUs")).toBeVisible({ timeout: 5_000 });

    // Preview card heading shows both partners (User A's name updated in test 1)
    await expect(page.locator(".couple-card--static h2")).toContainText(
      "Updated User A",
    );
    await expect(page.locator(".couple-card--static h2")).toContainText(
      "User B",
    );

    // Couple fields saved in test 3 appear in the preview card
    await expect(
      page
        .locator(".couple-card--static")
        .getByText("We love outdoor adventures."),
    ).toBeVisible();

    // User A's about_me (set in test 1) appears in their individual partner card
    await expect(
      page
        .locator(".couple-card--static")
        .getByText("I love hiking and exploring."),
    ).toBeVisible();

    // Tags render as pills (at minimum the shared "hiking" tag)
    await expect(
      page.locator(".couple-card--static span.pill.pill--sm").first(),
    ).toBeVisible();
  });
});
