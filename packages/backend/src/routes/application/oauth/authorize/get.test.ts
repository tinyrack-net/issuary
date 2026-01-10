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

describe('GET /application/oauth/authorize', () => {
  const validParams = {
    response_type: 'code',
    client_id: 'sdlk3n3dkj2',
    redirect_uri: 'http://localhost:8080/callback',
    scope: 'openid profile email',
    state: 'random-state-string',
    nonce: 'random-nonce-string',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256' as const,
  };

  test('should redirect to login when user is not authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: validParams,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBeDefined();

    const location = new URL(
      res.headers.location as string,
      'http://localhost:8080',
    );
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('client_id')).toBe(validParams.client_id);
    expect(location.searchParams.get('redirect_uri')).toBe(
      validParams.redirect_uri,
    );
    expect(location.searchParams.get('state')).toBe(validParams.state);
    expect(location.searchParams.get('nonce')).toBe(validParams.nonce);
  });

  test('should return error for invalid client_id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: {
        ...validParams,
        client_id: 'invalid-client-id',
      },
    });

    expect(res.statusCode).toBe(302);
    const location = new URL(
      res.headers.location as string,
      'http://localhost:8080',
    );
    expect(location.searchParams.get('error')).toBe('unauthorized_client');
    expect(location.searchParams.get('error_description')).toBe(
      'The OAuth client was not found.',
    );
  });

  test('should return error for invalid redirect_uri', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: {
        ...validParams,
        redirect_uri: 'https://evil.com/callback',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toBe(
      'The redirect URI is not registered for this client.',
    );
  });

  test('should return error for unsupported response_type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: {
        ...validParams,
        response_type: 'token',
      },
    });

    expect(res.statusCode).toBe(302);
    const location = new URL(
      res.headers.location as string,
      'http://localhost:8080',
    );
    expect(location.searchParams.get('error')).toBe(
      'unsupported_response_type',
    );
  });

  test('should return error for invalid scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: {
        ...validParams,
        scope: 'invalid_scope another_invalid',
      },
    });

    expect(res.statusCode).toBe(302);
    const location = new URL(
      res.headers.location as string,
      'http://localhost:8080',
    );
    expect(location.searchParams.get('error')).toBe('invalid_scope');
  });

  test('should issue authorization code for authenticated user', async () => {
    // First login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/user/login',
      payload: {
        email: 'test-config-user@example.com',
        password: 'changemelater',
      },
    });

    expect(loginRes.statusCode).toBe(200);

    // Extract session cookie
    const cookies = loginRes.cookies;
    const sessionCookie = cookies.find((c) => c.name === 'session');
    expect(sessionCookie).toBeDefined();

    // Now request authorization with session
    const authRes = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: validParams,
      cookies: {
        session: sessionCookie?.value || '',
      },
    });

    expect(authRes.statusCode).toBe(302);
    const location = new URL(
      authRes.headers.location as string,
      'http://localhost:8080',
    );

    // Should redirect to callback with code
    expect(location.origin + location.pathname).toBe(validParams.redirect_uri);
    expect(location.searchParams.get('code')).toBeDefined();
    expect(location.searchParams.get('code')).not.toBe('');
    expect(location.searchParams.get('state')).toBe(validParams.state);
  });

  test('should preserve state parameter in error responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: {
        ...validParams,
        client_id: 'invalid',
        state: 'my-unique-state',
      },
    });

    expect(res.statusCode).toBe(302);
    const location = new URL(
      res.headers.location as string,
      'http://localhost:8080',
    );
    expect(location.searchParams.get('state')).toBe('my-unique-state');
  });

  test('should handle PKCE parameters correctly', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/user/login',
      payload: {
        email: 'admin@example.com',
        password: 'changemelater',
      },
    });

    const sessionCookie = loginRes.cookies.find((c) => c.name === 'session');

    const authRes = await app.inject({
      method: 'GET',
      url: '/application/oauth/authorize',
      query: {
        ...validParams,
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      },
      cookies: {
        session: sessionCookie?.value || '',
      },
    });

    expect(authRes.statusCode).toBe(302);
    const location = new URL(
      authRes.headers.location as string,
      'http://localhost:8080',
    );
    expect(location.searchParams.get('code')).toBeDefined();
  });
});
