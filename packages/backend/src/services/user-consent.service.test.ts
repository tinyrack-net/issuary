import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  createTestApp,
  createTestOAuthClient,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

describe('UserConsentService', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp(MINIMAL_TEST_CONFIG);
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('requiresConsent respects prompt=consent even when scopes were already granted', async () => {
    const userSub = await createTestUser(services);
    const clientId = await createTestOAuthClient(services, {
      clientId: 'prompt-consent-client',
    });

    await withMikroContext(services, async () => {
      await services.userConsentService.grantConsent({
        userSub,
        clientId,
        scopes: ['openid', 'email'],
      });
    });

    await expect(
      withMikroContext(services, async () =>
        services.userConsentService.requiresConsent({
          userSub,
          clientId,
          requestedScopes: ['openid'],
          prompt: 'consent',
        }),
      ),
    ).resolves.toBe(true);
  });

  test('grantConsent merges scopes and avoids re-prompting for already approved scopes', async () => {
    const userSub = await createTestUser(services);
    const clientId = await createTestOAuthClient(services, {
      clientId: 'merged-scope-client',
    });

    await withMikroContext(services, async () => {
      await services.userConsentService.grantConsent({
        userSub,
        clientId,
        scopes: ['openid'],
      });
      await services.userConsentService.grantConsent({
        userSub,
        clientId,
        scopes: ['email'],
      });

      const storedConsent = await services.mikro.userConsent.findConsent(
        userSub,
        clientId,
      );
      expect(storedConsent?.scopes).toEqual(
        expect.arrayContaining(['openid', 'email']),
      );
      expect(storedConsent?.scopes).toHaveLength(2);
    });

    await expect(
      withMikroContext(services, async () =>
        services.userConsentService.requiresConsent({
          userSub,
          clientId,
          requestedScopes: ['openid', 'email'],
        }),
      ),
    ).resolves.toBe(false);

    await expect(
      withMikroContext(services, async () =>
        services.userConsentService.requiresConsent({
          userSub,
          clientId,
          requestedScopes: ['openid', 'profile'],
        }),
      ),
    ).resolves.toBe(true);
  });
});
