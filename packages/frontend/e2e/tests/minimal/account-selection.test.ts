import { expect } from '@playwright/test';
import {
  createScenarioFixture,
  gotoWithFirefoxRetry,
} from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT,
  E2E_TEST_CLIENT_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { consentPage } from '#frontend-e2e/helpers/consent.ts';
import {
  buildAuthorizePath,
  buildOAuthFlowInput,
  captureClientRedirectAfterAction,
  exchangeAuthorizationCode,
  type OAuthAuthorizeParams,
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

const ALWAYS_ACCOUNT_SELECTION_MODE: 'always' = 'always';
const NEVER_ACCOUNT_SELECTION_MODE: 'never' = 'never';

const ALWAYS_CLIENT = {
  ...E2E_TEST_CLIENT_CONFIG,
  id: 'always-account-selection-client',
  name: 'Always Account Selection Client',
  client_id: 'always-account-selection-client',
  client_secret: 'always-account-selection-secret',
  skip_consent: true,
  account_selection: {
    mode: ALWAYS_ACCOUNT_SELECTION_MODE,
  },
};

const NEVER_CLIENT = {
  ...E2E_TEST_CLIENT_CONFIG,
  id: 'never-account-selection-client',
  name: 'Never Account Selection Client',
  client_id: 'never-account-selection-client',
  client_secret: 'never-account-selection-secret',
  skip_consent: true,
  account_selection: {
    mode: NEVER_ACCOUNT_SELECTION_MODE,
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
  clients: [E2E_TEST_CLIENT_CONFIG, LOCKED_CLIENT, ALWAYS_CLIENT, NEVER_CLIENT],
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

async function authorizeSelectedAccount(params: {
  page: import('@playwright/test').Page;
  request: import('@playwright/test').APIRequestContext;
  baseURL: string;
  browserName: string;
  state: string;
  email: string;
  expectedSub: string;
  clientId?: string;
  clientSecret?: string;
  prompt?: 'select_account';
  omitPrompt?: boolean;
}): Promise<{ sub: string; email: string }> {
  const authorizeOverrides: Partial<OAuthAuthorizeParams> = {};
  if (!params.omitPrompt) {
    authorizeOverrides.prompt = params.prompt ?? 'select_account';
  }
  if (params.clientId) {
    authorizeOverrides.client_id = params.clientId;
  }
  const flow = buildOAuthFlowInput(params.state, authorizeOverrides);
  await gotoWithFirefoxRetry(
    params.page,
    params.browserName,
    buildAuthorizePath(flow.authorizeParams),
  );

  await expect(params.page).toHaveURL(/\/account\/select/);
  const callbackRoute = `${E2E_TEST_CLIENT.redirectUri}**`;
  const callbackRouteHandler = async (
    route: import('@playwright/test').Route,
  ) => {
    await route.fulfill({
      body: 'Mock OAuth client callback captured',
      contentType: 'text/plain',
      status: 200,
    });
  };
  await params.page.route(callbackRoute, callbackRouteHandler);
  const redirectPromise = params.page.waitForRequest((request) =>
    request.url().startsWith(E2E_TEST_CLIENT.redirectUri),
  );
  await params.page
    .locator(`[data-testid="select-account-${params.expectedSub}"]`)
    .click({ noWaitAfter: true });

  const consentVisible = await params.page
    .locator(consentPage.allowButton)
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (consentVisible) {
    await params.page.locator(consentPage.allowButton).click({
      noWaitAfter: true,
    });
  }

  const code = new URL((await redirectPromise).url());
  await params.page.waitForLoadState('domcontentloaded');
  await params.page.unroute(callbackRoute, callbackRouteHandler);
  const tokenResponse = await exchangeAuthorizationCode(
    params.request,
    params.baseURL,
    {
      code: code.searchParams.get('code') ?? '',
      codeVerifier: flow.codeVerifier,
      clientId: params.clientId,
      clientSecret: params.clientSecret,
    },
  );
  const userinfoResponse = await params.request.get(
    `${params.baseURL}/oauth/userinfo`,
    {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    },
  );
  expect(userinfoResponse.ok()).toBe(true);
  const userinfo = await userinfoResponse.json();
  expect(userinfo).toMatchObject({
    sub: params.expectedSub,
    email: params.email,
  });
  return userinfo;
}

test.describe('OIDC account selection', () => {
  test('smart-mode add-account continuation requires a fresh login before authorizing', async ({
    page,
    baseURL,
    browserName,
  }) => {
    await seedRememberedAccounts(page, String(baseURL));

    const flow = buildOAuthFlowInput('account-selection-smart-add-account', {
      prompt: undefined,
    });
    await gotoWithFirefoxRetry(
      page,
      browserName,
      buildAuthorizePath(flow.authorizeParams),
    );

    await expect(page).toHaveURL(/\/account\/select/);
    await page.getByRole('link', { name: /Use another account/i }).click();
    await expect(page).toHaveURL(/\/login/);

    const loginUrl = new URL(page.url());
    expect(loginUrl.searchParams.get('account_selected')).toBe('1');
    expect(loginUrl.searchParams.get('prompt')?.split(' ')).toContain('login');

    const authorizePath = `/oauth/authorize?${loginUrl.searchParams.toString()}`;
    await gotoWithFirefoxRetry(page, browserName, authorizePath);

    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).origin).toBe(String(baseURL));
  });

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

    const aliceAfterAdd = await authorizeSelectedAccount({
      page,
      request,
      baseURL: String(baseURL),
      browserName,
      state: 'account-selection-add-account-switch-back-alice',
      email: 'account-selection-alice@example.com',
      expectedSub: 'account-selection-alice',
    });
    expect(aliceAfterAdd).toMatchObject({
      sub: 'account-selection-alice',
      email: 'account-selection-alice@example.com',
    });

    const accountsAfterSwitchBackResponse = await page
      .context()
      .request.get(
        `${baseURL}/api/auth/accounts?client_id=${flow.authorizeParams.client_id}`,
      );
    expect(accountsAfterSwitchBackResponse.ok()).toBe(true);
    const accountsAfterSwitchBack =
      await accountsAfterSwitchBackResponse.json();
    expect(accountsAfterSwitchBack.accounts).toHaveLength(3);
    expect(
      accountsAfterSwitchBack.accounts.map(
        (account: { sub: string }) => account.sub,
      ),
    ).toEqual(
      expect.arrayContaining([
        'account-selection-alice',
        'account-selection-bob',
        'account-selection-carol',
      ]),
    );
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

  test('same OIDC client can add B then switch A-B-A without losing remembered accounts', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    await seedRememberedAccounts(page, String(baseURL));

    const alice = await authorizeSelectedAccount({
      page,
      request,
      baseURL: String(baseURL),
      browserName,
      state: 'account-selection-switch-alice-first',
      email: 'account-selection-alice@example.com',
      expectedSub: 'account-selection-alice',
    });
    const bob = await authorizeSelectedAccount({
      page,
      request,
      baseURL: String(baseURL),
      browserName,
      state: 'account-selection-switch-bob-second',
      email: 'account-selection-bob@example.com',
      expectedSub: 'account-selection-bob',
    });
    const aliceAgain = await authorizeSelectedAccount({
      page,
      request,
      baseURL: String(baseURL),
      browserName,
      state: 'account-selection-switch-alice-third',
      email: 'account-selection-alice@example.com',
      expectedSub: 'account-selection-alice',
    });

    expect([alice.sub, bob.sub, aliceAgain.sub]).toEqual([
      'account-selection-alice',
      'account-selection-bob',
      'account-selection-alice',
    ]);

    const accountsResponse = await page
      .context()
      .request.get(
        `${baseURL}/api/auth/accounts?client_id=${E2E_TEST_CLIENT_CONFIG.client_id}`,
      );
    expect(accountsResponse.ok()).toBe(true);
    const accounts = await accountsResponse.json();
    expect(
      accounts.accounts.map((account: { sub: string }) => account.sub),
    ).toEqual(['account-selection-alice', 'account-selection-bob']);
    expect(accounts.accounts).toHaveLength(2);
  });

  test('client always-mode redirects immediately after fresh password login', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    const flow = buildOAuthFlowInput('account-selection-always-fresh-login', {
      client_id: ALWAYS_CLIENT.client_id,
      prompt: undefined,
    });

    await gotoWithFirefoxRetry(
      page,
      browserName,
      buildAuthorizePath(flow.authorizeParams),
    );
    await expect(page).toHaveURL(/\/login/);
    await page.locator('a[href^="/login/password"]').click();
    await expect(page).toHaveURL(/\/login\/password/);

    const callbackRoute = `${E2E_TEST_CLIENT.redirectUri}**`;
    const callbackRouteHandler = async (
      route: import('@playwright/test').Route,
    ) => {
      await route.fulfill({
        body: 'Mock OAuth client callback captured',
        contentType: 'text/plain',
        status: 200,
      });
    };
    await page.route(callbackRoute, callbackRouteHandler);
    const redirectPromise = page.waitForRequest(
      (clientRequest) =>
        clientRequest.url().startsWith(E2E_TEST_CLIENT.redirectUri),
      { timeout: 5_000 },
    );

    await page
      .locator('input[name="email"]')
      .fill('account-selection-alice@example.com');
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click({ noWaitAfter: true });

    const redirect = new URL((await redirectPromise).url());
    await page.unroute(callbackRoute, callbackRouteHandler);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(page.url()).not.toContain('/account/select');

    const tokenResponse = await exchangeAuthorizationCode(
      request,
      String(baseURL),
      {
        code: redirect.searchParams.get('code') ?? '',
        codeVerifier: flow.codeVerifier,
        clientId: ALWAYS_CLIENT.client_id,
        clientSecret: ALWAYS_CLIENT.client_secret,
      },
    );
    const userinfoResponse = await request.get(`${baseURL}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });
    expect(userinfoResponse.ok()).toBe(true);
    expect(await userinfoResponse.json()).toMatchObject({
      sub: 'account-selection-alice',
      email: 'account-selection-alice@example.com',
    });
  });

  test('client never-mode ignores prompt=select_account chooser and issues tokens for the fresh login account', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    await seedRememberedAccounts(page, String(baseURL));

    const flow = buildOAuthFlowInput('account-selection-never-fresh-login', {
      client_id: NEVER_CLIENT.client_id,
      prompt: 'select_account',
    });
    await gotoWithFirefoxRetry(
      page,
      browserName,
      buildAuthorizePath(flow.authorizeParams),
    );

    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).not.toContain('/account/select');
    await page.locator('a[href^="/login/password"]').click();
    await expect(page).toHaveURL(/\/login\/password/);

    const callbackRoute = `${E2E_TEST_CLIENT.redirectUri}**`;
    const callbackRouteHandler = async (
      route: import('@playwright/test').Route,
    ) => {
      await route.fulfill({
        body: 'Mock OAuth client callback captured',
        contentType: 'text/plain',
        status: 200,
      });
    };
    await page.route(callbackRoute, callbackRouteHandler);
    const redirectPromise = page.waitForRequest(
      (clientRequest) =>
        clientRequest.url().startsWith(E2E_TEST_CLIENT.redirectUri),
      { timeout: 5_000 },
    );

    await page
      .locator('input[name="email"]')
      .fill('account-selection-carol@example.com');
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click({ noWaitAfter: true });

    const redirect = new URL((await redirectPromise).url());
    await page.unroute(callbackRoute, callbackRouteHandler);
    expect(redirect.searchParams.get('code')).toBeTruthy();
    expect(page.url()).not.toContain('/account/select');

    const tokenResponse = await exchangeAuthorizationCode(
      request,
      String(baseURL),
      {
        code: redirect.searchParams.get('code') ?? '',
        codeVerifier: flow.codeVerifier,
        clientId: NEVER_CLIENT.client_id,
        clientSecret: NEVER_CLIENT.client_secret,
      },
    );
    const userinfoResponse = await request.get(`${baseURL}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });
    expect(userinfoResponse.ok()).toBe(true);
    expect(await userinfoResponse.json()).toMatchObject({
      sub: 'account-selection-carol',
      email: 'account-selection-carol@example.com',
    });
  });

  test('client always-mode shows chooser for a promptless relogin with one remembered account', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    await loginByApi(
      page,
      String(baseURL),
      'account-selection-alice@example.com',
    );

    const userinfo = await authorizeSelectedAccount({
      page,
      request,
      baseURL: String(baseURL),
      browserName,
      state: 'account-selection-always-promptless-single-account',
      email: 'account-selection-alice@example.com',
      expectedSub: 'account-selection-alice',
      clientId: ALWAYS_CLIENT.client_id,
      clientSecret: ALWAYS_CLIENT.client_secret,
      omitPrompt: true,
    });

    expect(userinfo).toMatchObject({
      sub: 'account-selection-alice',
      email: 'account-selection-alice@example.com',
    });
  });
});
