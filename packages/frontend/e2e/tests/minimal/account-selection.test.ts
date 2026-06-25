import { expect } from '@playwright/test';
import {
  createScenarioFixture,
  gotoWithFirefoxRetry,
} from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { consentPage } from '#frontend-e2e/helpers/consent.ts';
import {
  buildAuthorizePath,
  buildOAuthFlowInput,
  captureClientRedirectAfterAction,
  exchangeAuthorizationCode,
} from '#frontend-e2e/helpers/oauth-client-flow.ts';

const PASSWORD = 'multiAccountPassword123!';

const LOCKED_CLIENT = {
  ...E2E_TEST_CLIENT_CONFIG,
  id: 'locked-account-selection-client',
  name: 'Locked Account Selection Client',
  client_id: 'locked-account-selection-client',
  client_secret: 'locked-account-selection-secret',
  account_selection: {
    allow_add_account: false,
  },
};

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    auth: {
      account_selection: {
        enabled: true,
        mode: 'smart',
        allow_add_account: true,
        allow_remove_account: true,
        remember_accounts: {
          enabled: true,
          max_accounts: 5,
          ttl: '30d',
        },
      },
    },
  }),
  clients: [E2E_TEST_CLIENT_CONFIG, LOCKED_CLIENT],
  users: [
    {
      sub: 'account-selection-alice',
      email: 'account-selection-alice@example.com',
      password: PASSWORD,
      role: 'admin',
    },
    {
      sub: 'account-selection-bob',
      email: 'account-selection-bob@example.com',
      password: PASSWORD,
      role: 'user',
    },
    {
      sub: 'account-selection-carol',
      email: 'account-selection-carol@example.com',
      password: PASSWORD,
      role: 'user',
    },
  ],
}));

async function loginByApi(
  page: import('@playwright/test').Page,
  baseURL: string,
  email: string,
): Promise<void> {
  const response = await page
    .context()
    .request.post(`${baseURL}/api/auth/login`, {
      data: { email, password: PASSWORD },
      headers: { Origin: baseURL },
    });

  if (!response.ok()) {
    throw new Error(
      `Failed to log in ${email}: ${response.status()} ${await response.text()}`,
    );
  }
}

async function seedRememberedAccounts(
  page: import('@playwright/test').Page,
  baseURL: string,
): Promise<void> {
  await loginByApi(page, baseURL, 'account-selection-alice@example.com');
  await loginByApi(page, baseURL, 'account-selection-bob@example.com');
}

test.describe('OIDC account selection', () => {
  test('allow_add_account=true lets a user add another account and issues tokens for it', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    await seedRememberedAccounts(page, String(baseURL));

    const flow = buildOAuthFlowInput('account-selection-add-account', {
      prompt: 'select_account',
    });
    await gotoWithFirefoxRetry(
      page,
      browserName,
      buildAuthorizePath(flow.authorizeParams),
    );

    await expect(page).toHaveURL(/\/account\/select/);
    await expect(
      page.getByText('account-selection-alice@example.com'),
    ).toBeVisible();
    await expect(
      page.getByText('account-selection-bob@example.com'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="select-account-account-selection-bob"]'),
    ).toContainText('Current account');

    await page.getByRole('link', { name: /Use another account/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.locator('a[href^="/login/password"]').click();
    await expect(page).toHaveURL(/\/login\/password/);
    await page
      .locator('input[name="email"]')
      .fill('account-selection-carol@example.com');
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/consent/);
    await expect(page.locator(consentPage.userEmail)).toContainText(
      'account-selection-carol@example.com',
    );

    const code = await captureClientRedirectAfterAction(page, async () => {
      await page.locator(consentPage.allowButton).click({ noWaitAfter: true });
    });
    const tokenResponse = await exchangeAuthorizationCode(
      request,
      String(baseURL),
      {
        code: code.searchParams.get('code') ?? '',
        codeVerifier: flow.codeVerifier,
      },
    );
    const userinfoResponse = await request.get(`${baseURL}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });
    expect(userinfoResponse.ok()).toBe(true);
    await expect(userinfoResponse).toBeOK();
    const userinfo = await userinfoResponse.json();
    expect(userinfo).toMatchObject({
      sub: 'account-selection-carol',
      email: 'account-selection-carol@example.com',
    });

    const accountsResponse = await page
      .context()
      .request.get(
        `${baseURL}/api/auth/accounts?client_id=${flow.authorizeParams.client_id}`,
      );
    expect(accountsResponse.ok()).toBe(true);
    const accounts = await accountsResponse.json();
    expect(accounts.allow_add_account).toBe(true);
    expect(
      accounts.accounts.map((account: { sub: string }) => account.sub),
    ).toEqual([
      'account-selection-alice',
      'account-selection-bob',
      'account-selection-carol',
    ]);
  });

  test('client allow_add_account=false hides add-account UX in the browser flow', async ({
    page,
    baseURL,
    browserName,
  }) => {
    await seedRememberedAccounts(page, String(baseURL));

    const flow = buildOAuthFlowInput('account-selection-no-add-account', {
      client_id: LOCKED_CLIENT.client_id,
      prompt: 'select_account',
    });
    await gotoWithFirefoxRetry(
      page,
      browserName,
      buildAuthorizePath(flow.authorizeParams),
    );

    await expect(page).toHaveURL(/\/account\/select/);
    await expect(
      page.getByText('account-selection-alice@example.com'),
    ).toBeVisible();
    await expect(
      page.getByText('account-selection-bob@example.com'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Use another account/i }),
    ).toHaveCount(0);
  });
});
