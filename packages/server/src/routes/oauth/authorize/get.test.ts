import { testClient } from 'hono/testing';
import * as jose from 'jose';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import { encrypt } from '../../../lib/crypto.ts';
import type { ServiceContainer } from '../../../services/container.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  generateUniqueEmail,
  getLocationHeader,
  grantConsent,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.ts';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

const QUERY_REDIRECT_CLIENT = {
  clientId: 'query-redirect-client',
  clientSecret: 'query-redirect-client-secret',
  redirectUri: 'http://localhost:3002/callback?tenant=alpha',
};

const QUERY_REDIRECT_CLIENT_CONFIG = {
  id: 'query-redirect-client-config',
  name: 'Query Redirect Client',
  client_id: QUERY_REDIRECT_CLIENT.clientId,
  client_secret: QUERY_REDIRECT_CLIENT.clientSecret,
  redirect_uris: [QUERY_REDIRECT_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
};

const PUBLIC_OAUTH_CLIENT = {
  clientId: 'authorize-public-pkce-client',
  redirectUri: 'http://localhost:8080/authorize-public-callback',
};

const PUBLIC_OAUTH_CLIENT_CONFIG = {
  id: 'authorize-public-pkce-client-config',
  name: 'Authorize Public PKCE Client',
  client_id: PUBLIC_OAUTH_CLIENT.clientId,
  redirect_uris: [PUBLIC_OAUTH_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
};

const IMPLICIT_ID_TOKEN_CLIENT = {
  clientId: 'implicit-id-token-client',
  clientSecret: 'implicit-id-token-client-secret',
  redirectUri: 'http://localhost:8080/implicit-callback',
};

const IMPLICIT_ID_TOKEN_CLIENT_CONFIG = {
  id: 'implicit-id-token-client-config',
  name: 'Implicit ID Token Client',
  client_id: IMPLICIT_ID_TOKEN_CLIENT.clientId,
  client_secret: IMPLICIT_ID_TOKEN_CLIENT.clientSecret,
  redirect_uris: [IMPLICIT_ID_TOKEN_CLIENT.redirectUri],
  response_types: ['id_token'],
  grant_types: ['implicit'],
  scope: 'openid profile email',
};

const SKIP_CONSENT_CLIENT = {
  clientId: 'skip-consent-client',
  clientSecret: 'skip-consent-client-secret',
  redirectUri: 'http://localhost:8080/skip-consent-callback',
};

const SKIP_CONSENT_CLIENT_CONFIG = {
  id: 'skip-consent-client-config',
  name: 'Skip Consent Client',
  client_id: SKIP_CONSENT_CLIENT.clientId,
  client_secret: SKIP_CONSENT_CLIENT.clientSecret,
  redirect_uris: [SKIP_CONSENT_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
  skip_consent: true,
};

beforeAll(async () => {
  ({ app, services, cleanup } = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [
      TEST_OAUTH_CLIENT_CONFIG,
      QUERY_REDIRECT_CLIENT_CONFIG,
      PUBLIC_OAUTH_CLIENT_CONFIG,
      IMPLICIT_ID_TOKEN_CLIENT_CONFIG,
      SKIP_CONSENT_CLIENT_CONFIG,
    ],
  }));
});

afterAll(async () => {
  await cleanup();
});

/**
 * Helper: Get authorization code with optional session
 */
async function getAuthorizationCode(
  params: Record<string, string>,
  sessionCookie?: string,
): Promise<{ code: string | null; location: URL; statusCode: number }> {
  const client = testClient(app);

  const query = {
    response_type: params['response_type'] || 'code',
    client_id: params['client_id'] || '',
    redirect_uri: params['redirect_uri'] || '',
    ...(params['scope'] != null ? { scope: params['scope'] } : {}),
    ...(params['state'] != null ? { state: params['state'] } : {}),
    ...(params['nonce'] != null ? { nonce: params['nonce'] } : {}),
    ...(params['code_challenge'] != null
      ? { code_challenge: params['code_challenge'] }
      : {}),
    ...(params['code_challenge_method'] != null
      ? {
          code_challenge_method: params['code_challenge_method'] as
            | 'S256'
            | 'plain',
        }
      : {}),
    ...(params['prompt'] != null
      ? {
          prompt: params['prompt'] as
            | 'none'
            | 'login'
            | 'consent'
            | 'select_account',
        }
      : {}),
    ...(params['max_age'] != null ? { max_age: params['max_age'] } : {}),
    ...(params['reauthenticated'] != null
      ? { reauthenticated: params['reauthenticated'] }
      : {}),
    ...(params['display'] != null
      ? {
          display: params['display'] as 'page' | 'popup' | 'touch' | 'wap',
        }
      : {}),
  };

  const res = await client.oauth.authorize.$get(
    {
      query,
    },
    sessionCookie
      ? { headers: { Cookie: `session=${sessionCookie}` } }
      : undefined,
  );

  const location = new URL(getLocationHeader(res), 'http://localhost:8080');

  return {
    code: location.searchParams.get('code'),
    location,
    statusCode: res.status,
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

async function createSessionCookieWithAuthTime(
  authenticatedAt: number,
): Promise<string> {
  return encrypt(
    JSON.stringify({
      user: {
        sub: TEST_USER_CONFIG.sub,
        authenticated_at: authenticatedAt,
      },
    }),
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
}

describe('GET /oauth/authorize', () => {
  const validParams = {
    response_type: 'code',
    client_id: TEST_OAUTH_CLIENT.clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    scope: 'openid profile email',
    state: 'random-state-string',
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
  };

  describe('Success Cases', () => {
    test('should redirect to login when user is not authenticated', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: validParams,
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBeDefined();

      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

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

    test('should issue code for skip_consent client without prior user consent', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, location, statusCode } = await getAuthorizationCode(
        {
          response_type: 'code',
          client_id: SKIP_CONSENT_CLIENT.clientId,
          redirect_uri: SKIP_CONSENT_CLIENT.redirectUri,
          scope: 'openid profile email',
          state: 'skip-consent-state',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(location.pathname).toBe('/skip-consent-callback');
      expect(code).toBeTruthy();
      expect(location.searchParams.get('state')).toBe('skip-consent-state');
      expect(location.searchParams.has('error')).toBe(false);
    });

    test('should preserve all OAuth parameters in login redirect', async () => {
      const paramsWithNonce = {
        ...validParams,
        nonce: 'test-nonce',
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
        prompt: 'login' as const,
      };

      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: paramsWithNonce,
      });

      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

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
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          client_id: 'non-existent-client',
        },
      });

      // RFC 6749 §4.1.2.1: Invalid client_id must NOT redirect
      const json = await assertJsonBody(res, 400);
      expect(json.error).toBe('unauthorized_client');
      expect(json.error_description).toContain('OAuth client was not found');
    });

    test('should return error as JSON for invalid client (no redirect)', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          client_id: 'invalid-client',
          state: 'my-unique-state',
        },
      });

      // RFC 6749 §4.1.2.1: Invalid client_id must NOT redirect
      // State parameter cannot be preserved in JSON response (no redirect)
      const json = await assertJsonBody(res, 400);
      expect(json.error).toBe('unauthorized_client');
      expect(json.error_description).toBeDefined();
    });
  });

  describe('Redirect URI Validation', () => {
    test('should reject redirect_uri with fragment', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          redirect_uri: `${TEST_OAUTH_CLIENT.redirectUri}#access_token=leak`,
        },
      });

      const body = await assertJsonBody(res, 400);
      expect(res.headers.get('location')).toBeNull();
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toContain('redirect URI');
    });

    test('should reject redirect_uri with userinfo component', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          redirect_uri: 'http://attacker@localhost:8080/callback',
        },
      });

      const body = await assertJsonBody(res, 400);
      expect(res.headers.get('location')).toBeNull();
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toContain('redirect URI');
    });

    test('should reject default-port normalization mismatch', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          client_id: QUERY_REDIRECT_CLIENT.clientId,
          redirect_uri: 'http://example.com:80/callback?tenant=alpha',
        },
      });

      const body = await assertJsonBody(res, 400);
      expect(res.headers.get('location')).toBeNull();
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toContain('redirect URI');
    });

    test('should reject percent-encoded path mismatch', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          redirect_uri: 'http://localhost:8080/%63allback',
        },
      });

      const body = await assertJsonBody(res, 400);
      expect(res.headers.get('location')).toBeNull();
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toContain('redirect URI');
    });

    test('should reject duplicate query parameter ambiguity', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          client_id: QUERY_REDIRECT_CLIENT.clientId,
          redirect_uri:
            'http://example.com/callback?tenant=alpha&tenant=attacker',
        },
      });

      const body = await assertJsonBody(res, 400);
      expect(res.headers.get('location')).toBeNull();
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toContain('redirect URI');
    });

    test('should preserve exact registered redirect_uri query string', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const params = {
        ...validParams,
        client_id: QUERY_REDIRECT_CLIENT.clientId,
        redirect_uri: QUERY_REDIRECT_CLIENT.redirectUri,
        scope: 'openid',
        state: 'query-redirect-state',
      };

      await grantConsent(app, sessionCookie, params);

      const { code, location, statusCode } = await getAuthorizationCode(
        params,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
      expect(location.origin + location.pathname).toBe(
        'http://localhost:3002/callback',
      );
      expect(location.searchParams.get('tenant')).toBe('alpha');
      expect(location.searchParams.get('state')).toBe('query-redirect-state');
    });

    test('should return 400 for unregistered redirect_uri', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          redirect_uri: 'https://evil.com/callback',
        },
      });

      const body = await assertJsonBody(res, 400);
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toContain('redirect URI');
    });

    test('should not redirect errors to invalid redirect_uri', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          client_id: 'invalid',
          redirect_uri: 'https://evil.com/callback',
        },
      });

      // Should return JSON error, not redirect
      expect(res.status).toBe(400);
      expect(res.headers.get('location')).toBeNull();
    });

    test('should not redirect unexpected errors before redirect_uri validation to the supplied redirect_uri', async () => {
      const authorizeSpy = vi
        .spyOn(services.oauthAuthorizeService, 'authorize')
        .mockRejectedValueOnce(new Error('database temporarily unavailable'));
      const client = testClient(app);

      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          redirect_uri: 'https://evil.com/callback',
        },
      });

      expect(authorizeSpy).toHaveBeenCalledOnce();
      expect(res.status).toBe(500);
      expect(res.headers.get('location')).toBeNull();
      const body = await assertJsonBody(res, 500);
      expect(body.error).toBe('server_error');
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
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          response_type: 'token',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

      expectRedirectError(location, 'unsupported_response_type');
    });

    test('should return an id_token in the redirect fragment for implicit id_token flow', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      await grantConsent(app, sessionCookie, {
        client_id: IMPLICIT_ID_TOKEN_CLIENT.clientId,
        redirect_uri: IMPLICIT_ID_TOKEN_CLIENT.redirectUri,
        response_type: 'id_token',
        scope: 'openid profile email',
        nonce: 'implicit-nonce-123',
      });

      const { location, statusCode } = await getAuthorizationCode(
        {
          response_type: 'id_token',
          client_id: IMPLICIT_ID_TOKEN_CLIENT.clientId,
          redirect_uri: IMPLICIT_ID_TOKEN_CLIENT.redirectUri,
          scope: 'openid profile email',
          nonce: 'implicit-nonce-123',
          state: 'implicit-state-123',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(location.origin + location.pathname).toBe(
        IMPLICIT_ID_TOKEN_CLIENT.redirectUri,
      );
      expect(location.searchParams.has('code')).toBe(false);

      const fragment = new URLSearchParams(location.hash.slice(1));
      const idToken = fragment.get('id_token');
      expect(idToken).toBeTruthy();
      expect(fragment.get('token_type')).toBe('Bearer');
      expect(fragment.get('state')).toBe('implicit-state-123');

      const decoded = jose.decodeJwt(idToken ?? '');
      expect(decoded.sub).toBe(TEST_USER_CONFIG.sub);
      expect(decoded.aud).toBe(IMPLICIT_ID_TOKEN_CLIENT.clientId);
      expect(decoded['nonce']).toBe('implicit-nonce-123');
      expect(decoded['email']).toBe(TEST_USER_CONFIG.email);
      expect(decoded['email_verified']).toBe(true);
      expect(decoded['name']).toBe(TEST_USER_CONFIG.email);
    });

    test('should reject implicit id_token flow without nonce', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { location, statusCode } = await getAuthorizationCode(
        {
          response_type: 'id_token',
          client_id: IMPLICIT_ID_TOKEN_CLIENT.clientId,
          redirect_uri: IMPLICIT_ID_TOKEN_CLIENT.redirectUri,
          scope: 'openid profile email',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      const fragment = new URLSearchParams(location.hash.slice(1));
      expect(fragment.get('error') ?? location.searchParams.get('error')).toBe(
        'invalid_request',
      );
    });

    test('should reject implicit id_token flow without openid scope', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { location, statusCode } = await getAuthorizationCode(
        {
          response_type: 'id_token',
          client_id: IMPLICIT_ID_TOKEN_CLIENT.clientId,
          redirect_uri: IMPLICIT_ID_TOKEN_CLIENT.redirectUri,
          scope: 'profile email',
          nonce: 'nonce-without-openid',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      const fragment = new URLSearchParams(location.hash.slice(1));
      expect(fragment.get('error') ?? location.searchParams.get('error')).toBe(
        'invalid_request',
      );
    });

    test('should return prompt=none login_required errors in the fragment for implicit id_token flow', async () => {
      const { location, statusCode } = await getAuthorizationCode({
        response_type: 'id_token',
        client_id: IMPLICIT_ID_TOKEN_CLIENT.clientId,
        redirect_uri: IMPLICIT_ID_TOKEN_CLIENT.redirectUri,
        scope: 'openid profile email',
        nonce: 'implicit-prompt-none-nonce',
        state: 'implicit-prompt-none-state',
        prompt: 'none',
      });

      expect(statusCode).toBe(302);
      const fragment = new URLSearchParams(location.hash.slice(1));
      expect(location.searchParams.has('error')).toBe(false);
      expect(fragment.get('error')).toBe('login_required');
      expect(fragment.get('state')).toBe('implicit-prompt-none-state');
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

    test('should redirect unsupported response_mode as invalid_request after client validation', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);
      const res = await client.oauth.authorize.$get(
        {
          query: {
            ...validParams,
            response_mode: 'jwt' as 'query',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');
      expectRedirectError(location, 'invalid_request', 'authorization request');
      expect(location.searchParams.get('state')).toBe(validParams.state);
    });
  });

  describe('Scope Validation', () => {
    test('should return invalid_scope for disallowed scope', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          scope: 'admin super_user',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

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

    test('should reject confidential client authorization with plain code_challenge_method', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const plainVerifier = 'plain-verifier-string-for-testing-purposes-123';

      const { location, statusCode } = await getAuthorizationCodeWithConsent(
        {
          ...validParams,
          code_challenge: plainVerifier,
          code_challenge_method: 'plain',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expectRedirectError(location, 'invalid_request');
    });

    test('should reject code_challenge without explicit S256 method', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { location, statusCode } = await getAuthorizationCodeWithConsent(
        {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          state: 'random-state-string',
          code_challenge: TEST_PKCE.codeChallenge,
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expectRedirectError(location, 'invalid_request');
    });

    test('should reject code_challenge_method without code_challenge', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { location, statusCode } = await getAuthorizationCodeWithConsent(
        {
          response_type: 'code',
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          scope: 'openid profile email',
          state: 'random-state-string',
          code_challenge_method: 'S256',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expectRedirectError(location, 'invalid_request');
    });

    test('should allow confidential client authorization without code_challenge', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const paramsWithoutPkce = {
        response_type: 'code',
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid profile email',
        state: 'random-state-string',
      };

      await grantConsent(app, sessionCookie, paramsWithoutPkce);
      const { code, location, statusCode } = await getAuthorizationCode(
        paramsWithoutPkce,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeTruthy();
      expect(location.origin + location.pathname).toBe(
        paramsWithoutPkce.redirect_uri,
      );
      expect(location.searchParams.get('state')).toBe(paramsWithoutPkce.state);
    });

    test.each([
      ['short', 'short-code-challenge'],
      ['long', 'a'.repeat(129)],
      [
        'non-unreserved',
        'invalid-code-challenge-with-/-character-value-1234567890',
      ],
    ])('should reject %s code_challenge format', async (_label, codeChallenge) => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { location, statusCode } = await getAuthorizationCodeWithConsent(
        {
          ...validParams,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expectRedirectError(location, 'invalid_request');
    });

    test('should reject public client authorization without code_challenge', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const paramsWithoutPkce = {
        response_type: 'code',
        client_id: PUBLIC_OAUTH_CLIENT.clientId,
        redirect_uri: PUBLIC_OAUTH_CLIENT.redirectUri,
        scope: 'openid profile email',
        state: 'random-state-string',
      };

      const { location, statusCode } = await getAuthorizationCode(
        paramsWithoutPkce,
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expectRedirectError(location, 'invalid_request');
    });

    test('should reject public client authorization with plain code_challenge_method', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          client_id: PUBLIC_OAUTH_CLIENT.clientId,
          redirect_uri: PUBLIC_OAUTH_CLIENT.redirectUri,
          code_challenge: 'plain-challenge',
          code_challenge_method: 'plain',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expectRedirectError(location, 'invalid_request');
    });

    test('should allow public client authorization with S256 code_challenge_method', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const { code, statusCode } = await getAuthorizationCodeWithConsent(
        {
          ...validParams,
          client_id: PUBLIC_OAUTH_CLIENT.clientId,
          redirect_uri: PUBLIC_OAUTH_CLIENT.redirectUri,
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: 'S256',
        },
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
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          client_id: 'invalid',
          state: 'error-state-456',
        },
      });

      // RFC 6749 §4.1.2.1: Invalid client_id must return error without redirect
      // State cannot be preserved since there's no valid redirect_uri to use
      const json = await assertJsonBody(res, 400);
      expect(json.error).toBe('unauthorized_client');
    });

    test('should preserve state in login redirect', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          state: 'login-state-789',
        },
      });

      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

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
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          display: 'popup',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');
      expect(location.searchParams.get('display')).toBe('popup');
    });

    test('should handle max_age parameter', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          max_age: '3600',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');
      expect(location.searchParams.get('max_age')).toBe('3600');
    });

    test('should handle prompt parameter', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          prompt: 'consent',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');
      expect(location.searchParams.get('prompt')).toBe('consent');
    });

    test('should accept prompt=select_account when account selection is disabled', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);
      const res = await client.oauth.authorize.$get(
        {
          query: {
            ...validParams,
            prompt: 'select_account',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');
      expect(location.pathname).toBe('/callback');
      expect(location.searchParams.get('code')).toBeTruthy();
      expect(location.searchParams.get('state')).toBe(validParams.state);
    });
  });

  describe('OIDC Prompt Parameter (prompt=none)', () => {
    test('should return login_required when prompt=none and user not authenticated', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          prompt: 'none',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

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
        services,
        uniqueEmail,
        'TestPassword123!',
        { emailVerified: true },
      );

      // Request authorization with prompt=none but without prior consent
      const client = testClient(app);
      const res = await client.oauth.authorize.$get(
        {
          query: {
            ...validParams,
            prompt: 'none',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

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
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          prompt: 'login',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('prompt')).toBe('login');
    });

    test('should preserve prompt=login in login redirect params', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          prompt: 'login',
        },
      });

      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

      expect(location.searchParams.get('prompt')).toBe('login');
      expect(location.searchParams.get('client_id')).toBe(
        TEST_OAUTH_CLIENT.clientId,
      );
    });

    test('should redirect to login page when prompt=login and user is already authenticated', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const { location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          prompt: 'login',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('prompt')).toBe('login');
      expect(location.searchParams.has('code')).toBe(false);
    });

    test('should continue after prompt=login has just reauthenticated the user', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const { code, location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          prompt: 'login',
          reauthenticated: '1',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
      expect(location.origin + location.pathname).toBe(
        validParams.redirect_uri,
      );
    });
  });

  describe('OIDC Authentication Freshness', () => {
    test('should redirect to login when max_age=0 makes the session stale', async () => {
      const authenticatedAt = Math.floor(Date.now() / 1000) - 1;
      const sessionCookie =
        await createSessionCookieWithAuthTime(authenticatedAt);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const { location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          max_age: '0',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('max_age')).toBe('0');
      expect(location.searchParams.has('code')).toBe(false);
    });

    test('should continue after max_age=0 has just reauthenticated the user', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const { code, location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          max_age: '0',
          reauthenticated: '1',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(code).toBeDefined();
      expect(location.origin + location.pathname).toBe(
        validParams.redirect_uri,
      );
    });

    test('should not accept stale reauthentication markers', async () => {
      const authenticatedAt = Math.floor(Date.now() / 1000) - 120;
      const sessionCookie =
        await createSessionCookieWithAuthTime(authenticatedAt);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const { location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          prompt: 'login',
          reauthenticated: '1',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.has('code')).toBe(false);
    });

    test('should return login_required when prompt=none and max_age marks the session stale', async () => {
      const authenticatedAt = Math.floor(Date.now() / 1000) - 600;
      const sessionCookie =
        await createSessionCookieWithAuthTime(authenticatedAt);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const { location, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          prompt: 'none',
          max_age: '300',
        },
        sessionCookie,
      );

      expect(statusCode).toBe(302);
      expectRedirectError(
        location,
        'login_required',
        'End-User authentication',
      );
      expect(location.searchParams.get('state')).toBe(validParams.state);
    });

    test('should include the session authentication time in ID Token after a max_age request', async () => {
      const authenticatedAt = Math.floor(Date.now() / 1000) - 30;
      const sessionCookie =
        await createSessionCookieWithAuthTime(authenticatedAt);

      await grantConsent(app, sessionCookie, {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: validParams.scope,
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: TEST_PKCE.codeChallengeMethod,
      });

      const { code, statusCode } = await getAuthorizationCode(
        {
          ...validParams,
          nonce: 'freshness-nonce',
          max_age: '300',
        },
        sessionCookie,
      );
      expect(statusCode).toBe(302);
      if (!code) {
        throw new Error('Expected authorization code');
      }

      const client = testClient(app);
      const tokenRes = await client.oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          code,
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          code_verifier: TEST_PKCE.codeVerifier,
        },
      });
      const tokens = await tokenRes.json();
      const idToken = tokens.id_token;
      if (typeof idToken !== 'string') {
        throw new Error('Expected ID Token');
      }

      const decoded = jose.decodeJwt(idToken);
      expect(decoded['auth_time']).toBe(authenticatedAt);
      expect(decoded['nonce']).toBe('freshness-nonce');
    });

    test('should redirect invalid prompt combinations as invalid_request', async () => {
      const url = new URL('/oauth/authorize', 'http://localhost');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', TEST_OAUTH_CLIENT.clientId);
      url.searchParams.set('redirect_uri', TEST_OAUTH_CLIENT.redirectUri);
      url.searchParams.set('scope', validParams.scope);
      url.searchParams.set('state', validParams.state);
      url.searchParams.set('code_challenge', TEST_PKCE.codeChallenge);
      url.searchParams.set(
        'code_challenge_method',
        TEST_PKCE.codeChallengeMethod,
      );
      url.searchParams.set('prompt', 'none login');

      const res = await app.request(`${url.pathname}${url.search}`);

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');
      expectRedirectError(location, 'invalid_request', 'prompt');
      expect(location.searchParams.get('state')).toBe(validParams.state);
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
      const client = testClient(app);
      const res = await client.oauth.authorize.$get(
        {
          query: {
            ...validParams,
            prompt: 'consent',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

      // Should redirect to consent page
      expect(location.pathname).toBe('/consent');
    });

    test('should redirect to login when prompt=consent and user not authenticated', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          prompt: 'consent',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

      // Should redirect to login first
      expect(location.pathname).toBe('/login');
    });
  });

  describe('Error Handling', () => {
    test('should return proper OAuth error format in redirect', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          scope: 'invalid_scope',
        },
      });

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

      expect(location.searchParams.has('error')).toBe(true);
      expect(location.searchParams.has('error_description')).toBe(true);
      expect(location.searchParams.has('code')).toBe(false);
      expect(location.searchParams.has('access_token')).toBe(false);
    });

    test('should return proper OAuth error format as JSON when redirect_uri invalid', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          redirect_uri: 'https://evil.com',
        },
      });

      const body = await assertJsonBody(res, 400);

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

      const client = testClient(app);
      for (const uri of maliciousUris) {
        const res = await client.oauth.authorize.$get({
          query: {
            ...validParams,
            redirect_uri: uri,
          },
        });

        // Should return 400, not redirect
        expect(res.status).toBe(400);
        expect(res.headers.get('location')).toBeNull();
      }
    });

    test('should validate redirect_uri before redirecting errors', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          client_id: 'invalid',
          redirect_uri: 'https://attacker.com',
        },
      });

      // Should return JSON error, not redirect to attacker.com
      expect(res.status).toBe(400);
      expect(res.headers.get('location')).toBeNull();
    });

    test('should not expose authorization codes in error responses', async () => {
      const client = testClient(app);
      const res = await client.oauth.authorize.$get({
        query: {
          ...validParams,
          scope: 'invalid',
        },
      });

      const location = new URL(getLocationHeader(res), 'http://localhost:8080');

      expect(location.searchParams.has('code')).toBe(false);
      expect(location.searchParams.get('error')).toBe('invalid_scope');
    });
  });
});
