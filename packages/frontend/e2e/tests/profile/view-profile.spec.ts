import { expect, test } from '@playwright/test';
import { ROUTES, TEST_USER } from '../../fixtures/test-data';
import { ensureLoggedOut, login } from '../../utils/auth-helpers';

test.describe('Profile Page - View', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);
    await page.waitForURL(/\/profile/);
  });

  test('should display profile page with user info', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /my profile/i }),
    ).toBeVisible();

    // Should show user email
    await expect(page.getByText(TEST_USER.email)).toBeVisible();
  });

  test('should display account information section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /account information/i }),
    ).toBeVisible();
  });

  test('should display security section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /security/i }),
    ).toBeVisible();
  });

  test('should have logout button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
  });
});

test.describe('Profile Page - Access Control', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    await ensureLoggedOut(page);
    await page.goto(ROUTES.profile);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });
});
