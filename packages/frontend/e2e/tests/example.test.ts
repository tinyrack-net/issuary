import { expect, test } from '@playwright/test';

test('redirects to login page when not authenticated', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/login');
  await expect(page).toHaveURL(/\/login/);
});

test('login page renders correctly', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Tinyauth')).toBeVisible();
  await expect(page.getByText('Email')).toBeVisible();
});
