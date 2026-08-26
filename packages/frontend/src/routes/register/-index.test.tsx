import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { getTermsQueryOptions } from '#frontend/queries/terms.ts';
import {
  type CapturedFetchRequest,
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  authorizationContextQueryData,
  renderRoute,
} from '#frontend/test-utils/route-test-utils.tsx';

const baseConfig = {
  i18n: {
    supported_languages: ['en'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    icon_url: '',
    title: {},
  },
  registration: {
    public_registration: true,
    email_pattern_filter_enabled: false,
    email_verification_required: true,
    signup_notice: {},
  },
  database: {
    enabled: true,
  },
  email: {
    enabled: true,
  },
  admin: {
    enabled: true,
  },
  auth: {
    password: {
      enabled: true,
      two_factor: {
        enrollment_required: false,
      },
      totp: {
        enabled: true,
        issuer: 'Issuary',
      },
      policy: {
        min_length: 8,
        max_length: 64,
      },
    },
    passkey: {
      enabled: false,
    },
  },
  identity_providers: [],
  account_deletion: {
    enabled: true,
    retention: 'P30D',
  },
} satisfies AppConfigs;

const oauthLocation =
  '/register?client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&code_challenge=challenge&code_challenge_method=S256';

const oauthSearch = {
  client_id: 'client-web',
  redirect_uri: 'https://client.example/callback',
  response_type: 'code',
  scope: 'openid',
};

function seedRouteData(config: AppConfigs = baseConfig) {
  return [
    {
      queryKey: appConfigQueryOptions.queryKey,
      data: config,
    },
    {
      queryKey: getTermsQueryOptions('en').queryKey,
      data: {
        terms: [],
      },
    },
  ];
}

function seedOAuthRouteData(config: AppConfigs = baseConfig) {
  return [...seedRouteData(config), authorizationContextQueryData(oauthSearch)];
}

function authResponse() {
  return {
    user: {
      id: 'user-1',
      email: 'alice@example.com',
      name: null,
      picture: null,
      email_verified: false,
      email_verification_required: true,
      second_factor_required: true,
      totp_registered: false,
      passkey_count: 0,
      password_editable: true,
      oauth_accounts: [],
      deleted_at: null,
    },
  };
}

function firstRequest(requests: CapturedFetchRequest[]) {
  const request = requests[0];

  if (!request) {
    throw new Error('Expected fetch to be called');
  }

  return request;
}

function jsonRequestBody(request: CapturedFetchRequest) {
  if (typeof request.body !== 'string') {
    throw new Error('Expected request body to be serialized JSON');
  }

  return JSON.parse(request.body);
}

async function submitRegister(
  screen: Awaited<ReturnType<typeof renderRoute>>['screen'],
) {
  await screen.getByPlaceholder('hello@example.com').fill('alice@example.com');
  await screen.getByPlaceholder('Enter your password').fill('password-123');
  await screen.getByRole('button', { name: 'Create account' }).click();
}

afterEach(() => {
  resetFetchMock();
});

describe('/register', () => {
  test('navigates to email verification after registration while preserving OAuth params', async () => {
    const fetchMock = mockJsonResponses({
      url: '/api/auth/register',
      method: 'POST',
      body: authResponse(),
    });

    const { router, screen } = await renderRoute({
      initialLocation: oauthLocation,
      queryData: seedOAuthRouteData(),
    });

    await expect
      .element(screen.getByTestId('authorization-context'))
      .toBeVisible();

    await submitRegister(screen);

    await vi.waitFor(() => {
      expect(fetchMock.requests).toHaveLength(1);
    });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/auth/register');
    expect(request.method).toBe('POST');
    expect(jsonRequestBody(request)).toEqual({
      email: 'alice@example.com',
      password: 'password-123',
    });

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/verify/email');
      expect(router.state.location.search).toMatchObject({
        client_id: 'client-web',
        redirect_uri: 'https://client.example/callback',
        response_type: 'code',
        scope: 'openid',
        state: 'state-123',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        email: 'alice@example.com',
      });
    });
  });

  test('hides the registration form when password authentication is disabled', async () => {
    const passwordDisabledConfig = {
      ...baseConfig,
      auth: {
        ...baseConfig.auth,
        password: {
          ...baseConfig.auth.password,
          enabled: false,
        },
      },
    } satisfies AppConfigs;

    const { screen } = await renderRoute({
      initialLocation: '/register',
      queryData: seedRouteData(passwordDisabledConfig),
    });

    await expect
      .element(screen.getByRole('button', { name: 'Create account' }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByPlaceholder('Enter your password'))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('link', { name: 'Sign in' }))
      .toBeVisible();
  });
});
