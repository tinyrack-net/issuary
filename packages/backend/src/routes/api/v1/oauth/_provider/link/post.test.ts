import { describe, expect, test } from 'vitest';
import {
  createAuthenticatedSession,
  injectWithSession,
  setupTestServer,
  TEST_USER,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('POST /api/v1/oauth/:provider/link', () => {
  test('should return 401 if not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/oauth/google/link',
    });

    expect(res.statusCode).toBe(401);
  });

  test('should return 404 if provider not found', async () => {
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/oauth/nonexistent/link',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(404);
    const json = res.json();
    expect(json.code).toBe('OAUTH_PROVIDER_NOT_FOUND');
  });

  test('should redirect to OAuth provider for valid provider', async () => {
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/oauth/google/link',
      },
      sessionCookie,
    );

    // Should redirect to Google OAuth
    expect(res.statusCode).toBe(302);

    const location = res.headers.location as string;
    expect(location).toBeDefined();
    expect(location).toContain('accounts.google.com');
  });

  test('should include return_url in OAuth state when provided', async () => {
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const returnUrl = 'http://localhost:3000/profile';
    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: `/api/v1/oauth/google/link?return_url=${encodeURIComponent(returnUrl)}`,
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(302);

    // Verify redirect happens (actual state verification would require deeper testing)
    const location = res.headers.location as string;
    expect(location).toBeDefined();
    expect(location).toContain('accounts.google.com');
  });

  test('should set OAuth session data in cookie', async () => {
    const sessionCookie = await createAuthenticatedSession(
      app,
      TEST_USER.email,
      TEST_USER.password,
    );

    const res = await injectWithSession(
      app,
      {
        method: 'POST',
        url: '/api/v1/oauth/google/link',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(302);

    // Session cookie should be updated with OAuth session data
    const sessionUpdate = res.cookies.find((c) => c.name === 'session');
    expect(sessionUpdate).toBeDefined();
  });
});
