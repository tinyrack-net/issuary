import { expect } from '@playwright/test';
import { genericOAuth } from '@tinyrack/issuary-server/identity-providers/generic-oauth';
import { z } from 'zod';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { startOAuthLogin } from '#frontend-e2e/helpers/oauth.ts';
import { registerPage } from '#frontend-e2e/helpers/register-page.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

const TEST_PASSWORD = 'test-password-123';
const EXISTING_COMPLETE_EMAIL = 'oauth-stub-existing-complete@allowed.test';
const OAUTH_EXISTING_PENDING_EMAIL = 'oauth-stub-existing-pending@allowed.test';

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

const test = createScenarioFixture((backendPort) => {
  const host = `http://localhost:${backendPort}`;

  return {
    ...E2E_BASE_CONFIG,
    ...createTestConfig(backendPort, {
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
    }),
    identity_providers: [
      genericOAuth({
        id: 'stub-new-user',
        enabled: true,
        display_name: 'Stub New User',
        icon_url: 'https://example.com/stub-new-user.svg',
        client_id: 'stub-new-user-client-id',
        client_secret: 'stub-new-user-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-new-user/authorize`,
        token_url: `${host}/test/oauth-stub/stub-new-user/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-new-user/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      }),
      genericOAuth({
        id: 'stub-existing-pending',
        enabled: true,
        display_name: 'Stub Existing Pending',
        icon_url: 'https://example.com/stub-existing-pending.svg',
        client_id: 'stub-existing-pending-client-id',
        client_secret: 'stub-existing-pending-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-existing-pending/authorize`,
        token_url: `${host}/test/oauth-stub/stub-existing-pending/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-existing-pending/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      }),
      genericOAuth({
        id: 'stub-existing-complete',
        enabled: true,
        display_name: 'Stub Existing Complete',
        icon_url: 'https://example.com/stub-existing-complete.svg',
        client_id: 'stub-existing-complete-client-id',
        client_secret: 'stub-existing-complete-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-existing-complete/authorize`,
        token_url: `${host}/test/oauth-stub/stub-existing-complete/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-existing-complete/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      }),
    ],
    terms: [...TERMS_CONFIG],
    users: [
      {
        sub: 'oauth-existing-pending',
        email: OAUTH_EXISTING_PENDING_EMAIL,
        password: 'changemelater',
        role: 'admin',
      },
    ],
  };
});

const consentPayloadSchema = z.object({
  consents: z.array(
    z.object({
      termsId: z.string(),
      agreed: z.boolean(),
      consentType: z.enum(['explicit', 'implicit']).optional(),
    }),
  ),
  registrationToken: z.string().uuid().optional(),
});

async function registerUserWithTerms(
  baseURL: string,
  email: string,
): Promise<void> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const registerRes = await client.api.auth.register.$post({
    header: {},
    json: {
      email,
      password: TEST_PASSWORD,
      consents: [
        { termsId: 'tos', agreed: true },
        { termsId: 'privacy', agreed: true },
      ],
    },
  });

  if (!registerRes.ok) {
    throw new Error(`Failed to register user: ${registerRes.status}`);
  }
}

test.describe('OAuth branching with explicit and implicit terms', () => {
  test('new OAuth user completes registration through terms flow', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Stub New User');

    await page.waitForURL('**/terms**');
    const termsUrl = new URL(page.url());
    expect(termsUrl.pathname).toBe('/terms');
    expect(termsUrl.searchParams.get('mode')).toBe('complete_registration');
    expect(termsUrl.searchParams.get('registration_token')).toBeTruthy();

    const consentRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes('/api/terms/consent'),
    );

    // First checkbox is "Agree all", second is required TOS term.
    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator('button[type="submit"]').click();

    const consentRequest = await consentRequestPromise;
    const body = consentRequest.postData();
    if (!body) {
      throw new Error('Expected terms consent request body');
    }

    const payload = consentPayloadSchema.parse(JSON.parse(body));
    expect(payload.registrationToken).toBeTruthy();
    expect(payload.consents).toEqual(
      expect.arrayContaining([
        { termsId: 'tos', agreed: true, consentType: 'explicit' },
        { termsId: 'privacy', agreed: false, consentType: 'explicit' },
        { termsId: 'analytics', agreed: true, consentType: 'implicit' },
      ]),
    );

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('existing OAuth user with pending required terms is redirected to /terms', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Stub Existing Pending');

    await page.waitForURL('**/terms**');
    const termsUrl = new URL(page.url());
    expect(termsUrl.pathname).toBe('/terms');
    expect(termsUrl.searchParams.get('mode')).toBeNull();
    expect(termsUrl.searchParams.get('registration_token')).toBeNull();

    await page.locator(registerPage.termsCheckbox).nth(1).check();
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('existing OAuth user with completed terms logs in directly', async ({
    page,
    baseURL,
  }) => {
    await registerUserWithTerms(String(baseURL), EXISTING_COMPLETE_EMAIL);

    await page.goto('/login');
    await startOAuthLogin(page, 'Stub Existing Complete');

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText(EXISTING_COMPLETE_EMAIL).first()).toBeVisible();
  });
});
