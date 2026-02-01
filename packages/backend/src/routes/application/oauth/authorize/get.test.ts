import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  generateUniqueEmail,
  grantConsent,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '@/test-utils/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createServer({
    config: {
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      clients: [TEST_OAUTH_CLIENT_CONFIG],
    },
  });
});

afterAll(async () => {
  await app.close();
});

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

/**
 * Helper: Get authorization code with consent granted
 * This should be used in most tests that expect an authorization code
 */
async function getAuthorizationCodeWithConsent(
  params: Record<string, string>,
  sessionCookie: string,
): Promise<{ code: string | null; location: URL; statusCode: number }> {
  // Grant consent first
  const consentParams: {
    client_id: string;
    redirect_uri: string;
    response_type?: string;
    scope?: string;
    state?: string;
    nonce?: string;
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
  } = {
    client_id: params['client_id'] || TEST_OAUTH_CLIENT.clientId,
    redirect_uri: params['redirect_uri'] || TEST_OAUTH_CLIENT.redirectUri,
  };

  if (params['response_type']) {
    consentParams.response_type = params['response_type'];
  }
  if (params['scope']) {
    consentParams.scope = params['scope'];
  }
  if (params['state']) {
    consentParams.state = params['state'];
  }
  if (params['nonce']) {
    consentParams.nonce = params['nonce'];
  }
  if (params['code_challenge']) {
    consentParams.code_challenge = params['code_challenge'];
  }
  if (params['code_challenge_method']) {
    consentParams.code_challenge_method = params['code_challenge_method'] as
      | 'S256'
      | 'plain';
  }

  await grantConsent(app, sessionCookie, consentParams);

  return getAuthorizationCode(params, sessionCookie);
}

describe('GET /application/oauth/authorize', () => {
  const validParams = {
    response_type: 'code',
    client_id: TEST_OAUTH_CLIENT.clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, location, statusCode } =
        await getAuthorizationCodeWithConsent(validParams, sessionCookie);

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
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
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
      const sessionCookie = await createAuthenticatedSession(app);

      const minimalParams = {
        response_type: 'code',
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      };

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
        minimalParams,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should handle all OIDC scopes correctly', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
        {
          ...validParams,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
        {
          ...validParams,
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: 'S256',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should accept plain code_challenge_method', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
        {
          ...validParams,
          code_challenge: TEST_PKCE.codeChallenge,
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });

    test('should allow authorization without PKCE', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
        validParams,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
    });
  });

  describe('State Parameter Handling', () => {
    test('should preserve state in successful redirect', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { location, statusCode } = await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const paramsWithoutState = { ...validParams };
      delete (paramsWithoutState as Record<string, unknown>)['state'];

      const { code, location, statusCode } =
        await getAuthorizationCodeWithConsent(
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
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
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

  describe('OIDC Prompt Parameter (prompt=none)', () => {
    test('should return login_required when prompt=none and user not authenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          prompt: 'none',
        },
        // No session cookie - user not authenticated
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expectRedirectError(
        location,
        'login_required',
        'End-User authentication',
      );
      expect(location.searchParams.get('state')).toBe(validParams.state);
    });

    test('should return consent_required when prompt=none and consent not granted', async () => {
      // Create a new user directly in the database to ensure no prior consent
      const uniqueEmail = generateUniqueEmail('prompt-none-consent');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        uniqueEmail,
        'TestPassword123!',
        { emailVerified: true },
      );

      // Request authorization with prompt=none but without prior consent
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          prompt: 'none',
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expectRedirectError(location, 'consent_required', 'End-User consent');
      expect(location.searchParams.get('state')).toBe(validParams.state);
    });

    test('should issue code when prompt=none with valid session and prior consent', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // First, grant consent
      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
      });

      // Then request with prompt=none
      const { code, location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          prompt: 'none',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
      expect(location.searchParams.has('error')).toBe(false);
    });
  });

  describe('OIDC Prompt Parameter (prompt=login)', () => {
    test('should redirect to login page when prompt=login and user not authenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          prompt: 'login',
        },
        // No session cookie
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('prompt')).toBe('login');
    });

    test('should preserve prompt=login in login redirect params', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          prompt: 'login',
        },
      });

      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      expect(location.searchParams.get('prompt')).toBe('login');
      expect(location.searchParams.get('client_id')).toBe(
        TEST_OAUTH_CLIENT.clientId,
      );
    });
  });

  describe('OIDC Prompt Parameter (prompt=consent)', () => {
    test('should redirect to consent page when prompt=consent even with prior consent', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      // Grant consent first
      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
      });

      // Request with prompt=consent should still show consent page
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          prompt: 'consent',
        },
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      // Should redirect to consent page
      expect(location.pathname).toBe('/consent');
    });

    test('should redirect to login when prompt=consent and user not authenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/application/oauth/authorize',
        query: {
          ...validParams,
          prompt: 'consent',
        },
        // No session cookie
      });

      expect(res.statusCode).toBe(302);
      const location = new URL(
        res.headers.location as string,
        'http://localhost:8080',
      );

      // Should redirect to login first
      expect(location.pathname).toBe('/login');
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
