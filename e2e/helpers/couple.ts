import { expect, type Browser } from "@playwright/test";
import { registerUser } from "./register";

/** Register two users and link them as a couple. Both land on / when done. */
export async function linkCouple(
  browser: Browser,
  emailA: string,
  nameA: string,
  emailB: string,
  nameB: string,
): Promise<void> {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  try {
    await registerUser(pageA, emailA, nameA);
    await registerUser(pageB, emailB, nameB);
    await expect(pageA.locator(".token-box")).toBeVisible({ timeout: 10_000 });
    const token = (await pageA.locator(".token-box").innerText()).trim();
    await pageB.getByLabel("Partner invite token").fill(token);
    await pageB.getByRole("button", { name: "Link accounts" }).click();
    await expect(pageB).toHaveURL("/", { timeout: 10_000 });
    await expect(pageA).toHaveURL("/", { timeout: 10_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
}
