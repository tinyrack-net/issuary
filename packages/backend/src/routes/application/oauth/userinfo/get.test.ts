import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer().start();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

describe('GET /application/oauth/userinfo', () => {
  const validAuthParams = {
    response_type: 'code',
    client_id: 'sdlk3n3dkj2',
    redirect_uri: 'http://localhost:8080/callback',
    scope: 'openid profile email',
    state: 'random-state-string',
    nonce: 'random-nonce-string',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256' as const,
  };

  const validCodeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

  async function getAccessToken(scope?: string): Promise<string> {
    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/user/login',
      payload: {
        email: 'admin@example.com',
        password: 'changemelater',
      },
    });

    const cookies = loginRes.cookies;
    const sessionCookie = cookies.find((c) => c.name === 'session');

    // Get authorization code
    const authRes = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: {
        ...validAuthParams,
        scope: scope || validAuthParams.scope,
      },
      cookies: {
        session: sessionCookie?.value || '',
      },
    });

    const location = new URL(
      authRes.headers.location as string,
      'http://localhost:8080',
    );
    const code = location.searchParams.get('code');

    // Exchange for token
    const tokenRes = await app.inject({
      method: 'POST',
      url: '/application/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: validAuthParams.redirect_uri,
        client_id: validAuthParams.client_id,
        client_secret: 'sdlk3n3dkj2',
        code_verifier: validCodeVerifier,
      },
    });

    return tokenRes.json().access_token;
  }

  test('should return user info with all scopes', async () => {
    const accessToken = await getAccessToken('openid profile email');

    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/userinfo',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.sub).toBeDefined();
    expect(body.email).toBe('admin@example.com');
    expect(body.email_verified).toBe(true);
    expect(body.name).toBe('admin@example.com');
    expect(body.preferred_username).toBe('admin@example.com');
  });

  test('should return limited info with only openid scope', async () => {
    const accessToken = await getAccessToken('openid');

    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/userinfo',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.sub).toBeDefined();
    expect(body.email).toBeUndefined();
    expect(body.name).toBeUndefined();
  });

  test('should return email but not profile with email scope', async () => {
    const accessToken = await getAccessToken('openid email');

    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/userinfo',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.sub).toBeDefined();
    expect(body.email).toBe('admin@example.com');
    expect(body.email_verified).toBe(true);
    expect(body.name).toBeUndefined();
    expect(body.preferred_username).toBeUndefined();
  });

  test('should fail without Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/userinfo',
    });

    expect(res.statusCode).toBe(400);
  });

  test('should fail with invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/userinfo',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('invalid_token');
  });

  test('should fail with malformed Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/userinfo',
      headers: {
        authorization: 'Invalid format',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('invalid_token');
  });
});
