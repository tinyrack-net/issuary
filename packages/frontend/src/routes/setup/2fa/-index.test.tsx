import { describe, expect, test } from 'vitest';
import type { AppConfigs } from '#frontend/queries/config.ts';
import {
  appConfigQueryData,
  renderRoute,
  routeTestAppConfig,
} from '#frontend/test-utils/route-test-utils.tsx';

const oauthLocation =
  '/setup/2fa?client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&code_challenge=challenge&code_challenge_method=S256';

describe('/setup/2fa', () => {
  test('shows only setup methods enabled by config and keeps OAuth params on links', async () => {
    const passkeyOnlyConfig = {
      ...routeTestAppConfig,
      auth: {
        ...routeTestAppConfig.auth,
        password: {
          ...routeTestAppConfig.auth.password,
          totp: {
            ...routeTestAppConfig.auth.password.totp,
            enabled: false,
          },
        },
        passkey: {
          enabled: true,
        },
      },
    } satisfies AppConfigs;

    const { screen } = await renderRoute({
      initialLocation: oauthLocation,
      queryData: [appConfigQueryData(passkeyOnlyConfig)],
    });

    await expect
      .element(screen.getByRole('link', { name: /Passkey/ }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: /Authenticator App/ }))
      .not.toBeInTheDocument();

    const passkeyLink = screen.getByRole('link', { name: /Passkey/ }).element();
    expect(passkeyLink.getAttribute('href')).toContain('/setup/passkey?');
    expect(passkeyLink.getAttribute('href')).toContain('client_id=client-web');
    expect(passkeyLink.getAttribute('href')).toContain('state=state-123');
    expect(passkeyLink.getAttribute('href')).toContain('passkey_name=default');
  });
});
