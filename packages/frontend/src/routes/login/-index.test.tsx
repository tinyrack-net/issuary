import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import {
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  authorizationContextQueryData,
  renderRoute,
} from '#frontend/test-utils/route-test-utils.tsx';

const webauthnMocks = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => webauthnMocks);

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
      enabled: true,
    },
  },
  identity_providers: [
    {
      id: 'github',
      type: 'github',
      display_name: 'GitHub',
    },
  ],
  account_deletion: {
    enabled: true,
    retention: 'P30D',
  },
} satisfies AppConfigs;

const oauthSearch = {
  client_id: 'client-web',
  redirect_uri: 'https://client.example/callback',
  response_type: 'code',
  scope: 'openid',
};

const oauthLocation =
  '/login?client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&code_challenge=challenge&code_challenge_method=S256';

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

afterEach(() => {
  webauthnMocks.startAuthentication.mockReset();
  resetFetchMock();
});

describe('/login', () => {
  test('shows configured OAuth, password, and passkey auth methods', async () => {
    const { screen } = await renderRoute({
      initialLocation: oauthLocation,
      queryData: seedOAuthRouteData(),
    });

    await expect
      .element(screen.getByTestId('authorization-context'))
      .toBeVisible();

    await expect
      .element(screen.getByRole('link', { name: 'GitHub' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Email' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Passkey' }))
      .toBeVisible();

    const githubLink = screen.getByRole('link', { name: 'GitHub' }).element();
    expect(githubLink.getAttribute('href')).toContain(
      '/api/oauth/github/authorize?mode=login',
    );
    expect(githubLink.getAttribute('href')).toContain(
      'return_url=%2Foauth%2Fauthorize%3Fclient_id%3Dclient-web',
    );

    const passwordLink = screen.getByRole('link', { name: 'Email' }).element();
    expect(passwordLink.getAttribute('href')).toContain('/login/password?');
    expect(passwordLink.getAttribute('href')).toContain('client_id=client-web');
    expect(passwordLink.getAttribute('href')).toContain(
      'code_challenge=challenge',
    );
  });

  test('skips the method picker when email password is the only login method', async () => {
    const passwordOnlyConfig = {
      ...baseConfig,
      auth: {
        ...baseConfig.auth,
        passkey: {
          enabled: false,
        },
      },
      identity_providers: [],
    } satisfies AppConfigs;

    const { router } = await renderRoute({
      initialLocation: '/login',
      queryData: seedConfig(passwordOnlyConfig),
    });

    expect(router.state.location.pathname).toBe('/login/password');
  });

  test('hides disabled password auth while keeping enabled passkey auth available', async () => {
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
      initialLocation: '/login',
      queryData: seedConfig(passwordDisabledConfig),
    });

    await expect
      .element(screen.getByRole('button', { name: 'Passkey' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Email' }))
      .not.toBeInTheDocument();
  });

  test('shows guidance when passkey sign in fails from the login page', async () => {
    const passkeyError = new Error('not allowed');
    passkeyError.name = 'NotAllowedError';
    webauthnMocks.startAuthentication.mockRejectedValue(passkeyError);
    mockJsonResponses({
      url: '/api/auth/passkey/options',
      method: 'POST',
      body: {
        options: {
          challenge: 'challenge',
          rpId: 'localhost',
          allowCredentials: [],
        },
      },
    });

    const { screen } = await renderRoute({
      initialLocation: '/login',
      queryData: seedConfig(),
    });

    await screen.getByRole('button', { name: 'Passkey' }).click();

    await expect
      .element(
        screen.getByText(
          'Passkey sign in could not be completed. In-app browsers may block passkeys. Try again or sign in with email.',
        ),
      )
      .toBeVisible();
  });
});
