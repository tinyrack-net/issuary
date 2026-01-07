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

describe('POST /application/oauth/introspect', () => {
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

  async function getAccessToken(): Promise<string> {
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
      query: validAuthParams,
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

  test('should return active true for valid token', async () => {
    const accessToken = await getAccessToken();

    const res = await app.inject({
      method: 'POST',
      url: '/application/oauth/introspect',
      payload: {
        token: accessToken,
        client_id: validAuthParams.client_id,
        client_secret: 'sdlk3n3dkj2',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.active).toBe(true);
    expect(body.client_id).toBe(validAuthParams.client_id);
    expect(body.scope).toBe(validAuthParams.scope);
    expect(body.token_type).toBe('Bearer');
    expect(body.sub).toBeDefined();
    expect(body.iat).toBeDefined();
    expect(body.exp).toBeDefined();
  });

  test('should return active false for invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/application/oauth/introspect',
      payload: {
        token: 'invalid-token',
        client_id: validAuthParams.client_id,
        client_secret: 'sdlk3n3dkj2',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.active).toBe(false);
  });

  test('should fail with invalid client credentials', async () => {
    const accessToken = await getAccessToken();

    const res = await app.inject({
      method: 'POST',
      url: '/application/oauth/introspect',
      payload: {
        token: accessToken,
        client_id: 'invalid-client',
        client_secret: 'wrong-secret',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toBe('invalid_client');
  });
});
