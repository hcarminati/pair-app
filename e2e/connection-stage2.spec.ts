import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";
import { linkCouple } from "./helpers/couple";
import { PASSWORD } from "./helpers/register";

const TS = Date.now();

// Couple J+K: requesters for Test 1 (AC2 — both accept)
const EMAIL_J = `test_e2e_s2_j_${TS}@example.com`;
const EMAIL_K = `test_e2e_s2_k_${TS}@example.com`;

// Couple L+M: receivers for Test 1 (AC2)
const EMAIL_L = `test_e2e_s2_l_${TS}@example.com`;
const EMAIL_M = `test_e2e_s2_m_${TS}@example.com`;

// Couple N+O: requesters for Test 2 (AC3 — one declines)
const EMAIL_N = `test_e2e_s2_n_${TS}@example.com`;
const EMAIL_O = `test_e2e_s2_o_${TS}@example.com`;

// Couple P+Q: receivers for Test 2 (AC3)
const EMAIL_P = `test_e2e_s2_p_${TS}@example.com`;
const EMAIL_Q = `test_e2e_s2_q_${TS}@example.com`;

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

test.describe.serial("Connection Stage 2 Flow", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);

    // Register and link all four couples
    await linkCouple(
      browser,
      EMAIL_J,
      "Stage2 User J",
      EMAIL_K,
      "Stage2 User K",
    );
    await linkCouple(
      browser,
      EMAIL_L,
      "Stage2 User L",
      EMAIL_M,
      "Stage2 User M",
    );
    await linkCouple(
      browser,
      EMAIL_N,
      "Stage2 User N",
      EMAIL_O,
      "Stage2 User O",
    );
    await linkCouple(
      browser,
      EMAIL_P,
      "Stage2 User P",
      EMAIL_Q,
      "Stage2 User Q",
    );

    // Advance JK → LM to INTEREST_ALIGNED
    // J expresses interest in LM
    const ctxJ = await browser.newContext();
    try {
      const pageJ = await ctxJ.newPage();
      await loginAs(pageJ, EMAIL_J);
      await expect(
        pageJ.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const cardLM = pageJ
        .locator(".couple-grid .couple-card")
        .filter({ hasText: "Stage2 User L" });
      await expect(cardLM).toBeVisible({ timeout: 10_000 });
      const interestRespJ = pageJ.waitForResponse(
        (resp) => resp.url().includes("/connections/interest"),
        { timeout: 10_000 },
      );
      await cardLM.getByRole("button", { name: "I'm interested" }).click();
      expect((await interestRespJ).status()).toBe(201);
    } finally {
      await ctxJ.close();
    }

    // K approves → INTEREST_ALIGNED
    const ctxK = await browser.newContext();
    try {
      const pageK = await ctxK.newPage();
      await loginAs(pageK, EMAIL_K);
      await expect(
        pageK.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      await pageK.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageK).toHaveURL("/partner-interests", { timeout: 10_000 });
      await expect(pageK.getByRole("button", { name: "Approve" })).toBeVisible({
        timeout: 10_000,
      });
      const alignRespK = pageK.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") && resp.url().includes("/align"),
        { timeout: 10_000 },
      );
      await pageK.getByRole("button", { name: "Approve" }).click();
      expect((await alignRespK).status()).toBe(200);
    } finally {
      await ctxK.close();
    }

    // Advance NO → PQ to INTEREST_ALIGNED
    // N expresses interest in PQ
    const ctxN = await browser.newContext();
    try {
      const pageN = await ctxN.newPage();
      await loginAs(pageN, EMAIL_N);
      await expect(
        pageN.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const cardPQ = pageN
        .locator(".couple-grid .couple-card")
        .filter({ hasText: "Stage2 User P" });
      await expect(cardPQ).toBeVisible({ timeout: 10_000 });
      const interestRespN = pageN.waitForResponse(
        (resp) => resp.url().includes("/connections/interest"),
        { timeout: 10_000 },
      );
      await cardPQ.getByRole("button", { name: "I'm interested" }).click();
      expect((await interestRespN).status()).toBe(201);
    } finally {
      await ctxN.close();
    }

    // O approves → INTEREST_ALIGNED
    const ctxO = await browser.newContext();
    try {
      const pageO = await ctxO.newPage();
      await loginAs(pageO, EMAIL_O);
      await expect(
        pageO.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      await pageO.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageO).toHaveURL("/partner-interests", { timeout: 10_000 });
      await expect(pageO.getByRole("button", { name: "Approve" })).toBeVisible({
        timeout: 10_000,
      });
      const alignRespO = pageO.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") && resp.url().includes("/align"),
        { timeout: 10_000 },
      );
      await pageO.getByRole("button", { name: "Approve" }).click();
      expect((await alignRespO).status()).toBe(200);
    } finally {
      await ctxO.close();
    }
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteTestUser(EMAIL_J, PASSWORD),
      deleteTestUser(EMAIL_K, PASSWORD),
      deleteTestUser(EMAIL_L, PASSWORD),
      deleteTestUser(EMAIL_M, PASSWORD),
      deleteTestUser(EMAIL_N, PASSWORD),
      deleteTestUser(EMAIL_O, PASSWORD),
      deleteTestUser(EMAIL_P, PASSWORD),
      deleteTestUser(EMAIL_Q, PASSWORD),
    ]);
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────
  // Both partners of Couple 2 (L and M) accept the inbound request from
  // Couple 1 (J+K). Status should transition to CONNECTED and the connection
  // should appear on the Connections page for members of both couples.
  test("Both L and M accept → CONNECTED; connection appears for both couples", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ctxL = await browser.newContext();
    const ctxM = await browser.newContext();
    const ctxJ = await browser.newContext();

    try {
      const pageL = await ctxL.newPage();
      const pageM = await ctxM.newPage();
      const pageJ = await ctxJ.newPage();

      // L visits Inbound Requests (first visit auto-transitions INTEREST_ALIGNED → REQUEST_PENDING)
      await loginAs(pageL, EMAIL_L);
      await expect(
        pageL.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const inboundRespL = pageL.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000 },
      );
      await pageL.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageL).toHaveURL("/inbound-requests", { timeout: 10_000 });
      expect((await inboundRespL).status()).toBe(200);
      await expect(pageL.getByRole("button", { name: "Accept" })).toBeVisible({
        timeout: 10_000,
      });

      // L accepts
      const respondRespL = pageL.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") &&
          resp.url().includes("/respond"),
        { timeout: 10_000 },
      );
      await pageL.getByRole("button", { name: "Accept" }).click();
      expect((await respondRespL).status()).toBe(200);
      await expect(
        pageL.getByRole("button", { name: "Waiting for partner" }),
      ).toBeVisible({ timeout: 10_000 });

      // M visits Inbound Requests
      await loginAs(pageM, EMAIL_M);
      await expect(
        pageM.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const inboundRespM = pageM.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000 },
      );
      await pageM.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageM).toHaveURL("/inbound-requests", { timeout: 10_000 });
      expect((await inboundRespM).status()).toBe(200);
      await expect(pageM.getByRole("button", { name: "Accept" })).toBeVisible({
        timeout: 10_000,
      });

      // M accepts → both couple_2 partners accepted → CONNECTED
      const respondRespM = pageM.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") &&
          resp.url().includes("/respond"),
        { timeout: 10_000 },
      );
      await pageM.getByRole("button", { name: "Accept" }).click();
      expect((await respondRespM).status()).toBe(200);
      await expect(
        pageM.getByRole("button", { name: "Connected!" }),
      ).toBeVisible({ timeout: 10_000 });

      // M checks Connections page — J+K couple visible
      const connectedRespM = pageM.waitForResponse(
        (resp) => resp.url().includes("/connections/connected"),
        { timeout: 10_000 },
      );
      await pageM.getByRole("link", { name: "Connections" }).click();
      expect((await connectedRespM).status()).toBe(200);
      await expect(
        pageM.locator(".connection-row").filter({ hasText: "Stage2 User J" }),
      ).toBeVisible({ timeout: 10_000 });

      // L navigates to Connections — J+K couple visible
      const connectedRespL = pageL.waitForResponse(
        (resp) => resp.url().includes("/connections/connected"),
        { timeout: 10_000 },
      );
      await pageL.getByRole("link", { name: "Connections" }).click();
      expect((await connectedRespL).status()).toBe(200);
      await expect(
        pageL.locator(".connection-row").filter({ hasText: "Stage2 User J" }),
      ).toBeVisible({ timeout: 10_000 });

      // J (Couple 1) checks Connections — L+M couple visible
      await loginAs(pageJ, EMAIL_J);
      await expect(
        pageJ.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const connectedRespJ = pageJ.waitForResponse(
        (resp) => resp.url().includes("/connections/connected"),
        { timeout: 10_000 },
      );
      await pageJ.getByRole("link", { name: "Connections" }).click();
      expect((await connectedRespJ).status()).toBe(200);
      await expect(
        pageJ.locator(".connection-row").filter({ hasText: "Stage2 User L" }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxL.close();
      await ctxM.close();
      await ctxJ.close();
    }
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  // One partner of Couple 2 (P) declines the inbound request from Couple 1
  // (N+O). The request should be silently removed from both P's and Q's inbound
  // pages. Couple 1 (N) should see no attribution of who declined.
  test("P declines → request removed from both inbound pages; Couple 1 sees no attribution", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ctxP = await browser.newContext();
    const ctxQ = await browser.newContext();
    const ctxN = await browser.newContext();

    try {
      const pageP = await ctxP.newPage();
      const pageQ = await ctxQ.newPage();
      const pageN = await ctxN.newPage();

      // P visits Inbound Requests (first visit auto-transitions INTEREST_ALIGNED → REQUEST_PENDING)
      await loginAs(pageP, EMAIL_P);
      await expect(
        pageP.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const inboundRespP = pageP.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000 },
      );
      await pageP.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageP).toHaveURL("/inbound-requests", { timeout: 10_000 });
      expect((await inboundRespP).status()).toBe(200);
      await expect(
        pageP
          .locator(".couple-grid .couple-card")
          .filter({ hasText: "Stage2 User N" }),
      ).toBeVisible({ timeout: 10_000 });

      // Q visits Inbound Requests — proves Q also has access to the N+O card
      // before anyone declines (AC3: both partners of couple 2 see the request)
      await loginAs(pageQ, EMAIL_Q);
      await expect(
        pageQ.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const inboundRespQ = pageQ.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000 },
      );
      await pageQ.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageQ).toHaveURL("/inbound-requests", { timeout: 10_000 });
      expect((await inboundRespQ).status()).toBe(200);
      await expect(
        pageQ
          .locator(".couple-grid .couple-card")
          .filter({ hasText: "Stage2 User N" }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(pageQ.getByRole("button", { name: "Accept" })).toBeVisible({
        timeout: 10_000,
      });

      // P declines
      const respondRespP = pageP.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") &&
          resp.url().includes("/respond"),
        { timeout: 10_000 },
      );
      await pageP.getByRole("button", { name: "Decline" }).click();
      expect((await respondRespP).status()).toBe(200);
      await expect(pageP.getByRole("button", { name: "Declined" })).toBeVisible(
        { timeout: 10_000 },
      );
      await expect(
        pageP.getByRole("button", { name: "Accept" }),
      ).not.toBeVisible();

      // Q revisits Inbound Requests (navigates away and back to trigger a fresh
      // fetch) — card is now silently absent (DECLINED filtered from inbound)
      await pageQ.getByRole("link", { name: "Discover" }).click();
      await expect(pageQ).toHaveURL("/", { timeout: 10_000 });
      const inboundRespQ2 = pageQ.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000 },
      );
      await pageQ.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageQ).toHaveURL("/inbound-requests", { timeout: 10_000 });
      expect((await inboundRespQ2).status()).toBe(200);
      await expect(pageQ.locator(".couple-grid")).not.toBeVisible({
        timeout: 10_000,
      });
      await expect(
        pageQ.getByText(
          "Connection requests from other couples will appear here.",
        ),
      ).toBeVisible({ timeout: 10_000 });

      // N (Couple 1) sees no attribution of who declined:
      // - Discovery feed excludes PQ (any-status connection request removes couple from feed)
      // - Partner's Interests page shows empty state (no INTEREST_PENDING rows remain)
      await loginAs(pageN, EMAIL_N);
      await expect(
        pageN.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      // PQ couple is absent from discovery (connection request exists, any status → excluded)
      await expect(
        pageN
          .locator(".couple-grid .couple-card")
          .filter({ hasText: "Stage2 User P" }),
      ).not.toBeVisible();
      // Partner's Interests shows empty state — no INTEREST_PENDING rows remain after decline
      // (primary privacy check: no "who declined" attribution visible in pending interests)
      const partnerInterestsRespN = pageN.waitForResponse(
        (resp) => resp.url().includes("/connections/partner-interests"),
        { timeout: 10_000 },
      );
      await pageN.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageN).toHaveURL("/partner-interests", { timeout: 10_000 });
      expect((await partnerInterestsRespN).status()).toBe(200);
      await expect(
        pageN.getByText(/partner.*selected interests will appear here/i),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxP.close();
      await ctxQ.close();
      await ctxN.close();
    }
  });
});
