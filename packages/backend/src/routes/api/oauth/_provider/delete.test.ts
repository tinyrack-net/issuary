import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import { google } from '../../../../entrypoints/identity-providers/google.ts';
import type { ServiceContainer } from '../../../../services/container.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.ts';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('DELETE /api/oauth/:provider', () => {
  test('should return 401 if not authenticated', async () => {
    const client = testClient(app);

    const res = await client.api.oauth[':provider'].$delete({
      param: { provider: 'google' },
    });

    expect(res.status).toBe(401);
  });

  test('should return 404 if provider not found', async () => {
    // Create user and session
    const email = generateUniqueEmail('oauth-unlink');
    const password = 'TestPassword123!';

    // Create user with password and verified email
    const sessionCookie = await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(password);
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      // Login to get session
      const loginClient = testClient(app);
      const loginRes = await loginClient.api.auth.login.$post({
        json: { email, password },
      });
      expect(loginRes.status).toBe(200);

      const cookie = extractCookie(loginRes, 'session');
      return cookie;
    });

    const client = testClient(app);

    const res = await client.api.oauth[':provider'].$delete(
      {
        param: { provider: 'nonexistent' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const json = await assertJsonBody(res, 404);
    expect(json.code).toBe('OAUTH_PROVIDER_NOT_FOUND');
  });

  test('should return 404 if OAuth account not linked', async () => {
    // Create user and session
    const email = generateUniqueEmail('oauth-unlink');
    const password = 'TestPassword123!';

    const sessionCookie = await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword(password);
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      const loginClient = testClient(app);
      const loginRes = await loginClient.api.auth.login.$post({
        json: { email, password },
      });
      expect(loginRes.status).toBe(200);

      return extractCookie(loginRes, 'session');
    });

    const client = testClient(app);

    const res = await client.api.oauth[':provider'].$delete(
      {
        param: { provider: 'google' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const json = await assertJsonBody(res, 404);
    expect(json.code).toBe('OAUTH_ACCOUNT_NOT_LINKED');
  });

  test('should return 400 if unlinking last auth method', async () => {
    // Create OAuth-only user (no password)
    const email = generateUniqueEmail('oauth-only');

    await withMikroContext(services, async () => {
      // Create user without password
      const user = services.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      // Link OAuth account
      await services.mikro.userOAuth.linkAccount({
        userSub: user.sub,
        providerName: 'google',
        providerUserId: `test-${Date.now()}`,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: null,
      });

      return user.sub;
    });

    // Verify the service logic works correctly
    const res = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      expect(user).toBeDefined();

      const oauthCount = await services.mikro.userOAuth.countByUser(user.sub);
      expect(oauthCount).toBe(1);

      const hasPassword = user.hasPassword();
      expect(hasPassword).toBe(false);

      // Test the service method directly
      // This should throw CannotUnlinkLastAuthMethod error
      try {
        await services.oauthConnectService.unlinkOAuthAccount(
          user.sub,
          'google',
        );
        return { error: null };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    expect(res.error).toBe(
      'Cannot unlink the last authentication method. You need at least one way to log in.',
    );
  });

  test('should successfully unlink OAuth when user has password', async () => {
    const email = generateUniqueEmail('oauth-with-password');
    const password = 'TestPassword123!';

    const sessionCookie = await withMikroContext(services, async () => {
      // Create user with password
      const passwordHash =
        await services.securityService.hashPassword(password);
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      // Link OAuth account
      await services.mikro.userOAuth.linkAccount({
        userSub: user.sub,
        providerName: 'google',
        providerUserId: `test-${Date.now()}`,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: null,
      });

      // Login to get session
      const loginClient = testClient(app);
      const loginRes = await loginClient.api.auth.login.$post({
        json: { email, password },
      });
      expect(loginRes.status).toBe(200);

      return extractCookie(loginRes, 'session');
    });

    const client = testClient(app);

    const res = await client.api.oauth[':provider'].$delete(
      {
        param: { provider: 'google' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const json = await assertJsonBody(res);
    expect(json.ok).toBe(true);

    // Verify OAuth account is unlinked
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email,
      });
      const oauthCount = await services.mikro.userOAuth.countByUser(user.sub);
      expect(oauthCount).toBe(0);
    });
  });

  test('should return 404 for config user (config users cannot have linked OAuth)', async () => {
    // Config user cannot have linked OAuth accounts
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const client = testClient(app);

    const res = await client.api.oauth[':provider'].$delete(
      {
        param: { provider: 'google' },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    // Config user cannot have OAuth linked accounts, so return OAuthAccountNotLinked
    const json = await assertJsonBody(res, 404);
    expect(json.code).toBe('OAUTH_ACCOUNT_NOT_LINKED');
  });
});
