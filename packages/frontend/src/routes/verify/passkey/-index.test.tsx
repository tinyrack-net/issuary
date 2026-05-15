import { startAuthentication } from '@simplewebauthn/browser';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { oauthAccountsQueryOptions } from '#frontend/queries/oauth.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import {
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  appConfigQueryData,
  renderRoute,
  routeTestAppConfig,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

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
  vi.mocked(startAuthentication).mockReset();
  resetFetchMock();
});

describe('/verify/passkey', () => {
  test('continues to profile after successful passkey verification', async () => {
    vi.mocked(startAuthentication).mockResolvedValue({
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
      {
        url: '/api/auth/session',
        method: 'GET',
        body: {
          user: routeTestUser,
        },
      },
    );

    const { router } = await renderRoute({
      initialLocation: '/verify/passkey',
      queryData: profileQueryData(),
      user: routeTestUser,
    });

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/profile');
    });
    expect(fetchMock.requests).toHaveLength(3);
  });
});
