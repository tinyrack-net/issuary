import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { AuthResponse } from '#frontend/queries/session.ts';
import {
  type CapturedFetchRequest,
  mockJsonError,
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  authorizationContextQueryData,
  renderRoute,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';

const baseConfig = {
  i18n: {
    supported_languages: ['en'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    background_url: '',
    icon_url: '',
    title: {},
    subtitle: {},
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
        enabled: false,
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
  '/login/password?client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&nonce=nonce-123&code_challenge=challenge&code_challenge_method=S256';

const oauthSearch = {
  client_id: 'client-web',
  redirect_uri: 'https://client.example/callback',
  response_type: 'code',
  scope: 'openid',
};

function seedConfig(config: AppConfigs = baseConfig) {
  return [
    {
      queryKey: appConfigQueryOptions.queryKey,
      data: config,
    },
  ];
}

function seedOAuthRouteData(config: AppConfigs = baseConfig) {
  return [...seedConfig(config), authorizationContextQueryData(oauthSearch)];
}

function authResponse(): AuthResponse {
  return {
    user: {
      ...routeTestUser,
      email: 'alice@example.com',
      email_verified: false,
      email_verification_required: true,
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

async function submitPasswordLogin(
  screen: Awaited<ReturnType<typeof renderRoute>>['screen'],
) {
  await screen.getByPlaceholder('hello@example.com').fill('alice@example.com');
  await screen.getByPlaceholder('Enter your password').fill('password-123');
  await screen.getByRole('button', { name: 'Log in' }).click();
}

afterEach(() => {
  resetFetchMock();
});

describe('/login/password', () => {
  test('navigates to email verification after login while preserving OAuth params', async () => {
    const fetchMock = mockJsonResponses({
      url: '/api/auth/login',
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

    await submitPasswordLogin(screen);

    await vi.waitFor(() => {
      expect(fetchMock.requests).toHaveLength(1);
    });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/auth/login');
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
        nonce: 'nonce-123',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        email: 'alice@example.com',
      });
    });
  });

  test('displays API login errors on the password form', async () => {
    mockJsonError(
      {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      },
      401,
    );

    const { screen } = await renderRoute({
      initialLocation: '/login/password',
      queryData: seedConfig(),
    });

    await submitPasswordLogin(screen);

    await expect
      .element(
        screen.getByText('Login failed. Please check your email and password.'),
      )
      .toBeVisible();
  });

  test('hides password login form when password authentication is disabled', async () => {
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
      initialLocation: '/login/password',
      queryData: seedConfig(passwordDisabledConfig),
    });

    await expect
      .element(screen.getByRole('button', { name: 'Log in' }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByPlaceholder('Enter your password'))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('link', { name: 'Sign up' }))
      .toBeVisible();
  });

  test('hides registration link when public registration is disabled', async () => {
    const registrationDisabledConfig = {
      ...baseConfig,
      registration: {
        ...baseConfig.registration,
        public_registration: false,
      },
    } satisfies AppConfigs;

    const { screen } = await renderRoute({
      initialLocation: '/login/password',
      queryData: seedConfig(registrationDisabledConfig),
    });

    await expect
      .element(screen.getByRole('button', { name: 'Log in' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Sign up' }))
      .not.toBeInTheDocument();
  });
});
