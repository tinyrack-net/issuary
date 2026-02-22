import { expect, type Page } from '@playwright/test';

/**
 * Starts OAuth login by clicking provider button by label.
 */
export async function startOAuthLogin(
  page: Page,
  providerName: string,
): Promise<void> {
  await page.getByRole('link', { name: providerName }).click();
}

/**
 * Asserts login page OAuth error message after callback redirect.
 */
export async function expectOAuthError(
  page: Page,
  message: string,
): Promise<void> {
  await page.waitForURL('**/login**');
  await expect(page.getByText(message)).toBeVisible();
}
