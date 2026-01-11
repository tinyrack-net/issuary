import { describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import {
  createAuthenticatedSession,
  injectWithSession,
  setupTestServer,
} from '@/test-utils/index.js';

const app = setupTestServer();

describe('GET /api/v1/oauth/providers', () => {
  test('should return empty providers list when all OAuth providers are disabled', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/oauth/providers',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('providers');
    expect(Array.isArray(body.providers)).toBe(true);
    // In test config, OAuth providers are disabled
    expect(body.providers).toHaveLength(0);
  });
});

describe('GET /api/v1/oauth/connect/:provider', () => {
  test('should return 404 for non-existent provider', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/oauth/connect/nonexistent',
    });

    expect(res.statusCode).toBe(e.OAuthProviderNotFound.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'OAUTH_PROVIDER_NOT_FOUND');
  });

  test('should return 404 for disabled provider', async () => {
    // google is configured but disabled in test config
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/oauth/connect/google',
    });

    expect(res.statusCode).toBe(e.OAuthProviderNotFound.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'OAUTH_PROVIDER_NOT_FOUND');
  });
});

describe('GET /api/v1/user/oauth-accounts', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/user/oauth-accounts',
    });

    expect(res.statusCode).toBe(e.Unauthorized.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
  });

  test('should return accounts list when authenticated', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'get',
        url: '/api/v1/user/oauth-accounts',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accounts');
    expect(body).toHaveProperty('available_providers');
    expect(Array.isArray(body.accounts)).toBe(true);
    expect(Array.isArray(body.available_providers)).toBe(true);
  });
});

describe('POST /api/v1/oauth/link/:provider', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/oauth/link/google',
    });

    expect(res.statusCode).toBe(e.Unauthorized.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
  });

  test('should return 404 for disabled provider when authenticated', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'post',
        url: '/api/v1/oauth/link/google',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(e.OAuthProviderNotFound.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'OAUTH_PROVIDER_NOT_FOUND');
  });
});

describe('DELETE /api/v1/oauth/unlink/:provider', () => {
  test('should return 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'delete',
      url: '/api/v1/oauth/unlink/google',
    });

    expect(res.statusCode).toBe(e.Unauthorized.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'UNAUTHORIZED');
  });

  test('should return 404 for disabled provider when authenticated', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const res = await injectWithSession(
      app,
      {
        method: 'delete',
        url: '/api/v1/oauth/unlink/google',
      },
      sessionCookie,
    );

    expect(res.statusCode).toBe(e.OAuthProviderNotFound.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'OAUTH_PROVIDER_NOT_FOUND');
  });
});

describe('GET /api/v1/oauth/callback/:provider', () => {
  test('should return 400 for expired/missing session', async () => {
    const res = await app.inject({
      method: 'get',
      url: '/api/v1/oauth/callback/google?code=test&state=test',
    });

    expect(res.statusCode).toBe(e.OAuthSessionExpired.Status);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code', 'OAUTH_SESSION_EXPIRED');
  });
});
