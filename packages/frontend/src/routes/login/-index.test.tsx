import defaultIconUrl from '@tinyrack/ui/brand/apps/issuary-app-icon.svg';
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
    title: { en: 'Issuary' },
    subtitle: { en: 'Nice to meet you!' },
    login_method_description: {
      en: "Choose how you'd like to sign in.",
    },
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
  test('shows the brand subtitle and login method guidance', async () => {
    const { screen } = await renderRoute({
      initialLocation: '/login',
      queryData: seedConfig(),
    });

    const heading = screen.getByRole('heading', { level: 1, name: 'Issuary' });
    await expect.element(heading).toBeVisible();
    expect(
      heading
        .element()
        .parentElement?.querySelector('img')
        ?.getAttribute('src'),
    ).toBe(defaultIconUrl);
    expect(heading.element().parentElement?.classList).toContain(
      'justify-center',
    );
    await expect.element(screen.getByText('Nice to meet you!')).toBeVisible();
    await expect
      .element(screen.getByText("Choose how you'd like to sign in."))
      .toBeVisible();
  });

  test('uses a custom logo instead of the icon and text title', async () => {
    const logoConfig = {
      ...baseConfig,
      branding: {
        ...baseConfig.branding,
        icon_url: 'https://example.com/icon.svg',
        logo_url: defaultIconUrl,
      },
    } satisfies AppConfigs;

    const { screen } = await renderRoute({
      initialLocation: '/login',
      queryData: seedConfig(logoConfig),
    });

    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Issuary',
    });
    await expect.element(heading).toBeVisible();
    expect(heading.element().querySelector('img')?.getAttribute('src')).toBe(
      defaultIconUrl,
    );
    expect(heading.element().querySelector('img')?.classList).toContain(
      'object-center',
    );
    await expect.element(screen.getByText('Issuary')).not.toBeInTheDocument();
  });

  test('hides empty configurable login copy', async () => {
    const emptyCopyConfig = {
      ...baseConfig,
      branding: {
        ...baseConfig.branding,
        subtitle: { en: '' },
        login_method_description: { en: '' },
      },
    } satisfies AppConfigs;

    const { screen } = await renderRoute({
      initialLocation: '/login',
      queryData: seedConfig(emptyCopyConfig),
    });

    await expect
      .element(screen.getByText('Nice to meet you!'))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("Choose how you'd like to sign in."))
      .not.toBeInTheDocument();
  });

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

  test('shows the passkey loading spinner at the end of the method button', async () => {
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
    webauthnMocks.startAuthentication.mockImplementation(
      () => new Promise(() => undefined),
    );

    const { screen } = await renderRoute({
      initialLocation: '/login',
      queryData: seedConfig(),
    });
    const passkeyButton = screen.getByRole('button', { name: 'Passkey' });

    await passkeyButton.click();
    await expect.element(passkeyButton).toHaveAttribute('aria-busy', 'true');
    await expect.element(passkeyButton).toBeDisabled();

    const buttonElement = passkeyButton.element();
    const label = buttonElement.querySelector('.tr-text');
    const spinner = buttonElement.querySelector('.tr-spinner');

    expect(label).not.toBeNull();
    expect(spinner).not.toBeNull();
    expect(spinner?.getBoundingClientRect().left).toBeGreaterThan(
      label?.getBoundingClientRect().right ?? Number.POSITIVE_INFINITY,
    );
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
