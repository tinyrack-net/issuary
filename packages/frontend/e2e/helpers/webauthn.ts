import type { Page } from '@playwright/test';

type VirtualAuthenticatorHandle = {
  teardown: () => Promise<void>;
};

function isTargetClosedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('Target page, context or browser has been closed') ||
      error.message.includes('Session closed'))
  );
}

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
      try {
        await cdp.send('WebAuthn.removeVirtualAuthenticator', {
          authenticatorId,
        });
      } catch (error) {
        if (!isTargetClosedError(error)) {
          throw error;
        }
        return;
      }

      try {
        await cdp.send('WebAuthn.disable');
      } catch (error) {
        if (!isTargetClosedError(error)) {
          throw error;
        }
      }

      try {
        await cdp.detach();
      } catch (error) {
        if (!isTargetClosedError(error)) {
          throw error;
        }
      }
    },
  };
}
