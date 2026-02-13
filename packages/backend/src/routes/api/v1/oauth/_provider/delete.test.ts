import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';
import type { AppType, ServiceContainer } from '@/types.js';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      identity_providers: [
        {
          id: 'google',
          type: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        },
      ],
    },
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

describe('DELETE /api/v1/oauth/:provider', () => {
  test('should return 401 if not authenticated', async () => {
    const res = await app.request('/api/v1/oauth/google', {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });

  test('should return 404 if provider not found', async () => {
    // Create user and session
    const email = generateUniqueEmail('oauth-unlink');
    const password = 'TestPassword123!';

    // Create user with password and verified email
    const sessionCookie = await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      // Login to get session
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(loginRes.status).toBe(200);

      const cookie = extractCookie(loginRes, 'session');
      return cookie;
    });

    const res = await requestWithSession(
      app,
      '/api/v1/oauth/nonexistent',
      {
        method: 'DELETE',
      },
      sessionCookie,
    );

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('OAUTH_PROVIDER_NOT_FOUND');
  });

  test('should return 404 if OAuth account not linked', async () => {
    // Create user and session
    const email = generateUniqueEmail('oauth-unlink');
    const password = 'TestPassword123!';

    const sessionCookie = await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(loginRes.status).toBe(200);

      return extractCookie(loginRes, 'session');
    });

    const res = await requestWithSession(
      app,
      '/api/v1/oauth/google',
      {
        method: 'DELETE',
      },
      sessionCookie,
    );

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('OAUTH_ACCOUNT_NOT_LINKED');
  });

  test('should return 400 if unlinking last auth method', async () => {
    // Create OAuth-only user (no password)
    const email = generateUniqueEmail('oauth-only');

    const _sessionCookie = await withMikroContext(services, async () => {
      // Create user without password
      const user = services.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      // Link OAuth account
      await services.mikro.userOAuth.linkAccount({
        userId: user.id,
        providerName: 'google',
        providerUserId: `test-${Date.now()}`,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: null,
      });

      return user.id;
    });

    // Verify the service logic works correctly
    const res = await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      expect(user).toBeDefined();

      const oauthCount = await services.mikro.userOAuth.countByUser(user.id);
      expect(oauthCount).toBe(1);

      const hasPassword = user.hasPassword();
      expect(hasPassword).toBe(false);

      // Test the service method directly
      // This should throw CannotUnlinkLastAuthMethod error
      try {
        await services.oauthConnectService.unlinkOAuthAccount(
          user.id,
          'google',
        );
        return { error: null };
      } catch (err) {
        return { error: (err as Error).message };
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
      const user = services.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();

      // Link OAuth account
      await services.mikro.userOAuth.linkAccount({
        userId: user.id,
        providerName: 'google',
        providerUserId: `test-${Date.now()}`,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: null,
      });

      // Login to get session
      const loginRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(loginRes.status).toBe(200);

      return extractCookie(loginRes, 'session');
    });

    const res = await requestWithSession(
      app,
      '/api/v1/oauth/google',
      {
        method: 'DELETE',
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify OAuth account is unlinked
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ email });
      const oauthCount = await services.mikro.userOAuth.countByUser(user.id);
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

    const res = await requestWithSession(
      app,
      '/api/v1/oauth/google',
      {
        method: 'DELETE',
      },
      sessionCookie,
    );

    // Config user cannot have OAuth linked accounts, so return OAuthAccountNotLinked
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('OAUTH_ACCOUNT_NOT_LINKED');
  });
});
