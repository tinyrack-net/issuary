import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createTestApp,
  createTestOAuthClient,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

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

  test('requiresConsent skips first-party consent unless prompt=consent is requested', async () => {
    const userSub = await createTestUser(services);
    const clientId = await createTestOAuthClient(services, {
      clientId: 'skip-consent-client',
    });

    await expect(
      withMikroContext(services, async () =>
        services.userConsentService.requiresConsent({
          userSub,
          clientId,
          requestedScopes: ['openid', 'email'],
          skipConsent: true,
        }),
      ),
    ).resolves.toBe(false);

    await expect(
      withMikroContext(services, async () =>
        services.userConsentService.requiresConsent({
          userSub,
          clientId,
          requestedScopes: ['openid', 'email'],
          prompt: 'consent',
          skipConsent: true,
        }),
      ),
    ).resolves.toBe(true);
  });
  test('reactivates revoked consent without restoring revoked scopes or inserting another row', async () => {
    const userSub = await createTestUser(services);
    const clientId = await createTestOAuthClient(services);
    await withMikroContext(services, async () => {
      const consent = await services.userConsentService.grantConsent({
        userSub,
        clientId,
        scopes: ['openid', 'email', 'offline_access'],
      });
      consent.revoked_at = new Date();
      await services.mikro.em.flush();
      expect(
        await services.userConsentService.hasConsent(userSub, clientId, [
          'openid',
        ]),
      ).toBe(false);
      const renewed = await services.userConsentService.grantConsent({
        userSub,
        clientId,
        scopes: ['openid'],
      });
      expect(renewed.id).toBe(consent.id);
      expect(renewed.scopes).toEqual(['openid']);
      expect(renewed.revoked_at).toBeNull();
      expect(
        await services.mikro.userConsent.count({
          user: userSub,
          client: clientId,
        }),
      ).toBe(1);
    });
  });

  test('offline grants require code flow and explicit or administrative approval, isolated by user and client', async () => {
    const userSub = await createTestUser(services);
    const otherUser = await createTestUser(services);
    const clientId = await createTestOAuthClient(services);
    const otherClient = await createTestOAuthClient(services);
    await withMikroContext(services, async () => {
      const request = {
        userSub,
        clientId,
        requestedScopes: ['openid', 'offline_access'],
        responseType: 'code',
      };
      expect(await services.userConsentService.resolveScopes(request)).toEqual([
        'openid',
      ]);
      expect(
        await services.userConsentService.resolveScopes({
          ...request,
          prompt: 'login consent',
        }),
      ).toEqual(request.requestedScopes);
      expect(
        await services.userConsentService.resolveScopes({
          ...request,
          skipConsent: true,
        }),
      ).toEqual(request.requestedScopes);
      expect(
        await services.userConsentService.resolveScopes({
          ...request,
          skipConsent: true,
          responseType: 'id_token',
        }),
      ).toEqual(['openid']);
      const consent = await services.userConsentService.grantConsent({
        userSub,
        clientId,
        scopes: request.requestedScopes,
      });
      expect(
        await services.userConsentService.resolveScopes({
          ...request,
          prompt: 'none',
        }),
      ).toEqual(request.requestedScopes);
      expect(
        await services.userConsentService.resolveScopes({
          ...request,
          userSub: otherUser,
        }),
      ).toEqual(['openid']);
      expect(
        await services.userConsentService.resolveScopes({
          ...request,
          clientId: otherClient,
        }),
      ).toEqual(['openid']);
      consent.revoked_at = new Date();
      await services.mikro.em.flush();
      expect(await services.userConsentService.resolveScopes(request)).toEqual([
        'openid',
      ]);
      expect(
        await services.userConsentService.resolveScopes({
          ...request,
          skipConsent: true,
        }),
      ).toEqual(request.requestedScopes);
    });
  });
});
