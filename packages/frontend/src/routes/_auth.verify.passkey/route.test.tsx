import { afterEach, describe, expect, test, vi } from 'vitest';
import { oauthAccountsQueryOptions } from '#frontend/queries/oauth.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import {
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  appConfigQueryData,
  defineRouteScreen,
  renderRoute,
  routeTestAppConfig,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';
import * as RouteModule from './route.tsx';

const routeDefinition = defineRouteScreen('auth', RouteModule);

const webauthnMocks = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => webauthnMocks);

function profileQueryData() {
  return [
    appConfigQueryData(routeTestAppConfig),
    {
      queryKey: getSessionQueryOptions.queryKey,
      data: { user: routeTestUser },
    },
    {
      queryKey: oauthAccountsQueryOptions.queryKey,
      data: {
        accounts: [],
        available_providers: [],
      },
    },
  ];
}

afterEach(() => {
  webauthnMocks.startAuthentication.mockReset();
  resetFetchMock();
});

describe('/verify/passkey', () => {
  test('continues to profile after successful passkey verification', async () => {
    webauthnMocks.startAuthentication.mockResolvedValue({
      id: 'credential-1',
      rawId: 'credential-1',
      response: {
        authenticatorData: 'authenticator-data',
        clientDataJSON: 'client-data-json',
        signature: 'signature',
        userHandle: 'user-1',
      },
      type: 'public-key',
      clientExtensionResults: {},
    });
    const fetchMock = mockJsonResponses(
      {
        url: '/api/auth/passkey/options',
        method: 'POST',
        body: {
          options: {
            challenge: 'challenge',
            rpId: 'localhost',
            allowCredentials: [],
          },
        },
      },
      {
        url: '/api/auth/passkey/verify',
        method: 'POST',
        body: {
          user: routeTestUser,
        },
      },
    );

    const { router } = await renderRoute(routeDefinition, {
      initialLocation: '/verify/passkey',
      queryData: profileQueryData(),
      user: routeTestUser,
    });

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/profile');
    });
    fetchMock.assertAllResponsesConsumed();
    expect(fetchMock.requests).toHaveLength(2);
  });

  test('shows TOTP fallback after passkey verification cannot complete', async () => {
    const passkeyError = new Error('not allowed');
    passkeyError.name = 'NotAllowedError';
    webauthnMocks.startAuthentication.mockRejectedValue(passkeyError);
    const fetchMock = mockJsonResponses(
      {
        url: '/api/auth/passkey/options',
        method: 'POST',
        body: {
          options: {
            challenge: 'challenge',
            rpId: 'localhost',
            allowCredentials: [],
          },
        },
      },
      {
        url: '/api/auth/2fa/methods',
        method: 'GET',
        body: {
          methods: ['totp', 'passkey'],
        },
      },
    );

    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: '/verify/passkey',
      queryData: profileQueryData(),
      user: routeTestUser,
    });

    await expect
      .element(
        screen.getByText(
          'Passkey verification could not be completed. In-app browsers may block passkeys.',
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Use authenticator app' }))
      .toBeVisible();
    expect(fetchMock.requests).toHaveLength(2);
  });

  test('keeps passkey-only failures on the passkey screen', async () => {
    const passkeyError = new Error('not allowed');
    passkeyError.name = 'NotAllowedError';
    webauthnMocks.startAuthentication.mockRejectedValue(passkeyError);
    const fetchMock = mockJsonResponses(
      {
        url: '/api/auth/passkey/options',
        method: 'POST',
        body: {
          options: {
            challenge: 'challenge',
            rpId: 'localhost',
            allowCredentials: [],
          },
        },
      },
      {
        url: '/api/auth/2fa/methods',
        method: 'GET',
        body: {
          methods: ['passkey'],
        },
      },
    );

    const { screen } = await renderRoute(routeDefinition, {
      initialLocation: '/verify/passkey',
      queryData: profileQueryData(),
      user: routeTestUser,
    });

    await expect
      .element(screen.getByRole('button', { name: 'Try again' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Use authenticator app' }))
      .not.toBeInTheDocument();
    expect(fetchMock.requests).toHaveLength(2);
  });
});
