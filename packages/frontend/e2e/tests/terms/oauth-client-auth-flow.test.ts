import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { consentPage } from '#frontend-e2e/helpers/consent.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { loginPasswordPage } from '#frontend-e2e/helpers/login.ts';
import {
  allowConsentAndCaptureCode,
  buildAuthorizePath,
  buildOAuthFlowInput,
  exchangeAuthorizationCode,
  expectOAuthParamsInCurrentUrl,
} from '#frontend-e2e/helpers/oauth-client-flow.ts';
import { registerPage } from '#frontend-e2e/helpers/register-page.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

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
      allowed_email_patterns: ['*'],
    },
  }),
  terms: [...TERMS_CONFIG],
  clients: [E2E_TEST_CLIENT_CONFIG],
}));

const TEST_PASSWORD = 'test-password-123';
const REQUIRED_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
];

function allowedEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `oauth-terms-${suffix}`, 'allowed.com');
}

async function registerUserByApiWithTerms(
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const registerRes = await client.api.auth.register.$post({
    header: {},
    json: {
      email,
      password,
      consents: REQUIRED_CONSENTS,
    },
  });

  if (!registerRes.ok) {
    throw new Error(`Failed to register user: ${registerRes.status}`);
  }
}

async function openPasswordLogin(page: import('@playwright/test').Page) {
  await page.waitForURL('**/login**');
  const url = new URL(page.url());
  if (!url.pathname.startsWith('/login/password')) {
    const search = url.searchParams.toString();
    const passwordPath = search
      ? `/login/password?${search}`
      : '/login/password';
    await page.goto(passwordPath);
    await page.waitForURL('**/login/password**');
  }
  await expect(page.locator(loginPasswordPage.emailInput)).toBeVisible();
}

test.describe('OAuth client auth flow with explicit terms', () => {
  test('unauthenticated authorize request redirects to login with oauth params', async ({
    page,
  }) => {
    const oauth = buildOAuthFlowInput('terms-unauthenticated');

    await page.goto(buildAuthorizePath(oauth.authorizeParams));

    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);
  });

  test('existing user login reaches consent and exchanges authorization code', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = allowedEmail('login');
    await registerUserByApiWithTerms(String(baseURL), email, TEST_PASSWORD);

    const oauth = buildOAuthFlowInput('terms-login');
    await page.goto(buildAuthorizePath(oauth.authorizeParams));

    await openPasswordLogin(page);
    await page.locator(loginPasswordPage.emailInput).fill(email);
    await page.locator(loginPasswordPage.passwordInput).fill(TEST_PASSWORD);
    await page.locator(loginPasswordPage.submitButton).click();

    await page.waitForURL('**/consent**');
    await expect(page.locator(consentPage.userEmail)).toContainText(email);
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    const code = await allowConsentAndCaptureCode(page);
    const tokens = await exchangeAuthorizationCode(request, String(baseURL), {
      code,
      codeVerifier: oauth.codeVerifier,
    });

    expect(tokens.id_token).toBeTruthy();
  });

  test('new signup during oauth with required terms checked reaches consent', async ({
    page,
    baseURL,
    request,
  }) => {
    const email = allowedEmail('signup-terms-checked');
    const oauth = buildOAuthFlowInput('terms-signup-checked');

    await page.goto(buildAuthorizePath(oauth.authorizeParams));

    await page.waitForURL('**/login**');
    await page.goto(
      `/register?${new URLSearchParams(oauth.authorizeParams).toString()}`,
    );
    await page.waitForURL('**/register**');
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    await page.locator(registerPage.emailInput).fill(email);
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);
    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator(registerPage.submitButton).click();

    await page.waitForURL('**/consent**');
    await expect(page.locator(consentPage.userEmail)).toContainText(email);
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);

    const code = await allowConsentAndCaptureCode(page);
    const tokens = await exchangeAuthorizationCode(request, String(baseURL), {
      code,
      codeVerifier: oauth.codeVerifier,
    });

    expect(tokens.access_token).toBeTruthy();
  });

  test('new signup during oauth without required terms stays on register', async ({
    page,
  }) => {
    const email = allowedEmail('signup-terms-missing');
    const oauth = buildOAuthFlowInput('terms-signup-missing');

    await page.goto(buildAuthorizePath(oauth.authorizeParams));

    await page.waitForURL('**/login**');
    await page.goto(
      `/register?${new URLSearchParams(oauth.authorizeParams).toString()}`,
    );
    await page.waitForURL('**/register**');

    await page.locator(registerPage.emailInput).fill(email);
    await page.locator(registerPage.passwordInput).fill(TEST_PASSWORD);
    await page.locator(registerPage.submitButton).click();
    await expect(page.locator(registerPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
    expectOAuthParamsInCurrentUrl(page, oauth.authorizeParams);
  });
});
