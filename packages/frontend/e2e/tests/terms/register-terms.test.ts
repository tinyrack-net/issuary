import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { registerPage } from '#frontend-e2e/helpers/register-page.ts';

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
  ...createTestConfig(backendPort, {
    registration: {
      enabled: true,
      allowed_email_patterns: ['*@allowed.com'],
      signup_notice: {
        en: 'By signing up, you agree to receive marketing emails.',
      },
    },
  }),
  terms: [...TERMS_CONFIG],
}));

/**
 * Generates a unique test email with the allowed domain.
 */
function allowedEmail(suffix: string): string {
  return createUniqueEmail(
    test.info(),
    `register-terms-${suffix}`,
    'allowed.com',
  );
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Registration with terms and email restriction', () => {
  test('registration with allowed email and required terms succeeds', async ({
    page,
  }) => {
    const email = allowedEmail('success');
    await page.goto('/register');

    await page.locator(registerPage.emailInput).fill(email);
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);

    // Check the required TOS checkbox (first explicit term)
    const checkboxes = page.locator(registerPage.termsCheckbox);
    // First checkbox is "Agree All", second is TOS (required)
    await checkboxes.nth(1).check();

    await page.locator(registerPage.submitButton).click();

    // Should navigate to profile (no email verification, no 2FA)
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('registration with disallowed email shows error', async ({ page }) => {
    await page.goto('/register');

    await page.locator(registerPage.emailInput).fill('user@other.com');
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);

    // Check required TOS checkbox
    const checkboxes = page.locator(registerPage.termsCheckbox);
    await checkboxes.nth(1).check();

    await page.locator(registerPage.submitButton).click();

    // Should show email not allowed error
    await expect(page.locator(registerPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('required terms not checked shows validation error', async ({
    page,
  }) => {
    const email = allowedEmail('no-terms');
    await page.goto('/register');

    await page.locator(registerPage.emailInput).fill(email);
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);

    // Do NOT check the required TOS checkbox, just submit
    await page.locator(registerPage.submitButton).click();

    // Should show validation error for terms
    await expect(page.locator(registerPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('implicit notice text is visible', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator(registerPage.implicitNotice)).toBeVisible();
    await expect(page.locator(registerPage.implicitNotice)).toContainText(
      'marketing emails',
    );
  });

  test('explicit terms checkboxes are visible with badges', async ({
    page,
  }) => {
    await page.goto('/register');

    // Required badge (TOS)
    await expect(
      page.locator(registerPage.requiredBadge).first(),
    ).toBeVisible();

    // Optional badge (Privacy)
    await expect(
      page.locator(registerPage.optionalBadge).first(),
    ).toBeVisible();
  });

  test('"Agree all" checkbox toggles all terms', async ({ page }) => {
    await page.goto('/register');

    const checkboxes = page.locator(registerPage.termsCheckbox);

    // First checkbox is "Agree All"
    const agreeAll = checkboxes.nth(0);
    const tosCheckbox = checkboxes.nth(1);
    const privacyCheckbox = checkboxes.nth(2);

    // Initially unchecked
    await expect(tosCheckbox).not.toBeChecked();
    await expect(privacyCheckbox).not.toBeChecked();

    // Check "Agree All"
    await agreeAll.check();

    // All should be checked
    await expect(tosCheckbox).toBeChecked();
    await expect(privacyCheckbox).toBeChecked();

    // Uncheck "Agree All"
    await agreeAll.uncheck();

    // All should be unchecked
    await expect(tosCheckbox).not.toBeChecked();
    await expect(privacyCheckbox).not.toBeChecked();
  });
});
