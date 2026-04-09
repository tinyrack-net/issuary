import { expect } from '@playwright/test';
import { google } from '@tinyrack/tinyauth-server/identity-providers/google';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
  }),
  auth: {
    password: {
      enabled: false,
    },
  },
  identity_providers: [
    google({
      id: 'google',
      enabled: true,
      display_name: 'Google',
      client_id: 'test-google-client-id',
      client_secret: 'test-google-client-secret',
      email_conflict_strategy: 'auto_link',
    }),
  ],
}));

test.describe('Password disabled configuration', () => {
  test('login page hides password method and keeps oauth method', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(page.locator('a[href^="/login/password"]')).toHaveCount(0);
    await expect(page.getByText('Google')).toBeVisible();
  });

  test('password recovery routes redirect to login', async ({ page }) => {
    await page.goto('/password/forgot');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/password/reset?token=test-token');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('email verification route redirects to login', async ({ page }) => {
    await page.goto('/verify/email?token=test-token');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('register page has no password form when password auth is disabled', async ({
    page,
  }) => {
    await page.goto('/register');

    await expect(page.locator('input[name="email"]')).toHaveCount(0);
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await expect(page.locator('button[type="submit"]')).toHaveCount(0);
  });
});
