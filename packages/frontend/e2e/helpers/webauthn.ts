import type { Page } from '@playwright/test';

type VirtualAuthenticatorHandle = {
  teardown: () => Promise<void>;
};

/**
 * Enables a Chromium virtual authenticator for passkey e2e tests.
 */
export async function enableVirtualAuthenticator(
  page: Page,
): Promise<VirtualAuthenticatorHandle> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');

  const { authenticatorId } = await cdp.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );

  return {
    teardown: async () => {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', {
        authenticatorId,
      });
      await cdp.send('WebAuthn.disable');
      await cdp.detach();
    },
  };
}
