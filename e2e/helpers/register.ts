import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password123!";

/** Register a new user through all 3 onboarding steps and land on /profile. */
export async function registerUser(
  page: Page,
  email: string,
  displayName: string,
): Promise<void> {
  await page.goto("/register");
  await page.locator("#displayName").fill(displayName);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/register\/interests/, { timeout: 15_000 });
  await page.getByRole("button", { name: "hiking" }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();

  await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });
}
