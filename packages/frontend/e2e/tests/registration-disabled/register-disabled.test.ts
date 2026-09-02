import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    registration: {
      enabled: false,
      allowed_email_patterns: [],
    },
  }),
}));

test.describe('Registration disabled', () => {
  test('navigating to /register redirects to /login', async ({ page }) => {
    await page.goto('/register');

    // The route loader checks public_registration: false and redirects.
    await page.waitForURL('**/login**');
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
    await expect(page.getByRole('link', { name: 'Sign up' })).toHaveCount(0);
  });
});
