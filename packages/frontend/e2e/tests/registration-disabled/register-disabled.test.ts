import { expect, test } from '@frontend-e2e/fixtures/registration-disabled.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';

test.describe('Registration disabled', () => {
  test('navigating to /register redirects to /login', async ({ page }) => {
    await page.goto('/register');

    // beforeLoad guard checks public_registration: false and redirects
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('API returns 403 for registration attempt', async ({ baseURL }) => {
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const res = await client.api.auth.register.$post({
      header: {},
      json: {
        email: 'test@example.com',
        password: 'test-password-123',
      },
    });

    expect(res.status).toBe(403);
  });

  test('password login page hides register link', async ({ page }) => {
    await page.goto('/login/password');
    await expect(page.locator('a[href^="/register"]')).toHaveCount(0);
  });
});
