import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  TEST_USER,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /api/v1/user/oauth-accounts', () => {
  test('should return 401 if not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/user/oauth-accounts',
    });

    expect(res.statusCode).toBe(401);
  });

  test('should return empty accounts for user with no linked OAuth', async () => {
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/oauth-accounts',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);

    const json = res.json();

    expect(json.accounts).toBeDefined();
    expect(json.accounts).toBeInstanceOf(Array);
    expect(json.accounts.length).toBe(0);

    expect(json.available_providers).toBeDefined();
    expect(json.available_providers).toBeInstanceOf(Array);
  });

  test('should return available providers with linked status', async () => {
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/oauth-accounts',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // Check available_providers structure
    if (json.available_providers.length > 0) {
      const provider = json.available_providers[0];
      expect(provider.name).toBeTypeOf('string');
      expect(provider.display_name).toBeTypeOf('string');
      expect(provider.linked).toBeTypeOf('boolean');
      // For user with no linked accounts, all should be false
      expect(provider.linked).toBe(false);
    }
  });

  test('should return linked OAuth account when user has one', async () => {
    const email = generateUniqueEmail('oauth-linked');
    const password = 'TestPassword123!';

    const sessionCookie = await withMikroContext(app, async () => {
      // Create user with password
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persistAndFlush(user);

      // Link OAuth account
      await app.mikro.userOAuth.linkAccount({
        user,
        providerName: 'google',
        providerUserId: `test-${Date.now()}`,
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: null,
      });

      // Login to get session
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });
      expect(loginRes.statusCode).toBe(200);

      return loginRes.cookies.find((c) => c.name === 'session')
        ?.value as string;
    });

    const res = await injectWithSession(
      app,
      {
        method: 'GET',
        url: '/api/v1/user/oauth-accounts',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);

    const json = res.json();

    // Should have one linked account
    expect(json.accounts.length).toBe(1);
    expect(json.accounts[0].provider_name).toBe('google');
    expect(json.accounts[0].linked_at).toBeDefined();

    // Google should be marked as linked in available_providers
    const googleProvider = json.available_providers.find(
      (p: { name: string }) => p.name === 'google',
    );
    expect(googleProvider).toBeDefined();
    expect(googleProvider.linked).toBe(true);
  });
});
