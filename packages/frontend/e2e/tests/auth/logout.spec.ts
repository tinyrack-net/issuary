import { expect, test } from '@playwright/test';
import { ROUTES, TEST_USER } from '../../fixtures/test-data';
import { ensureLoggedOut, login } from '../../utils/auth-helpers';

test.describe('Logout', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);
    await page.waitForURL(/\/profile/);
  });

  test('should logout successfully', async ({ page }) => {
    // Should be on profile page
    await expect(page).toHaveURL(ROUTES.profile);

    // Click logout button
    await page.getByRole('button', { name: /log out/i }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(ROUTES.login);
  });

  test('should not access protected routes after logout', async ({ page }) => {
    // Logout
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(ROUTES.login);

    // Try to access profile page
    await page.goto(ROUTES.profile);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should be able to login again after logout', async ({ page }) => {
    // Logout
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(ROUTES.login);

    // Login again
    await page.getByPlaceholder(/hello@example.com/i).fill(TEST_USER.email);
    await page
      .getByPlaceholder(/enter your password/i)
      .fill(TEST_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    // Should be back on profile page
    await expect(page).toHaveURL(ROUTES.profile);
  });
});
