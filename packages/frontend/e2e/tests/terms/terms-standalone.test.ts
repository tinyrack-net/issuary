import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { loginAndGoToProfile } from '#frontend-e2e/helpers/profile-page.js';
import { registerPage } from '#frontend-e2e/helpers/register-page.js';

const TERMS_CONFIG = [
  {
    id: 'tos',
    required: true,
    consent_mode: 'explicit',
    version: '1.0.0',
    content: {
      en: {
        title: 'Terms of Service',
        type: 'text',
        content: 'Test Terms of Service content for e2e testing.',
      },
    },
  },
  {
    id: 'privacy',
    required: false,
    consent_mode: 'explicit',
    version: '1.0.0',
    content: {
      en: {
        title: 'Privacy Policy',
        type: 'text',
        content: 'Test Privacy Policy content for e2e testing.',
      },
    },
  },
] as const;

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
  terms: [...TERMS_CONFIG],
}));

test.describe('Standalone terms page', () => {
  test('displays explicit terms checkboxes', async ({ page }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    // Navigate to terms page
    await page.goto('/terms', { waitUntil: 'networkidle' });

    // Should show the terms heading
    await expect(
      page.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeVisible();

    // Explicit terms checkboxes should be visible
    const checkboxes = page.locator(registerPage.termsCheckbox);
    await expect(checkboxes.first()).toBeVisible();
  });

  test('submitting without required terms shows validation error', async ({
    page,
  }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await page.goto('/terms');
    await expect(
      page.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeVisible({ timeout: 10000 });

    // Uncheck all checkboxes to ensure required terms are NOT agreed.
    // Under parallel execution, another browser (chromium) may have
    // already submitted consent for this config-managed user, causing
    // checkboxes to be pre-checked.
    const checkboxes = page.locator(registerPage.termsCheckbox);
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).uncheck();
    }

    // Submit without required terms
    await page.locator('button[type="submit"]').click();

    // Should show validation error
    await expect(
      page.locator('[data-testid="terms-field-error"]').first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('agreeing to required terms and submitting succeeds', async ({
    page,
  }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await page.goto('/terms', { waitUntil: 'networkidle' });

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeVisible();

    // Check all checkboxes
    const checkboxes = page.locator(registerPage.termsCheckbox);
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should redirect (either to profile or another page)
    // The terms page redirects on success
    await page.waitForURL((url) => !url.pathname.startsWith('/terms'), {
      timeout: 10000,
    });
  });
});
