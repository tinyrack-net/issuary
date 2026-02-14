import type { AppType } from '@backend/lib/app.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  createAuthenticatedSession,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  requestWithSession,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

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

describe('GET /api/v1/user/oauth-accounts', () => {
  test('should return 401 if not authenticated', async () => {
    const res = await app.request('/api/v1/user/oauth-accounts', {
      method: 'GET',
    });

    expect(res.status).toBe(401);
  });

  test('should return empty accounts for user with no linked OAuth', async () => {
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const res = await requestWithSession(
      app,
      '/api/v1/user/oauth-accounts',
      {
        method: 'GET',
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);

    const json = await res.json();

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

    const res = await requestWithSession(
      app,
      '/api/v1/user/oauth-accounts',
      {
        method: 'GET',
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);

    const json = await res.json();

    // Check available_providers structure
    if (json.available_providers.length > 0) {
      const provider = json.available_providers[0];
      expect(provider.id).toBeTypeOf('string');
      expect(provider.display_name).toBeTypeOf('string');
      expect(provider.linked).toBeTypeOf('boolean');
      // For user with no linked accounts, all should be false
      expect(provider.linked).toBe(false);
    }
  });

  test('should return linked OAuth account when user has one', async () => {
    const email = generateUniqueEmail('oauth-linked');
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
      '/api/v1/user/oauth-accounts',
      {
        method: 'GET',
      },
      sessionCookie,
    );

    expect(res.status).toBe(200);

    const json = await res.json();

    // Should have one linked account
    expect(json.accounts.length).toBe(1);
    expect(json.accounts[0].provider_name).toBe('google');
    expect(json.accounts[0].linked_at).toBeDefined();

    // Google should be marked as linked in available_providers
    const googleProvider = json.available_providers.find(
      (p: { id: string }) => p.id === 'google',
    );
    expect(googleProvider).toBeDefined();
    expect(googleProvider.linked).toBe(true);
  });
});
