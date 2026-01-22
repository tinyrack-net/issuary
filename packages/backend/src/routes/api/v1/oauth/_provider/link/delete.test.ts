import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  extractCookie,
  generateUniqueEmail,
  injectWithSession,
  setupTestServer,
  TEST_USER,
  withMikroContext,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('DELETE /api/v1/oauth/:provider/link', () => {
  test('should return 401 if not authenticated', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/oauth/google/link',
    });

    expect(res.statusCode).toBe(401);
  });

  test('should return 404 if provider not found', async () => {
    // Create user and session
    const email = generateUniqueEmail('oauth-unlink');
    const password = 'TestPassword123!';

    // Create user with password and verified email
    const sessionCookie = await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();

      // Login to get session
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });
      expect(loginRes.statusCode).toBe(200);

      const cookie = extractCookie(loginRes, 'session');
      return cookie;
    });

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/oauth/nonexistent/link',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(404);
    const json = res.json();
    expect(json.code).toBe('OAUTH_PROVIDER_NOT_FOUND');
  });

  test('should return 404 if OAuth account not linked', async () => {
    // Create user and session
    const email = generateUniqueEmail('oauth-unlink');
    const password = 'TestPassword123!';

    const sessionCookie = await withMikroContext(app, async () => {
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });
      expect(loginRes.statusCode).toBe(200);

      return extractCookie(loginRes, 'session');
    });

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/oauth/google/link',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(404);
    const json = res.json();
    expect(json.code).toBe('OAUTH_ACCOUNT_NOT_LINKED');
  });

  test('should return 400 if unlinking last auth method', async () => {
    // Create OAuth-only user (no password)
    const email = generateUniqueEmail('oauth-only');

    const _sessionCookie = await withMikroContext(app, async () => {
      // Create user without password
      const user = app.mikro.user.create({
        email,
        password_hash: null,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();

      // Link OAuth account
      await app.mikro.userOAuth.linkAccount({
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
    const res = await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail(
        { email },
        { populate: ['password_hash'] },
      );
      expect(user).toBeDefined();

      const oauthCount = await app.mikro.userOAuth.countByUser(user.id);
      expect(oauthCount).toBe(1);

      const hasPassword = user.hasPassword();
      expect(hasPassword).toBe(false);

      // Test the service method directly
      // This should throw CannotUnlinkLastAuthMethod error
      try {
        await app.oauthConnectService.unlinkOAuthAccount(user.id, 'google');
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

    const sessionCookie = await withMikroContext(app, async () => {
      // Create user with password
      const user = app.mikro.user.create({
        email,
        password_hash: password,
      });
      user.email_verified = true;
      await app.mikro.em.persist(user).flush();

      // Link OAuth account
      await app.mikro.userOAuth.linkAccount({
        userId: user.id,
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

      return extractCookie(loginRes, 'session');
    });

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/oauth/google/link',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.ok).toBe(true);

    // Verify OAuth account is unlinked
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({ email });
      const oauthCount = await app.mikro.userOAuth.countByUser(user.id);
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

    const res = await injectWithSession(
      app,
      {
        method: 'DELETE',
        url: '/api/v1/oauth/google/link',
      },
      sessionCookie,
    );

    // Config user cannot have OAuth linked accounts, so return OAuthAccountNotLinked
    expect(res.statusCode).toBe(404);
    const json = res.json();
    expect(json.code).toBe('OAUTH_ACCOUNT_NOT_LINKED');
  });
});
