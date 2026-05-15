import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  appConfigQueryData,
  renderRoute,
  routeTestAppConfig,
} from '#frontend/test-utils/route-test-utils.tsx';

const webAuthnMocks = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => webAuthnMocks);

const oauthLocation =
  '/setup/passkey?passkey_name=default&client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&code_challenge=challenge&code_challenge_method=S256';

afterEach(() => {
  webAuthnMocks.startRegistration.mockReset();
  resetFetchMock();
});

describe('/setup/passkey', () => {
  test('shows registration failure and keeps OAuth params available for recovery navigation', async () => {
    const cancelledError = new Error('cancelled');
    cancelledError.name = 'NotAllowedError';
    webAuthnMocks.startRegistration.mockRejectedValue(cancelledError);
    const fetchMock = mockJsonResponses({
      url: '/api/user/passkeys/register/options',
      method: 'POST',
      body: {
        options: {
          challenge: 'challenge',
          rp: { name: 'TinyAuth', id: 'localhost' },
          user: {
            id: 'user-1',
            name: 'alice@example.com',
            displayName: 'Alice',
          },
          pubKeyCredParams: [],
        },
      },
    });

    const { screen } = await renderRoute({
      initialLocation: oauthLocation,
      queryData: [appConfigQueryData(routeTestAppConfig)],
    });

    await expect
      .element(screen.getByText('Passkey registration was cancelled.'))
      .toBeVisible();

    const backLink = screen
      .getByRole('link', { name: 'Back to login' })
      .element();
    expect(backLink.getAttribute('href')).toContain('/login?');
    expect(backLink.getAttribute('href')).toContain('client_id=client-web');
    expect(backLink.getAttribute('href')).toContain('state=state-123');
    expect(backLink.getAttribute('href')).toContain('code_challenge=challenge');
    expect(fetchMock.requests).toHaveLength(1);
  });
});
