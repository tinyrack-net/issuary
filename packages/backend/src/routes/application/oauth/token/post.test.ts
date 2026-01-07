import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import { verifyAccessToken, verifyRefreshToken } from '@/lib/jwt.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer().start();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

describe('POST /application/oauth/token', () => {
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

  test('should exchange authorization code for tokens', async () => {
    // Step 1: Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/user/login',
      payload: {
        email: 'admin@example.com',
        password: 'changemelater',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const cookies = loginRes.cookies;
    const sessionCookie = cookies.find((c) => c.name === 'session');

    // Step 2: Get authorization code
    const authRes = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: validAuthParams,
      cookies: {
        session: sessionCookie?.value || '',
      },
    });

    expect(authRes.statusCode).toBe(302);
    const location = new URL(
      authRes.headers.location as string,
      'http://localhost:8080',
    );
    const code = location.searchParams.get('code');
    expect(code).toBeDefined();

    // Step 3: Exchange code for tokens
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

    if (tokenRes.statusCode !== 200) {
      console.log('Token response:', tokenRes.json());
    }

    expect(tokenRes.statusCode).toBe(200);
    const tokenBody = tokenRes.json();

    expect(tokenBody.access_token).toBeDefined();
    expect(tokenBody.token_type).toBe('Bearer');
    expect(tokenBody.expires_in).toBe(3600);
    expect(tokenBody.refresh_token).toBeDefined();
    expect(tokenBody.id_token).toBeDefined();
    expect(tokenBody.scope).toBe(validAuthParams.scope);

    // Verify access token is valid JWT
    const accessPayload = await verifyAccessToken(tokenBody.access_token);
    expect(accessPayload.client_id).toBe(validAuthParams.client_id);
    expect(accessPayload.scope).toBe(validAuthParams.scope);
  });

  test('should fail with invalid authorization code', async () => {
    const tokenRes = await app.inject({
      method: 'POST',
      url: '/application/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code: 'invalid-code',
        redirect_uri: validAuthParams.redirect_uri,
        client_id: validAuthParams.client_id,
        client_secret: 'sdlk3n3dkj2',
        code_verifier: validCodeVerifier,
      },
    });

    expect(tokenRes.statusCode).toBe(400);
    const body = tokenRes.json();
    expect(body.error).toBe('invalid_grant');
  });

  test('should fail with invalid client credentials', async () => {
    const tokenRes = await app.inject({
      method: 'POST',
      url: '/application/oauth/token',
      payload: {
        grant_type: 'authorization_code',
        code: 'some-code',
        redirect_uri: validAuthParams.redirect_uri,
        client_id: 'invalid-client',
        client_secret: 'wrong-secret',
      },
    });

    expect(tokenRes.statusCode).toBe(401);
    const body = tokenRes.json();
    expect(body.error).toBe('invalid_client');
  });

  test('should refresh token with valid refresh_token', async () => {
    // Step 1: Get tokens first
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

    const tokenBody = tokenRes.json();
    const refreshToken = tokenBody.refresh_token;

    // Step 2: Use refresh token
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/application/oauth/token',
      payload: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: validAuthParams.client_id,
        client_secret: 'sdlk3n3dkj2',
      },
    });

    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json();

    expect(refreshBody.access_token).toBeDefined();
    expect(refreshBody.token_type).toBe('Bearer');
    expect(refreshBody.refresh_token).toBeDefined();

    // Verify new tokens are valid
    const newAccessPayload = await verifyAccessToken(refreshBody.access_token);
    expect(newAccessPayload.client_id).toBe(validAuthParams.client_id);

    const newRefreshPayload = await verifyRefreshToken(
      refreshBody.refresh_token,
    );
    expect(newRefreshPayload.client_id).toBe(validAuthParams.client_id);
  });
});
