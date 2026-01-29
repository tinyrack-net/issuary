import { expect, test } from '@playwright/test';

test('index page redirects to login and renders', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL('/login');

  await expect(page.locator('h1')).toBeVisible();
});
