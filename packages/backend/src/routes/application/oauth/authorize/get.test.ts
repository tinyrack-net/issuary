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

/**
 * Test configuration constants
 */
const TEST_CONFIG = {
  validClient: {
    clientId: 'sdlk3n3dkj2',
    clientSecret: 'sdlk3n3dkj2',
    redirectUri: 'http://localhost:8080/callback',
    allowedScopes: ['openid', 'profile', 'email'],
  },
  testUser: {
    email: 'test-config-user@example.com',
    password: 'changemelater',
  },
  pkce: {
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    codeChallengeMethod: 'S256' as const,
    codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  },
} as const;

/**
 * Helper: Create authenticated session and return session cookie
 */
async function createAuthenticatedSession(
  email: string = TEST_CONFIG.testUser.email,
  password: string = TEST_CONFIG.testUser.password,
): Promise<string> {
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/user/login',
    payload: { email, password },
  });

  expect(loginRes.statusCode).toBe(200);

  const sessionCookie = loginRes.cookies.find((c) => c.name === 'session');
  expect(sessionCookie).toBeDefined();

  return sessionCookie?.value || '';
}

/**
 * Helper: Get authorization code with optional session
 */
async function getAuthorizationCode(
  params: Record<string, string>,
  sessionCookie?: string,
): Promise<{ code: string | null; location: URL; statusCode: number }> {
  const injectOptions: {
    method: 'GET';
    url: string;
    query: Record<string, string>;
    cookies?: { session: string };
  } = {
    method: 'GET',
    url: '/application/oauth/authorize',
    query: params,
  };

  if (sessionCookie) {
    injectOptions.cookies = { session: sessionCookie };
  }

  const res = await app.inject(injectOptions);

  const locationHeader = res.headers.location;
  const location = new URL(locationHeader as string, 'http://localhost:8080');

  return {
    code: location.searchParams.get('code'),
    location,
    statusCode: res.statusCode,
  };
}

/**
 * Helper: Expect redirect error with specific error code
 */
function expectRedirectError(
  location: URL,
  expectedError: string,
  expectedDescriptionContains?: string,
) {
  expect(location.searchParams.get('error')).toBe(expectedError);
  if (expectedDescriptionContains) {
    expect(location.searchParams.get('error_description')).toContain(
      expectedDescriptionContains,
    );
  }
  expect(location.searchParams.has('code')).toBe(false);
}

/**
 * Helper: Expect login redirect with preserved parameters
 */
function expectLoginRedirect(
  location: URL,
  originalParams: Record<string, string>,
) {
  expect(location.pathname).toBe('/login');
  for (const [key, value] of Object.entries(originalParams)) {
    expect(location.searchParams.get(key)).toBe(value);
  }
}

describe('GET /application/oauth/authorize', () => {
  const validParams = {
    response_type: 'code',
    client_id: TEST_CONFIG.validClient.clientId,
    redirect_uri: TEST_CONFIG.validClient.redirectUri,
    scope: 'openid profile email',
    state: 'random-state-string',
  };

  describe('Success Cases', () => {
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

      expectLoginRedirect(location, validParams);
    });

    test('should issue authorization code for authenticated user', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, location, statusCode } = await getAuthorizationCode(
        validParams,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
      expect(code).not.toBe('');
      expect(location.origin + location.pathname).toBe(
        validParams.redirect_uri,
      );
      expect(location.searchParams.get('state')).toBe(validParams.state);
    });

    test('should preserve all OAuth parameters in login redirect', async () => {
      const paramsWithNonce = {
        ...validParams,
        nonce: 'test-nonce',
        code_challenge: TEST_CONFIG.pkce.codeChallenge,
        code_challenge_method: TEST_CONFIG.pkce.codeChallengeMethod,
        prompt: 'login',
      };

      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: paramsWithNonce,
      });

      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expectLoginRedirect(location, paramsWithNonce);
    });

    test('should handle minimal required parameters', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const minimalParams = {
        response_type: 'code',
        client_id: TEST_CONFIG.validClient.clientId,
        redirect_uri: TEST_CONFIG.validClient.redirectUri,
      };

      const { code, statusCode } = await getAuthorizationCode(
        minimalParams,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should handle all OIDC scopes correctly', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          scope: 'openid profile email',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should handle OAuth2 flow without openid scope', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          scope: 'profile email',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });
  });

  describe('Client Validation', () => {
    test('should return unauthorized_client for non-existent client_id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          client_id: 'non-existent-client',
        },
      });

      // RFC 6749 §4.1.2.1: Invalid client_id must NOT redirect
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error).toBe('unauthorized_client');
      expect(json.error_description).toContain('OAuth client was not found');
    });

    test('should return error as JSON for invalid client (no redirect)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          client_id: 'invalid-client',
          state: 'my-unique-state',
        },
      });

      // RFC 6749 §4.1.2.1: Invalid client_id must NOT redirect
      // State parameter cannot be preserved in JSON response (no redirect)
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error).toBe('unauthorized_client');
      expect(json.error_description).toBeDefined();
    });
  });

  describe('Redirect URI Validation', () => {
    test('should return 400 for unregistered redirect_uri', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          redirect_uri: 'https://evil.com/callback',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toContain('redirect URI');
    });

    test('should not redirect errors to invalid redirect_uri', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          client_id: 'invalid',
          redirect_uri: 'https://evil.com/callback',
        },
      });

      // Should return JSON error, not redirect
      expect(res.statusCode).toBe(400);
      expect(res.headers.location).toBeUndefined();
    });

    test('should accept exact match of registered redirect_uri', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          redirect_uri: TEST_CONFIG.validClient.redirectUri,
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });
  });

  describe('Response Type Validation', () => {
    test('should return unsupported_response_type for "token"', async () => {
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

      expectRedirectError(location, 'unsupported_response_type');
    });

    test('should return unsupported_response_type for "id_token"', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          response_type: 'id_token',
        },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expectRedirectError(location, 'unsupported_response_type');
    });

    test('should accept "code" response_type', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        validParams,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });
  });

  describe('Scope Validation', () => {
    test('should return invalid_scope for disallowed scope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          scope: 'admin super_user',
        },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expectRedirectError(location, 'invalid_scope');
    });

    test('should accept valid scopes', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          scope: 'openid profile email',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should accept subset of allowed scopes', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          scope: 'openid profile',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });
  });

  describe('PKCE Validation', () => {
    test('should accept S256 code_challenge_method', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          code_challenge: TEST_CONFIG.pkce.codeChallenge,
          code_challenge_method: 'S256',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should accept plain code_challenge_method', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          code_challenge: 'plain-challenge',
          code_challenge_method: 'plain',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should default to S256 when method not specified', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          code_challenge: TEST_CONFIG.pkce.codeChallenge,
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should allow authorization without PKCE', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        validParams,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });
  });

  describe('State Parameter Handling', () => {
    test('should preserve state in successful redirect', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          state: 'test-state-123',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(location.searchParams.get('state')).toBe('test-state-123');
    });

    test('should return JSON error for invalid client (state not preserved)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          client_id: 'invalid',
          state: 'error-state-456',
        },
      });

      // RFC 6749 §4.1.2.1: Invalid client_id must return error without redirect
      // State cannot be preserved since there's no valid redirect_uri to use
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error).toBe('unauthorized_client');
    });

    test('should preserve state in login redirect', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          state: 'login-state-789',
        },
      });

      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('state')).toBe('login-state-789');
    });

    test('should handle missing state parameter', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const paramsWithoutState = { ...validParams };
      delete (paramsWithoutState as Record<string, unknown>)['state'];

      const { code, location, statusCode } = await getAuthorizationCode(
        paramsWithoutState,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
      expect(location.searchParams.has('state')).toBe(false);
    });
  });

  describe('OIDC-specific Parameters', () => {
    test('should preserve nonce parameter', async () => {
      const sessionCookie = await createAuthenticatedSession();

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          nonce: 'test-nonce-value',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
      // Nonce is stored with authorization code, verified in token endpoint
    });

    test('should handle display parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          display: 'popup',
        },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );
      expect(location.searchParams.get('display')).toBe('popup');
    });

    test('should handle max_age parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          max_age: '3600',
        },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );
      expect(location.searchParams.get('max_age')).toBe('3600');
    });

    test('should handle prompt parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          prompt: 'consent',
        },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );
      expect(location.searchParams.get('prompt')).toBe('consent');
    });
  });

  describe('Error Handling', () => {
    test('should return proper OAuth error format in redirect', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          scope: 'invalid_scope',
        },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expect(location.searchParams.has('error')).toBe(true);
      expect(location.searchParams.has('error_description')).toBe(true);
      expect(location.searchParams.has('code')).toBe(false);
      expect(location.searchParams.has('access_token')).toBe(false);
    });

    test('should return proper OAuth error format as JSON when redirect_uri invalid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          redirect_uri: 'https://evil.com',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();

      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe('string');
      expect(body.error_description).toBeDefined();
      expect(typeof body.error_description).toBe('string');
    });
  });

  describe('Security Validations', () => {
    test('should prevent open redirect attacks', async () => {
      const maliciousUris = [
        'https://evil.com/callback',
        'http://evil.com/steal-code',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const uri of maliciousUris) {
        const res = await app.inject({
          method: 'GET',
          url: '/application/oauth/authorize',
          query: {
            ...validParams,
            redirect_uri: uri,
          },
        });

        // Should return 400, not redirect
        expect(res.statusCode).toBe(400);
        expect(res.headers.location).toBeUndefined();
      }
    });

    test('should validate redirect_uri before redirecting errors', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          client_id: 'invalid',
          redirect_uri: 'https://attacker.com',
        },
      });

      // Should return JSON error, not redirect to attacker.com
      expect(res.statusCode).toBe(400);
      expect(res.headers.location).toBeUndefined();
    });

    test('should not expose authorization codes in error responses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          scope: 'invalid',
        },
      });

      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expect(location.searchParams.has('code')).toBe(false);
      expect(location.searchParams.get('error')).toBe('invalid_scope');
    });
  });
});
