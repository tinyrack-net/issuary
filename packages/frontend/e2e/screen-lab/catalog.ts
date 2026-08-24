import type { Page } from '@playwright/test';
import { createProxyHandler } from '@tinyrack/issuary-server/frontend/proxy';
import {
  type ServerScreenScenarioId,
  screenScenarioDefinitions,
} from '#frontend/test-utils/screen-scenario-catalog.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
  type E2EConfigInput,
} from '#frontend-e2e/fixtures/index.ts';
import { registerUserViaApi } from '#frontend-e2e/helpers/account.ts';
import { buildOAuthAuthorizeUrl } from '#frontend-e2e/helpers/consent.ts';
import { performLogin } from '#frontend-e2e/helpers/login.ts';
import { setupTotpViaTestApi } from '#frontend-e2e/helpers/totp.ts';
import type {
  ScreenScenario,
  ScreenScenarioConfigFactory,
  ServerScreenScenarioAdapter,
  ServerScreenScenarioContext,
} from '#frontend-e2e/screen-lab/types.ts';

const SCREEN_USER = E2E_TEST_USER;
const SCREEN_USER_CONFIG = E2E_TEST_USER_CONFIG;
const SCREEN_SECOND_USER = {
  sub: 'screen-lab-second-user',
  email: 'screen-lab-second@example.com',
  password: E2E_TEST_USER.password,
  role: 'user',
} satisfies NonNullable<E2EConfigInput['users']>[number];
const SCREEN_TOTP_EMAIL = 'screen-lab-totp@example.com';

function createScreenConfig(
  overrides: Partial<E2EConfigInput> = {},
): ScreenScenarioConfigFactory {
  return (backendPort, frontendPort) => {
    const { branding, ...restOverrides } = overrides;
    return {
      ...E2E_BASE_CONFIG,
      ...createTestConfig(backendPort, {
        ...restOverrides,
        branding: branding ?? {
          background_url: `http://127.0.0.1:${backendPort}/test/screen-lab-background.svg`,
        },
      }),
      frontend: createProxyHandler({
        upstream: `http://127.0.0.1:${frontendPort}`,
      }),
    };
  };
}

function createScreenConfigWithRecords(
  options: {
    overrides?: Partial<E2EConfigInput>;
    users?: E2EConfigInput['users'];
    clients?: E2EConfigInput['clients'];
  } = {},
): ScreenScenarioConfigFactory {
  const configFactory = createScreenConfig(options.overrides);
  return (backendPort, frontendPort, auxiliaryPort) => ({
    ...configFactory(backendPort, frontendPort, auxiliaryPort),
    ...(options.users ? { users: options.users } : {}),
    ...(options.clients ? { clients: options.clients } : {}),
  });
}

async function gotoAndWait(
  page: Page,
  path: string,
  selector: string,
): Promise<void> {
  await page.goto(path);
  await page.locator(selector).first().waitFor({ state: 'visible' });
}

async function loginAndOpen({
  page,
  scenario,
}: ServerScreenScenarioContext): Promise<void> {
  await performLogin(page, SCREEN_USER.email, SCREEN_USER.password);
  await page.waitForURL('**/profile');
  await gotoAndWait(page, scenario.entryPath, scenario.readySelector);
}

async function loginViaApi(
  page: Page,
  baseURL: string,
  email: string,
): Promise<void> {
  const response = await page
    .context()
    .request.post(`${baseURL}/api/auth/login`, {
      data: { email, password: SCREEN_USER.password },
      headers: { Origin: baseURL },
    });
  if (!response.ok()) {
    throw new Error(
      `Screen Lab login failed: ${response.status()} ${await response.text()}`,
    );
  }
}

const accountConfig = createScreenConfigWithRecords({
  overrides: {
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
  },
  users: [SCREEN_USER_CONFIG],
});

export const serverScreenScenarioAdapters = {
  profile: {
    config: accountConfig,
    prepare: loginAndOpen,
  },
  'admin-users': {
    config: createScreenConfigWithRecords({
      overrides: { admin: { enabled: true } },
      users: [SCREEN_USER_CONFIG, SCREEN_SECOND_USER],
    }),
    prepare: loginAndOpen,
  },
  'oauth-consent': {
    config: createScreenConfigWithRecords({
      users: [SCREEN_USER_CONFIG],
      clients: [E2E_TEST_CLIENT_CONFIG],
    }),
    prepare: async ({ page, scenario }) => {
      await performLogin(page, SCREEN_USER.email, SCREEN_USER.password);
      await page.waitForURL('**/profile');
      await gotoAndWait(page, buildOAuthAuthorizeUrl(), scenario.readySelector);
    },
  },
  'account-selection': {
    config: createScreenConfigWithRecords({
      overrides: {
        auth: {
          account_selection: {
            enabled: true,
            mode: 'always',
            allow_add_account: true,
            allow_remove_account: true,
            remember_accounts: {
              enabled: true,
              max_accounts: 5,
              ttl: '30d',
            },
          },
        },
      },
      users: [SCREEN_USER_CONFIG, SCREEN_SECOND_USER],
      clients: [E2E_TEST_CLIENT_CONFIG],
    }),
    prepare: async ({ baseURL, page, scenario }) => {
      await loginViaApi(page, baseURL, SCREEN_USER.email);
      await loginViaApi(page, baseURL, SCREEN_SECOND_USER.email);
      await gotoAndWait(
        page,
        buildOAuthAuthorizeUrl({ prompt: 'select_account' }),
        scenario.readySelector,
      );
    },
  },
  'totp-verification': {
    config: createScreenConfig({
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
      auth: {
        password: {
          two_factor: { enrollment_required: true },
          totp: { enabled: true },
        },
      },
    }),
    prepare: async ({ baseURL, page, scenario }) => {
      await registerUserViaApi(baseURL, {
        email: SCREEN_TOTP_EMAIL,
        password: SCREEN_USER.password,
      });
      await setupTotpViaTestApi(baseURL, SCREEN_TOTP_EMAIL);
      await performLogin(page, SCREEN_TOTP_EMAIL, SCREEN_USER.password);
      await page.waitForURL(`**${scenario.entryPath}`);
      await page
        .locator(scenario.readySelector)
        .first()
        .waitFor({ state: 'visible' });
    },
  },
  'totp-setup': {
    config: createScreenConfig({
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
      auth: {
        password: {
          two_factor: { enrollment_required: true },
          totp: { enabled: true },
        },
      },
    }),
    prepare: async ({ baseURL, page, scenario }) => {
      const email = 'screen-lab-totp-setup@example.com';
      await registerUserViaApi(baseURL, {
        email,
        password: SCREEN_USER.password,
      });
      await performLogin(page, email, SCREEN_USER.password);
      await page.waitForURL(`**${scenario.entryPath}`);
      await page.locator(scenario.readySelector).waitFor({ state: 'visible' });
    },
  },
  'passkey-setup': {
    config: createScreenConfig({
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
      auth: {
        password: {
          two_factor: { enrollment_required: true },
        },
        passkey: { enabled: true },
      },
    }),
    prepare: async ({ baseURL, page, scenario }) => {
      const email = 'screen-lab-passkey-setup@example.com';
      await registerUserViaApi(baseURL, {
        email,
        password: SCREEN_USER.password,
      });
      await performLogin(page, email, SCREEN_USER.password);
      await page.waitForURL(`**${scenario.entryPath}**`);
      await gotoAndWait(page, scenario.entryPath, scenario.readySelector);
    },
  },
} satisfies Record<ServerScreenScenarioId, ServerScreenScenarioAdapter>;

function createScreenScenario(
  definition: (typeof screenScenarioDefinitions)[number],
): ScreenScenario {
  if (definition.runtime === 'route') {
    return definition;
  }

  return {
    ...definition,
    ...serverScreenScenarioAdapters[definition.id],
  };
}

export const screenScenarios: readonly ScreenScenario[] =
  screenScenarioDefinitions.map(createScreenScenario);

export function findScreenScenario(id: string): ScreenScenario | undefined {
  return screenScenarios.find((scenario) => scenario.id === id);
}
