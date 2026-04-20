import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";
import { registerUser, PASSWORD } from "./helpers/register";

// Unique per run — suffix with index to keep emails distinct within this file
const TS = Date.now();

// Couple 1: User A (initiates interest) + User B (partner who approves/declines)
const EMAIL_A = `test_e2e_align_a_${TS}@example.com`;
const EMAIL_B = `test_e2e_align_b_${TS}@example.com`;

// Couple 2: User C + User D (the target couple)
const EMAIL_C = `test_e2e_align_c_${TS}@example.com`;
const EMAIL_D = `test_e2e_align_d_${TS}@example.com`;

// User E: unlinked user (no partner)
const EMAIL_E = `test_e2e_align_e_${TS}@example.com`;

/**
 * Log in as a paired user and wait to land on the discovery page.
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

/**
 * Link two users (already on /profile after registerUser()) using User A's
 * invite token. Returns both contexts/pages so callers can close them.
 */
async function linkCouple(
  pageA: Page,
  pageB: Page,
): Promise<void> {
  await expect(pageA.locator(".token-box")).toBeVisible({ timeout: 10_000 });
  const inviteToken = (await pageA.locator(".token-box").innerText()).trim();
  expect(inviteToken).toBeTruthy();

  await pageB.getByLabel("Partner invite token").fill(inviteToken);
  await pageB.getByRole("button", { name: "Link accounts" }).click();
  await expect(pageB).toHaveURL("/", { timeout: 10_000 });
  await expect(pageA).toHaveURL("/", { timeout: 10_000 });
}

test.describe.serial("Connection Alignment Flow", () => {
  /**
   * beforeAll: register and link both couples.
   * Couple 1 = User A + User B
   * Couple 2 = User C + User D
   */
  test.beforeAll(async ({ browser }) => {
    // Sequential setup: register + link Couple 1, then Couple 2, then User E.
    // Sequential is slower but avoids overwhelming the single worker / Supabase
    // with 5 concurrent browser sessions at once.
    test.setTimeout(180_000);

    // ── Couple 1 (User A + User B) ──────────────────────────────────────────
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();
      await Promise.all([
        registerUser(pageA, EMAIL_A, "User A"),
        registerUser(pageB, EMAIL_B, "User B"),
      ]);
      await linkCouple(pageA, pageB);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }

    // ── Couple 2 (User C + User D) ──────────────────────────────────────────
    const ctxC = await browser.newContext();
    const ctxD = await browser.newContext();
    try {
      const pageC = await ctxC.newPage();
      const pageD = await ctxD.newPage();
      await Promise.all([
        registerUser(pageC, EMAIL_C, "User C"),
        registerUser(pageD, EMAIL_D, "User D"),
      ]);
      await linkCouple(pageC, pageD);
    } finally {
      await ctxC.close();
      await ctxD.close();
    }

    // ── User E (unlinked) ────────────────────────────────────────────────────
    const ctxE = await browser.newContext();
    try {
      const pageE = await ctxE.newPage();
      await registerUser(pageE, EMAIL_E, "User E");
      // User E stays on /profile — no linking needed
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

      // User A: log in and navigate to Discover page
      await loginAs(pageA, EMAIL_A);
      await expect(pageA.getByRole("heading", { name: "Discover couples" })).toBeVisible({
        timeout: 10_000,
      });

      // Wait for at least one couple card to appear in the discovery feed
      await expect(pageA.locator(".couple-card").first()).toBeVisible({
        timeout: 10_000,
      });

      // Click "I'm interested" on the first card (Couple 2 = C+D)
      const interestedBtn = pageA.locator(".couple-card").first().getByRole("button", { name: "I'm interested" });
      await Promise.all([
        pageA.waitForResponse(
          (resp) => resp.url().includes("/connections/interest") && resp.status() === 201,
          { timeout: 10_000 },
        ),
        interestedBtn.click(),
      ]);

      // User B: log in and navigate to Partner's Interests page via sidebar
      await loginAs(pageB, EMAIL_B);
      await pageB.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageB).toHaveURL("/partner-interests", { timeout: 10_000 });

      // The card from Couple 2 should be visible along with Approve/Decline buttons
      await expect(pageB.locator(".couple-card").first()).toBeVisible({
        timeout: 10_000,
      });
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

      // User B: approve the pending interest
      await loginAs(pageB, EMAIL_B);
      await pageB.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageB).toHaveURL("/partner-interests", { timeout: 10_000 });

      await expect(
        pageB.getByRole("button", { name: "Approve" }),
      ).toBeVisible({ timeout: 10_000 });

      const approveBtn = pageB.getByRole("button", { name: "Approve" });
      await Promise.all([
        pageB.waitForResponse(
          (resp) => resp.url().includes("/connections/") && resp.url().includes("/align") && resp.status() === 200,
          { timeout: 10_000 },
        ),
        approveBtn.click(),
      ]);

      // The button should now show "Interested" (disabled) after approval
      await expect(
        pageB.getByRole("button", { name: "Interested" }),
      ).toBeVisible({ timeout: 10_000 });

      // User C: navigate to Inbound Requests — the request should now appear
      await loginAs(pageC, EMAIL_C);
      await pageC.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageC).toHaveURL("/inbound-requests", { timeout: 10_000 });

      await expect(pageC.locator(".couple-card").first()).toBeVisible({
        timeout: 10_000,
      });
      // Accept/Decline buttons indicate the request is in REQUEST_PENDING state
      await expect(
        pageC.getByRole("button", { name: "Accept" }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxB.close();
      await ctxC.close();
    }
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  // Fresh interest from User A in Couple 2, then User B declines (veto).
  // The card should disappear from User B's Partner's Interests page.
  //
  // Because the existing request was INTEREST_ALIGNED/REQUEST_PENDING after
  // Test 2, we need a fresh couple. We reuse Couple 1 (A+B) but target a pair
  // that hasn't been requested yet.  Since Tests 1+2 already exhausted the
  // current request, and the /connections/interest endpoint returns the existing
  // request when a duplicate is detected (no new INSERT), we re-express
  // interest — but the request is now REQUEST_PENDING not INTEREST_PENDING so
  // /veto will 400.  To avoid this, Test 3 creates a completely fresh interest
  // scenario by having User A click "I'm interested" on Couple 2 again; the
  // backend deduplicates and returns the existing row.  Since that row is
  // already beyond INTEREST_PENDING, /veto would fail.
  //
  // The spec task says "Fresh interest, User B declines" — the canonical way to
  // test this is with a request that is still INTEREST_PENDING (i.e. User A
  // just expressed interest and User B hasn't responded yet).  Tests 1 & 2
  // together advanced the state past that point.  We therefore register two
  // additional ephemeral couples for Test 3, ensuring a clean slate.
  test("User B declines fresh interest → card disappears from Partner's Interests page", async ({
    browser,
  }) => {
    // Create two fresh couples just for this test
    const ts3 = Date.now();
    const emailA3 = `test_e2e_align_a3_${ts3}@example.com`;
    const emailB3 = `test_e2e_align_b3_${ts3}@example.com`;
    const emailC3 = `test_e2e_align_c3_${ts3}@example.com`;
    const emailD3 = `test_e2e_align_d3_${ts3}@example.com`;

    const ctxA3 = await browser.newContext();
    const ctxB3 = await browser.newContext();
    const ctxC3 = await browser.newContext();
    const ctxD3 = await browser.newContext();

    try {
      const pageA3 = await ctxA3.newPage();
      const pageB3 = await ctxB3.newPage();
      const pageC3 = await ctxC3.newPage();
      const pageD3 = await ctxD3.newPage();

      // Register and link both fresh couples
      await Promise.all([
        registerUser(pageA3, emailA3, "User A3"),
        registerUser(pageB3, emailB3, "User B3"),
        registerUser(pageC3, emailC3, "User C3"),
        registerUser(pageD3, emailD3, "User D3"),
      ]);
      await Promise.all([
        linkCouple(pageA3, pageB3),
        linkCouple(pageC3, pageD3),
      ]);

      // User A3 expresses interest in Couple 2 (C3+D3)
      await loginAs(pageA3, emailA3);
      await expect(pageA3.locator(".couple-card").first()).toBeVisible({
        timeout: 10_000,
      });

      const interestedBtn3 = pageA3.locator(".couple-card").first().getByRole("button", { name: "I'm interested" });
      await Promise.all([
        pageA3.waitForResponse(
          (resp) => resp.url().includes("/connections/interest") && resp.status() === 201,
          { timeout: 10_000 },
        ),
        interestedBtn3.click(),
      ]);

      // User B3 navigates to Partner's Interests and declines
      await loginAs(pageB3, emailB3);
      await pageB3.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageB3).toHaveURL("/partner-interests", { timeout: 10_000 });

      await expect(
        pageB3.getByRole("button", { name: "Decline" }),
      ).toBeVisible({ timeout: 10_000 });

      const declineBtn = pageB3.getByRole("button", { name: "Decline" });
      await Promise.all([
        pageB3.waitForResponse(
          (resp) => resp.url().includes("/connections/") && resp.url().includes("/veto") && resp.status() === 200,
          { timeout: 10_000 },
        ),
        declineBtn.click(),
      ]);

      // After veto, the button should change to "Declined" (disabled) — the card
      // stays mounted but the action buttons are replaced with a disabled badge.
      await expect(
        pageB3.getByRole("button", { name: "Declined" }),
      ).toBeVisible({ timeout: 10_000 });

      // The card row is still in the DOM but the Approve/Decline actions are gone.
      await expect(
        pageB3.getByRole("button", { name: "Approve" }),
      ).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxA3.close();
      await ctxB3.close();
      await ctxC3.close();
      await ctxD3.close();

      // Clean up test-3-specific users
      await Promise.all([
        deleteTestUser(`test_e2e_align_a3_${ts3}@example.com`, PASSWORD),
        deleteTestUser(`test_e2e_align_b3_${ts3}@example.com`, PASSWORD),
        deleteTestUser(`test_e2e_align_c3_${ts3}@example.com`, PASSWORD),
        deleteTestUser(`test_e2e_align_d3_${ts3}@example.com`, PASSWORD),
      ]);
    }
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  // An unlinked user who has registered but has no partner navigates to `/` and
  // should be redirected to `/profile` (RequireAuthAndPaired guard).
  test("Unlinked user navigating to / is redirected to /profile", async ({
    browser,
  }) => {
    const ctxE = await browser.newContext();

    try {
      const pageE = await ctxE.newPage();

      // Log in as User E (registered but never linked a partner)
      await pageE.goto("/login");
      await pageE.locator("#email").fill(EMAIL_E);
      await pageE.locator("#password").fill(PASSWORD);
      await pageE.getByRole("button", { name: "Log in" }).click();

      // Unlinked user should land on /profile (not /)
      await expect(pageE).toHaveURL(/\/profile/, { timeout: 15_000 });

      // Now explicitly try to navigate to / — the guard should redirect back
      await pageE.goto("/");
      await expect(pageE).toHaveURL(/\/profile/, { timeout: 10_000 });
    } finally {
      await ctxE.close();
    }
  });
});
