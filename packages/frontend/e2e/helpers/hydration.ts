import { expect, type Page } from '@playwright/test';

export async function waitForAppHydration(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}
