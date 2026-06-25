import { expect } from '@playwright/test';
import {
  createScenarioFixture,
  gotoWithFirefoxRetry,
} from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { performLogin } from '#frontend-e2e/helpers/login.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `dual-2fa-${suffix}`);
}

const TEST_PASSWORD = 'test-password-123';

async function followRouteLink(
  page: import('@playwright/test').Page,
  browserName: string,
  selector: string,
): Promise<void> {
  const link = page.locator(selector);
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  await gotoWithFirefoxRetry(page, browserName, href as string);
}

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
      two_factor: { enrollment_required: true },
      totp: { enabled: true },
    },
    passkey: { enabled: true },
  },
}));

test.describe('Dual 2FA selection UI', () => {
  test('new user is routed to setup 2FA selection page', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('setup');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    await performLogin(page, email, TEST_PASSWORD);
    await page.waitForURL('**/setup/2fa');

    await expect(page.locator('a[href^="/setup/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/setup/passkey"]')).toBeVisible();
  });

  test('verify 2FA page shows both enabled methods', async ({
    page,
    browserName,
  }) => {
    await gotoWithFirefoxRetry(page, browserName, '/verify/2fa');

    await expect(page.locator('a[href^="/verify/totp"]')).toBeVisible();
    await expect(page.locator('a[href^="/verify/passkey"]')).toBeVisible();
  });

  test('setup 2FA page can route to both setup methods', async ({
    browser,
    page,
    baseURL,
    browserName,
  }) => {
    const client = getTestApiClient({ baseUrl: String(baseURL) });

    const totpEmail = uniqueEmail('setup-route-totp');
    const totpRegisterRes = await client.api.auth.register.$post({
      header: {},
      json: { email: totpEmail, password: TEST_PASSWORD },
    });
    if (!totpRegisterRes.ok) {
      throw new Error(
        `Failed to register TOTP user: ${totpRegisterRes.status}`,
      );
    }
    await performLogin(page, totpEmail, TEST_PASSWORD);
    await page.waitForURL('**/setup/2fa');
    await followRouteLink(page, browserName, 'a[href^="/setup/totp"]');
    await page.waitForURL('**/setup/totp');

    const passkeyContext = await browser.newContext({
      baseURL: String(baseURL),
    });
    const passkeyPage = await passkeyContext.newPage();
    try {
      const passkeyEmail = uniqueEmail('setup-route-passkey');
      const passkeyRegisterRes = await client.api.auth.register.$post({
        header: {},
        json: { email: passkeyEmail, password: TEST_PASSWORD },
      });
      if (!passkeyRegisterRes.ok) {
        throw new Error(
          `Failed to register passkey user: ${passkeyRegisterRes.status}`,
        );
      }
      await performLogin(passkeyPage, passkeyEmail, TEST_PASSWORD);
      await passkeyPage.waitForURL('**/setup/2fa');
      await followRouteLink(
        passkeyPage,
        browserName,
        'a[href^="/setup/passkey"]',
      );
      await expect(passkeyPage).toHaveURL(/\/setup\/passkey/);
    } finally {
      await passkeyContext.close();
    }
  });

  test('verify 2FA page can route to both verify methods', async ({
    browser,
    page,
    baseURL,
    browserName,
  }) => {
    await gotoWithFirefoxRetry(page, browserName, '/verify/2fa');
    await followRouteLink(page, browserName, 'a[href^="/verify/totp"]');
    await page.waitForURL('**/verify/totp');

    const passkeyContext = await browser.newContext({
      baseURL: String(baseURL),
    });
    const passkeyPage = await passkeyContext.newPage();
    try {
      await gotoWithFirefoxRetry(passkeyPage, browserName, '/verify/2fa');
      await followRouteLink(
        passkeyPage,
        browserName,
        'a[href^="/verify/passkey"]',
      );
      await passkeyPage.waitForURL('**/verify/passkey');
    } finally {
      await passkeyContext.close();
    }
  });
});
