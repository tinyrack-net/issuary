import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  mockJsonError,
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
  '/verify/email?token=email-token&email=alice%40example.com&client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&nonce=nonce-123&code_challenge=challenge&code_challenge_method=S256';

afterEach(() => {
  resetFetchMock();
});

describe('/verify/email', () => {
  test('continues to 2FA setup after email verification while preserving OAuth params', async () => {
    mockJsonSuccess({
      user: {
        ...routeTestUser,
        email_verified: true,
        second_factor_required: true,
      },
    });

    const { router, screen } = await renderRoute({
      initialLocation: oauthLocation,
      queryData: [appConfigQueryData(routeTestAppConfig)],
    });

    await screen.getByRole('button', { name: 'Verify' }).click();

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/setup/2fa');
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

  test('shows a recoverable invalid-token error without leaving the route', async () => {
    mockJsonError(
      {
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'Invalid token',
      },
      400,
    );

    const { router, screen } = await renderRoute({
      initialLocation:
        '/verify/email?token=bad-token&email=alice%40example.com',
      queryData: [appConfigQueryData(routeTestAppConfig)],
    });

    await screen.getByRole('button', { name: 'Verify' }).click();

    await expect
      .element(screen.getByText('Invalid or expired token'))
      .toBeVisible();
    expect(router.state.location.pathname).toBe('/verify/email');
  });
});
