import { test, expect, type Page } from "@playwright/test";
import { deleteTestUser } from "./helpers/cleanup";
import { linkCouple } from "./helpers/couple";
import { PASSWORD } from "./helpers/register";

const TS = Date.now();

// Couple 1: initiating couple
const EMAIL_C1A = `test_e2e_chat_c1a_${TS}@example.com`;
const EMAIL_C1B = `test_e2e_chat_c1b_${TS}@example.com`;

// Couple 2: receiving couple
const EMAIL_C2A = `test_e2e_chat_c2a_${TS}@example.com`;
const EMAIL_C2B = `test_e2e_chat_c2b_${TS}@example.com`;

// Outsider couple: no connections — used for tests 3 and 4
const EMAIL_OUT_A = `test_e2e_chat_out_a_${TS}@example.com`;
const EMAIL_OUT_B = `test_e2e_chat_out_b_${TS}@example.com`;

// Captured in beforeAll from POST /connections/interest response
let REQUEST_ID: string;

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

async function goToConnections(page: Page): Promise<void> {
  const connectedResp = page.waitForResponse(
    (resp) => resp.url().includes("/connections/connected"),
    { timeout: 10_000 },
  );
  await page.getByRole("link", { name: "Connections" }).click();
  await expect(page).toHaveURL("/connections", { timeout: 10_000 });
  expect((await connectedResp).status()).toBe(200);
}

test.describe.serial("Connections and Chat", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);

    // ── Step 1: Register and link all three couples ──────────────────────────
    await linkCouple(browser, EMAIL_C1A, "Conn Alice", EMAIL_C1B, "Conn Bob");
    await linkCouple(browser, EMAIL_C2A, "Conn Carol", EMAIL_C2B, "Conn Dave");
    await linkCouple(browser, EMAIL_OUT_A, "Conn Eve", EMAIL_OUT_B, "Conn Frank");

    // ── Step 2a: C1A expresses interest in C2 → capture REQUEST_ID ──────────
    const ctxC1A = await browser.newContext();
    try {
      const pageC1A = await ctxC1A.newPage();
      await loginAs(pageC1A, EMAIL_C1A);
      await expect(
        pageC1A.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const cardC2 = pageC1A
        .locator(".couple-grid .couple-card")
        .filter({ hasText: "Conn Carol" });
      await expect(cardC2).toBeVisible({ timeout: 10_000 });
      const interestRespPromise = pageC1A.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/interest") &&
          resp.request().method() === "POST",
        { timeout: 10_000 },
      );
      await cardC2.getByRole("button", { name: "I'm interested" }).click();
      const interestResp = await interestRespPromise;
      expect(interestResp.status()).toBe(201);
      const body = (await interestResp.json()) as { id: string };
      REQUEST_ID = body.id;
    } finally {
      await ctxC1A.close();
    }

    // ── Step 2b: C1B approves → INTEREST_ALIGNED ────────────────────────────
    const ctxC1B = await browser.newContext();
    try {
      const pageC1B = await ctxC1B.newPage();
      await loginAs(pageC1B, EMAIL_C1B);
      await expect(
        pageC1B.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      await pageC1B.getByRole("link", { name: "Partner's Interests" }).click();
      await expect(pageC1B).toHaveURL("/partner-interests", {
        timeout: 10_000,
      });
      await expect(
        pageC1B.getByRole("button", { name: "Approve" }),
      ).toBeVisible({ timeout: 10_000 });
      const alignRespPromise = pageC1B.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") && resp.url().includes("/align"),
        { timeout: 10_000 },
      );
      await pageC1B.getByRole("button", { name: "Approve" }).click();
      expect((await alignRespPromise).status()).toBe(200);
    } finally {
      await ctxC1B.close();
    }

    // ── Step 2c: C2A loads inbound (triggers REQUEST_PENDING) + accepts ──────
    const ctxC2A = await browser.newContext();
    try {
      const pageC2A = await ctxC2A.newPage();
      await loginAs(pageC2A, EMAIL_C2A);
      await expect(
        pageC2A.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const inboundRespPromise = pageC2A.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000 },
      );
      await pageC2A.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageC2A).toHaveURL("/inbound-requests", {
        timeout: 10_000,
      });
      expect((await inboundRespPromise).status()).toBe(200);
      await expect(
        pageC2A.getByRole("button", { name: "Accept" }),
      ).toBeVisible({ timeout: 10_000 });
      const respondRespPromise = pageC2A.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") &&
          resp.url().includes("/respond"),
        { timeout: 10_000 },
      );
      await pageC2A.getByRole("button", { name: "Accept" }).click();
      expect((await respondRespPromise).status()).toBe(200);
    } finally {
      await ctxC2A.close();
    }

    // ── Step 2d: C2B loads inbound + accepts → CONNECTED ─────────────────────
    const ctxC2B = await browser.newContext();
    try {
      const pageC2B = await ctxC2B.newPage();
      await loginAs(pageC2B, EMAIL_C2B);
      await expect(
        pageC2B.getByRole("heading", { name: "Discover couples" }),
      ).toBeVisible({ timeout: 10_000 });
      const inboundRespPromise = pageC2B.waitForResponse(
        (resp) => resp.url().includes("/connections/inbound"),
        { timeout: 10_000,},
      );
      await pageC2B.getByRole("link", { name: "Inbound Requests" }).click();
      await expect(pageC2B).toHaveURL("/inbound-requests", {
        timeout: 10_000,
      });
      expect((await inboundRespPromise).status()).toBe(200);
      await expect(
        pageC2B.getByRole("button", { name: "Accept" }),
      ).toBeVisible({ timeout: 10_000 });
      const respondRespPromise = pageC2B.waitForResponse(
        (resp) =>
          resp.url().includes("/connections/") &&
          resp.url().includes("/respond"),
        { timeout: 10_000 },
      );
      await pageC2B.getByRole("button", { name: "Accept" }).click();
      expect((await respondRespPromise).status()).toBe(200);
      await expect(
        pageC2B.getByRole("button", { name: "Connected!" }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxC2B.close();
    }
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteTestUser(EMAIL_C1A, PASSWORD),
      deleteTestUser(EMAIL_C1B, PASSWORD),
      deleteTestUser(EMAIL_C2A, PASSWORD),
      deleteTestUser(EMAIL_C2B, PASSWORD),
      deleteTestUser(EMAIL_OUT_A, PASSWORD),
      deleteTestUser(EMAIL_OUT_B, PASSWORD),
    ]);
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  // Once connected, both couples see each other in the Connections view as a
  // clickable row that navigates to the chat thread.
  test("connected couple appears in Connections view and row links to chat", async ({
    page,
  }) => {
    await loginAs(page, EMAIL_C1A);
    await goToConnections(page);

    // C1A sees C2's couple in the list
    const row = page
      .locator(".connection-row")
      .filter({ hasText: "Conn Carol" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator(".connection-row-name")).toContainText(
      "Conn Carol",
    );

    // Clicking the row navigates to the chat thread
    await row.click();
    await expect(page).toHaveURL(`/chat/${REQUEST_ID}`, { timeout: 10_000 });
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  // A message sent by a Couple 1 member appears in Couple 2's thread without a
  // page refresh, delivered via Supabase Realtime broadcast.
  test("message sent by Couple 1 appears in Couple 2's thread via Realtime", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const ctxC1 = await browser.newContext();
    const ctxC2 = await browser.newContext();

    try {
      const pageC1 = await ctxC1.newPage();
      const pageC2 = await ctxC2.newPage();

      // Both users navigate to the chat thread via SPA (no page.goto after login)
      await loginAs(pageC1, EMAIL_C1A);
      await goToConnections(pageC1);
      await pageC1.locator(".connection-row").click();
      await expect(pageC1).toHaveURL(`/chat/${REQUEST_ID}`, {
        timeout: 10_000,
      });

      await loginAs(pageC2, EMAIL_C2A);
      await goToConnections(pageC2);
      await pageC2.locator(".connection-row").click();
      await expect(pageC2).toHaveURL(`/chat/${REQUEST_ID}`, {
        timeout: 10_000,
      });

      // Wait for both pages to finish loading the messages list. The Realtime
      // subscription is set up in the same useEffect pass, so by this point both
      // channels are open.
      await expect(pageC1.locator(".chat-messages")).toBeVisible({
        timeout: 10_000,
      });
      await expect(pageC2.locator(".chat-messages")).toBeVisible({
        timeout: 10_000,
      });

      // C1A fills the input. The Send button's `disabled` state is controlled by
      // React's `input` state, so click() waits for it to be enabled — acting as
      // a natural guard against the fill/state-flush race.
      await pageC1
        .locator("input[placeholder='Type a message...']")
        .fill("Hello real-time!");
      await pageC1.getByRole("button", { name: "Send" }).click();

      // C1A's own view: message appears immediately as a sent bubble
      await expect(
        pageC1.locator(".chat-message--mine .chat-bubble"),
      ).toHaveText("Hello real-time!", { timeout: 10_000 });

      // C2A's view: message arrives WITHOUT any page reload (Realtime broadcast)
      await expect(
        pageC2.locator(".chat-message--theirs .chat-bubble"),
      ).toHaveText("Hello real-time!", { timeout: 15_000 });
    } finally {
      await ctxC1.close();
      await ctxC2.close();
    }
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  // A user who is not a participant in a connection cannot access the chat
  // thread. The 403 from GET /messages/:id is surfaced as an error in the UI.
  //
  // page.goto is intentional here: the outsider has no connection row to click,
  // and this simulates the realistic attack vector (direct URL access by someone
  // who knows the request ID). access_token + is_paired are persisted in
  // localStorage so RequireAuthAndPaired passes; the 403 comes from the API.
  test("non-participant navigating directly to a chat thread sees an access error", async ({
    page,
  }) => {
    await loginAs(page, EMAIL_OUT_A);
    await page.goto(`/chat/${REQUEST_ID}`);
    await expect(page.locator(".chat-page--center span")).toHaveText(
      "Not authorized",
      { timeout: 5_000 },
    );
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  // A couple with no connections sees the empty-state placeholder in the
  // Connections view.
  test("connections view shows empty-state placeholder for a couple with no connections", async ({
    page,
  }) => {
    await loginAs(page, EMAIL_OUT_A);
    await goToConnections(page);
    await expect(page.locator(".placeholder-text")).toHaveText(
      "Your connected couples will appear here.",
    );
  });
});
