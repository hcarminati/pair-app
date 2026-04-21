import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";
import { linkCouple } from "./helpers/couple";
import { registerUser, PASSWORD } from "./helpers/register";

const TS = Date.now();

// Couple 1 (A+B): requesting couple for Tests 1 & 2
const EMAIL_A = `test_e2e_align_a_${TS}@example.com`;
const EMAIL_B = `test_e2e_align_b_${TS}@example.com`;

// Couple 2 (C+D): target couple for Tests 1 & 2
const EMAIL_C = `test_e2e_align_c_${TS}@example.com`;
const EMAIL_D = `test_e2e_align_d_${TS}@example.com`;

// User E: unlinked user for Test 4
const EMAIL_E = `test_e2e_align_e_${TS}@example.com`;

// Couple 3 (F+G): requesting couple for Test 3 (veto test — needs clean state)
const EMAIL_F = `test_e2e_align_f_${TS}@example.com`;
const EMAIL_G = `test_e2e_align_g_${TS}@example.com`;

// Couple 4 (H+I): target couple for Test 3
const EMAIL_H = `test_e2e_align_h_${TS}@example.com`;
const EMAIL_I = `test_e2e_align_i_${TS}@example.com`;

/**
 * Sign in as an already-paired user and wait to land on the discovery page.
 * After login we must NEVER call page.goto() — only sidebar clicks — to avoid
 * resetting the in-memory authStore (token + isPaired flag).
 */
async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

test.describe.serial("Connection Alignment Flow", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);

    // Register and link all couples sequentially to avoid overwhelming the server.
    await linkCouple(browser, EMAIL_A, "User A", EMAIL_B, "User B");
    await linkCouple(browser, EMAIL_C, "User C", EMAIL_D, "User D");
    await linkCouple(browser, EMAIL_F, "User F", EMAIL_G, "User G");
    await linkCouple(browser, EMAIL_H, "User H", EMAIL_I, "User I");

    // Register unlinked User E (stays on /profile — no linking needed)
    const ctxE = await browser.newContext();
    try {
      const pageE = await ctxE.newPage();
      await registerUser(pageE, EMAIL_E, "User E");
    } finally {
      await ctxE.close();
    }
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteTestUser(EMAIL_A, PASSWORD),
      deleteTestUser(EMAIL_B, PASSWORD),
      deleteTestUser(EMAIL_C, PASSWORD),
      deleteTestUser(EMAIL_D, PASSWORD),
      deleteTestUser(EMAIL_E, PASSWORD),
      deleteTestUser(EMAIL_F, PASSWORD),
      deleteTestUser(EMAIL_G, PASSWORD),
      deleteTestUser(EMAIL_H, PASSWORD),
      deleteTestUser(EMAIL_I, PASSWORD),
    ]);
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────
  // User A expresses interest in Couple 2 from the discovery page.
  // User B (partner) should then see Couple 2's card on the Partner's Interests page.
  test("User A expresses interest → User B sees card on Partner's Interests page", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      await loginAs(pageA, EMAIL_A);
      await expect(
        pageA.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });

      // Target Couple 2 (C+D) specifically — the feed now contains multiple couples
      const cardCD = pageA
        .locator(".couple-grid .couple-card")
        .filter({ hasText: "User C" });
      await expect(cardCD).toBeVisible({ timeout: 10_000 });

      const interestedBtn = cardCD.getByRole("button", { name: "I'm interested" });
      const interestResp = pageA.waitForResponse(
        (resp) => resp.url().includes("/connections/interest"),
        { timeout: 10_000 },
      );
      await interestedBtn.click();
      expect((await interestResp).status()).toBe(201);

      await loginAs(pageB, EMAIL_B);
      await pageB.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageB).toHaveURL("/partner-interests", { timeout: 10_000 });

      await expect(
        pageB.locator(".couple-grid .couple-card").first(),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        pageB.getByRole("button", { name: "Approve" }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        pageB.getByRole("button", { name: "Decline" }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  // User B approves the interest → User C (in Couple 2) sees the request on
  // the Inbound Requests page.
  test("User B approves interest → User C sees card on Inbound Requests page", async ({
    browser,
  }) => {
    const ctxB = await browser.newContext();
    const ctxC = await browser.newContext();

    try {
      const pageB = await ctxB.newPage();
      const pageC = await ctxC.newPage();

      await loginAs(pageB, EMAIL_B);
      await pageB.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageB).toHaveURL("/partner-interests", { timeout: 10_000 });

      await expect(
        pageB.getByRole("button", { name: "Approve" }),
      ).toBeVisible({ timeout: 10_000 });

      const alignResp = pageB.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") && resp.url().includes("/align"),
        { timeout: 10_000 },
      );
      await pageB.getByRole("button", { name: "Approve" }).click();
      expect((await alignResp).status()).toBe(200);

      // Button should now show "Interested" (disabled) after approval
      await expect(
        pageB.getByRole("button", { name: "Interested" }),
      ).toBeVisible({ timeout: 10_000 });

      // User C: land on discover first (initializes the app and triggers the
      // INTEREST_ALIGNED → REQUEST_PENDING auto-transition on the inbound fetch),
      // then navigate to Inbound Requests via sidebar.
      await loginAs(pageC, EMAIL_C);
      await expect(
        pageC.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const inboundResp = pageC.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000 },
      );
      await pageC.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageC).toHaveURL("/inbound-requests", { timeout: 10_000 });
      expect((await inboundResp).status()).toBe(200);

      await expect(
        pageC.locator(".couple-grid .couple-card").first(),
      ).toBeVisible({ timeout: 10_000 });
      // Accept/Decline buttons confirm the request is in REQUEST_PENDING state
      await expect(
        pageC.getByRole("button", { name: "Accept" }),
      ).toBeVisible({ timeout: 10_000 });

      // Also verify User D (Couple 2's other partner) sees the same inbound request
      const ctxD = await browser.newContext();
      try {
        const pageD = await ctxD.newPage();
        await loginAs(pageD, EMAIL_D);
        await expect(
          pageD.getByRole("heading", { name: "Discover couples" }),
        ).toBeVisible({ timeout: 10_000 });
        const inboundRespD = pageD.waitForResponse(
          (resp) => resp.url().includes("/connections/inbound"),
          { timeout: 10_000 },
        );
        await pageD.getByRole("link", { name: "Inbound Requests" }).click();
        await expect(pageD).toHaveURL("/inbound-requests", { timeout: 10_000 });
        expect((await inboundRespD).status()).toBe(200);
        await expect(
          pageD.locator(".couple-grid .couple-card").first(),
        ).toBeVisible({ timeout: 10_000 });
        await expect(
          pageD.getByRole("button", { name: "Accept" }),
        ).toBeVisible({ timeout: 10_000 });
      } finally {
        await ctxD.close();
      }
    } finally {
      await ctxB.close();
      await ctxC.close();
    }
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  // Fresh interest from Couple 3 (F+G) in Couple 4 (H+I), then User G (partner)
  // declines (veto). The Approve/Decline buttons should be replaced with a
  // disabled "Declined" badge. Uses pre-registered couples to keep the test body
  // clean (Tests 1+2 already advanced Couples 1+2 past INTEREST_PENDING).
  test("User G declines fresh interest → card shows Declined on Partner's Interests page", async ({
    browser,
  }) => {
    const ctxF = await browser.newContext();
    const ctxG = await browser.newContext();

    try {
      const pageF = await ctxF.newPage();
      const pageG = await ctxG.newPage();

      // User F expresses interest in Couple 4 (H+I) specifically
      await loginAs(pageF, EMAIL_F);
      const cardHI = pageF
        .locator(".couple-grid .couple-card")
        .filter({ hasText: "User H" });
      await expect(cardHI).toBeVisible({ timeout: 10_000 });

      const interestedBtn = cardHI.getByRole("button", { name: "I'm interested" });
      const interestResp3 = pageF.waitForResponse(
        (resp) => resp.url().includes("/connections/interest"),
        { timeout: 10_000 },
      );
      await interestedBtn.click();
      expect((await interestResp3).status()).toBe(201);

      // User G navigates to Partner's Interests and declines
      await loginAs(pageG, EMAIL_G);
      await pageG.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageG).toHaveURL("/partner-interests", { timeout: 10_000 });

      await expect(
        pageG.getByRole("button", { name: "Decline" }),
      ).toBeVisible({ timeout: 10_000 });

      const vetoResp = pageG.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") && resp.url().includes("/veto"),
        { timeout: 10_000 },
      );
      await pageG.getByRole("button", { name: "Decline" }).click();
      expect((await vetoResp).status()).toBe(200);

      // After veto, action buttons are replaced with a disabled "Declined" badge
      await expect(
        pageG.getByRole("button", { name: "Declined" }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        pageG.getByRole("button", { name: "Approve" }),
      ).not.toBeVisible();
    } finally {
      await ctxF.close();
      await ctxG.close();
    }
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  // An unlinked user navigating to / should be redirected to /profile.
  test("Unlinked user navigating to / is redirected to /profile", async ({
    browser,
  }) => {
    const ctxE = await browser.newContext();

    try {
      const pageE = await ctxE.newPage();

      await pageE.goto("/login");
      await pageE.locator("#email").fill(EMAIL_E);
      await pageE.locator("#password").fill(PASSWORD);
      await pageE.getByRole("button", { name: "Log in" }).click();

      // Unlinked user should land on /profile (not /)
      await expect(pageE).toHaveURL(/\/profile/, { timeout: 15_000 });

      // Clicking guarded nav links redirects back to /profile (RequireAuthAndPaired)
      await pageE.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageE).toHaveURL(/\/profile/, { timeout: 10_000 });

      await pageE.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageE).toHaveURL(/\/profile/, { timeout: 10_000 });
    } finally {
      await ctxE.close();
    }
  });
});
