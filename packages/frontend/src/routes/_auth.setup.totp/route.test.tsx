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
  const inputs = screen.getByRole('textbox').all();

  for (const [index, digit] of digits.entries()) {
    await inputs[index].fill(digit);
  }
}

afterEach(() => {
  resetFetchMock();
});

describe('/setup/totp', () => {
  test('moves through QR, recovery, and profile continuation after successful setup', async () => {
    const fetchMock = mockJsonResponses(
      {
        url: '/api/user/totp/setup',
        method: 'POST',
        body: {
          qr_code: 'data:image/png;base64,qr-code',
          secret: 'JBSWY3DPEHPK3PXP',
        },
      },
      {
        url: '/api/user/totp/verify',
        method: 'POST',
        body: {
          recovery_codes: ['AAAA-BBBB', 'CCCC-DDDD'],
        },
      },
      {
        url: '/api/user/totp/confirm',
        method: 'POST',
        body: {
          user: {
            ...routeTestUser,
            totp_registered: true,
          },
        },
      },
      {
        url: '/api/auth/session',
        method: 'GET',
        body: {
          user: {
            ...routeTestUser,
            totp_registered: true,
          },
        },
      },
    );

    const { router, screen } = await renderRoute(routeDefinition, {
      initialLocation: '/setup/totp',
      queryData: profileQueryData(),
      user: routeTestUser,
    });

    await expect
      .element(screen.getByRole('button', { name: 'Next' }))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Next' }).click();
    await fillTotpCode(screen, '123456');

    await expect.element(screen.getByText('AAAA-BBBB')).toBeVisible();
    screen
      .getByTestId('recovery-codes-confirm')
      .element()
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    await expect
      .element(screen.getByTestId('recovery-codes-submit'))
      .not.toBeDisabled();
    await screen.getByTestId('recovery-codes-submit').click();

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/profile');
    });
    expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
    expect(fetchMock.requests.length).toBeLessThanOrEqual(4);
  });
});
