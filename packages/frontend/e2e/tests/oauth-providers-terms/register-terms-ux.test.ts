import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
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
        content: 'Test Terms of Service content for oauth providers terms.',
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
        content: 'Test Privacy Policy content for oauth providers terms.',
      },
    },
  },
  {
    id: 'analytics',
    required: true,
    consent_mode: 'implicit',
    version: '1.0.0',
    content: {
      en: {
        title: 'Analytics Terms',
        type: 'text',
        content: 'Implicit analytics terms for oauth providers terms.',
      },
    },
  },
] as const;

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
      signup_notice: {
        en: 'By signing up, you agree to product analytics tracking.',
      },
    },
  }),
  terms: [...TERMS_CONFIG],
}));

const TEST_PASSWORD = 'test-password-123';

function allowedEmail(suffix: string): string {
  const ts = Date.now();
  return `oauth-providers-terms-${suffix}-${ts}@allowed.test`;
}

test.describe('Password registration terms UX', () => {
  test('register page shows implicit notice and explicit checkboxes', async ({
    page,
  }) => {
    await page.goto('/register');

    await expect(page.locator(registerPage.implicitNotice)).toBeVisible();
    await expect(page.locator(registerPage.implicitNotice)).toContainText(
      'product analytics tracking',
    );

    await expect(page.locator(registerPage.termsCheckbox)).toHaveCount(3);
    await expect(
      page.locator(registerPage.requiredBadge).first(),
    ).toBeVisible();
    await expect(
      page.locator(registerPage.optionalBadge).first(),
    ).toBeVisible();
  });

  test('submit without required explicit term stays on register', async ({
    page,
  }) => {
    const email = allowedEmail('missing-required');

    await page.goto('/register');
    await page.locator(registerPage.emailInput).fill(email);
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);
    await page.locator(registerPage.submitButton).click();

    await expect(page.locator(registerPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('submit with required explicit term completes registration', async ({
    page,
  }) => {
    const email = allowedEmail('success');

    await page.goto('/register');
    await page.locator(registerPage.emailInput).fill(email);
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);

    // First checkbox is "Agree all", second is required TOS term.
    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator(registerPage.submitButton).click();

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });
});
