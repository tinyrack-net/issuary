import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';
import { expect, test } from '@playwright/test';

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
});
