import { afterEach, describe, expect, test, vi } from 'vitest';
import { oauthAccountsQueryOptions } from '#frontend/queries/oauth.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import {
  mockJsonSuccess,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  appConfigQueryData,
  renderRoute,
  routeTestAppConfig,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';

const oauthLocation =
  '/verify/totp?client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&nonce=nonce-123&code_challenge=challenge&code_challenge_method=S256';

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

async function fillTotpCode(
  screen: Awaited<ReturnType<typeof renderRoute>>['screen'],
  code: string,
) {
  const digits = code.split('');

  for (const [index, digit] of digits.entries()) {
    await screen.getByLabelText(`Digit ${index + 1} of 6`).fill(digit);
  }
}

afterEach(() => {
  resetFetchMock();
});

describe('/verify/totp', () => {
  test('continues to profile after successful TOTP verification', async () => {
    mockJsonSuccess({
      user: {
        ...routeTestUser,
        totp_registered: true,
      },
    });

    const { router, screen } = await renderRoute({
      initialLocation: '/verify/totp',
      queryData: profileQueryData(),
      user: routeTestUser,
    });

    await fillTotpCode(screen, '123456');

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/profile');
    });
  });

  test('preserves OAuth params when switching to recovery-code verification', async () => {
    const { router, screen } = await renderRoute({
      initialLocation: oauthLocation,
      queryData: [appConfigQueryData(routeTestAppConfig)],
    });

    await screen.getByRole('button', { name: 'Use a recovery code' }).click();

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/verify/totp/recovery');
      expect(router.state.location.search).toMatchObject({
        client_id: 'client-web',
        redirect_uri: 'https://client.example/callback',
        response_type: 'code',
        scope: 'openid',
        state: 'state-123',
        nonce: 'nonce-123',
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
      });
    });
  });
});
