import type { AppType } from '@backend/lib/app.js';
import { expect } from 'vitest';
import { DEFAULT_SCOPES, TEST_OAUTH_CLIENT } from './fixtures.js';
import { createAuthenticatedSession, grantConsent } from './helpers.js';

/**
 * Parse redirect location from response headers.
 * Handles the common pattern of extracting and parsing the Location header.
 *
 * @param res - Response from app.request()
 * @param baseUrl - Base URL for relative redirects (default: 'http://localhost:8080')
 * @returns Parsed URL object
 *
 * @example
 * ```typescript
 * const location = parseRedirectLocation(res);
 * expect(location.searchParams.get('code')).toBeDefined();
 * ```
 */
export function parseRedirectLocation(
  res: Response,
  baseUrl = 'http://localhost:8080',
): URL {
  const locationHeader = res.headers.get('location');
  if (!locationHeader) {
    throw new Error('No Location header in response');
  }
  return new URL(locationHeader, baseUrl);
}

/**
 * Assert that a redirect response contains an OAuth error.
 *
 * @param location - Parsed redirect URL
 * @param expectedError - Expected OAuth error code
 * @param expectedDescriptionContains - Optional substring that error_description should contain
 *
 * @example
 * ```typescript
 * const location = parseRedirectLocation(res);
 * expectRedirectError(location, 'invalid_scope');
 * ```
 */
export function expectRedirectError(
  location: URL,
  expectedError: string,
  expectedDescriptionContains?: string,
): void {
  expect(location.searchParams.get('error')).toBe(expectedError);
  if (expectedDescriptionContains) {
    expect(location.searchParams.get('error_description')).toContain(
      expectedDescriptionContains,
    );
  }
  expect(location.searchParams.has('code')).toBe(false);
}

/**
 * Assert that a response redirects to the login page with preserved parameters.
 *
 * @param location - Parsed redirect URL
 * @param originalParams - Original OAuth parameters that should be preserved
 *
 * @example
 * ```typescript
 * const location = parseRedirectLocation(res);
 * expectLoginRedirect(location, validParams);
 * ```
 */
export function expectLoginRedirect(
  location: URL,
  originalParams: Record<string, string>,
): void {
  expect(location.pathname).toBe('/login');
  for (const [key, value] of Object.entries(originalParams)) {
    expect(location.searchParams.get(key)).toBe(value);
  }
}

/**
 * Parameters for getting authorization code
 */
export interface GetAuthorizationCodeParams {
  clientId?: string | undefined;
  redirectUri?: string | undefined;
  scope?: string | undefined;
  state?: string | undefined;
  codeChallenge?: string | undefined;
  codeChallengeMethod?: 'S256' | 'plain' | undefined;
  nonce?: string | undefined;
  sessionCookie: string;
}

/**
 * Result from authorization code request
 */
export interface AuthorizationCodeResult {
  code: string;
  location: URL;
  status: number;
}

/**
 * Get authorization code from /authorize endpoint.
 * This is a common helper for OAuth flow tests.
 * Automatically grants consent before requesting authorization.
 *
 * @param app - Hono app instance
 * @param params - Authorization request parameters
 * @returns Authorization code and redirect location
 */
export async function getAuthorizationCode(
  app: AppType,
  params: GetAuthorizationCodeParams,
): Promise<AuthorizationCodeResult> {
  const {
    clientId = TEST_OAUTH_CLIENT.clientId,
    redirectUri = TEST_OAUTH_CLIENT.redirectUri,
    scope = DEFAULT_SCOPES,
    state = 'test-state',
    codeChallenge,
    codeChallengeMethod,
    nonce,
    sessionCookie,
  } = params;

  // Grant consent before requesting authorization code
  const consentParams: {
    client_id: string;
    redirect_uri: string;
    scope?: string;
    state?: string;
    nonce?: string;
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
  } = {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  };

  if (nonce) {
    consentParams['nonce'] = nonce;
  }
  if (codeChallenge) {
    consentParams['code_challenge'] = codeChallenge;
  }
  if (codeChallengeMethod) {
    consentParams['code_challenge_method'] = codeChallengeMethod;
  }

  await grantConsent(app, sessionCookie, consentParams);

  const queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  });

  if (codeChallenge) {
    queryParams.set('code_challenge', codeChallenge);
    queryParams.set('code_challenge_method', codeChallengeMethod || 'S256');
  }

  if (nonce) {
    queryParams.set('nonce', nonce);
  }

  const url = `/application/oauth/authorize?${queryParams.toString()}`;
  const res = await app.request(url, {
    method: 'GET',
    headers: {
      Cookie: `session=${sessionCookie}`,
    },
  });

  expect(res.status).toBe(302);

  const locationHeader = res.headers.get('location');
  expect(locationHeader).toBeDefined();

  const location = new URL(locationHeader as string, 'http://localhost:8080');
  const code = location.searchParams.get('code');

  expect(code).toBeDefined();
  expect(code).not.toBe('');

  return {
    code: code as string,
    location,
    status: res.status,
  };
}

/**
 * Parameters for token exchange
 */
export interface ExchangeCodeParams {
  code: string;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri?: string | undefined;
  codeVerifier?: string | undefined;
}

/**
 * Exchange authorization code for tokens.
 *
 * @param app - Hono app instance
 * @param params - Token request parameters
 * @returns Token response
 */
export async function exchangeCodeForTokens(
  app: AppType,
  params: ExchangeCodeParams,
): Promise<Response> {
  const {
    code,
    clientId = TEST_OAUTH_CLIENT.clientId,
    clientSecret,
    redirectUri = TEST_OAUTH_CLIENT.redirectUri,
    codeVerifier,
  } = params;

  const payload: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
  };

  if (clientSecret) {
    payload['client_secret'] = clientSecret;
  }

  if (codeVerifier) {
    payload['code_verifier'] = codeVerifier;
  }

  return app.request('/application/oauth/token', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Parameters for refresh token request
 */
export interface RefreshTokenParams {
  refreshToken: string;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
}

/**
 * Refresh access token using refresh token.
 *
 * @param app - Hono app instance
 * @param params - Refresh token request parameters
 * @returns Token response
 */
export async function refreshAccessToken(
  app: AppType,
  params: RefreshTokenParams,
): Promise<Response> {
  const {
    refreshToken,
    clientId = TEST_OAUTH_CLIENT.clientId,
    clientSecret,
  } = params;

  const payload: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  };

  if (clientSecret) {
    payload['client_secret'] = clientSecret;
  }

  return app.request('/application/oauth/token', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Parameters for getting access token
 */
export interface GetAccessTokenParams {
  scope?: string | undefined;
  sessionCookie?: string | undefined;
  codeChallenge?: string | undefined;
  codeChallengeMethod?: 'S256' | 'plain' | undefined;
  codeVerifier?: string | undefined;
}

/**
 * Complete OAuth flow and get access token.
 * This is a convenience helper that creates session, gets auth code, and exchanges for token.
 *
 * @param app - Hono app instance
 * @param params - Access token request parameters
 * @returns Access token string
 */
export async function getAccessToken(
  app: AppType,
  params: GetAccessTokenParams = {},
): Promise<string> {
  const {
    scope = DEFAULT_SCOPES,
    sessionCookie: providedSession,
    codeChallenge,
    codeChallengeMethod,
    codeVerifier,
  } = params;

  // Create session if not provided
  const sessionCookie =
    providedSession || (await createAuthenticatedSession(app));

  // Get authorization code (this also grants consent)
  const { code } = await getAuthorizationCode(app, {
    sessionCookie,
    scope,
    codeChallenge,
    codeChallengeMethod,
  });

  // Exchange code for tokens
  const tokenRes = await exchangeCodeForTokens(app, {
    code,
    codeVerifier,
  });

  expect(tokenRes.status).toBe(200);
  const { access_token } = await tokenRes.json();
  expect(access_token).toBeDefined();

  return access_token;
}

/**
 * Get user info using access token.
 *
 * @param app - Hono app instance
 * @param accessToken - Access token
 * @returns UserInfo response
 */
export async function getUserInfo(
  app: AppType,
  accessToken: string,
): Promise<Response> {
  return app.request('/application/oauth/userinfo', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Parameters for token introspection
 */
export interface IntrospectTokenParams {
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
  clientId?: string;
  clientSecret?: string;
}

/**
 * Introspect a token using the /introspect endpoint.
 *
 * @param app - Hono app instance
 * @param params - Introspection parameters
 * @returns Introspection response
 *
 * @example
 * ```typescript
 * const res = await introspectToken(app, { token: accessToken });
 * const body = await res.json();
 * expect(body.active).toBe(true);
 * ```
 */
export async function introspectToken(
  app: AppType,
  params: IntrospectTokenParams,
): Promise<Response> {
  const {
    token,
    tokenTypeHint,
    clientId = TEST_OAUTH_CLIENT.clientId,
    clientSecret,
  } = params;

  const payload: Record<string, string> = {
    token,
    client_id: clientId,
  };

  if (tokenTypeHint) {
    payload['token_type_hint'] = tokenTypeHint;
  }

  if (clientSecret) {
    payload['client_secret'] = clientSecret;
  }

  return app.request('/application/oauth/introspect', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Parameters for token revocation
 */
export interface RevokeTokenParams {
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
  clientId?: string;
  clientSecret?: string;
}

/**
 * Revoke a token using the /revoke endpoint.
 *
 * @param app - Hono app instance
 * @param params - Revocation parameters
 * @returns Revocation response
 *
 * @example
 * ```typescript
 * const res = await revokeToken(app, { token: refreshToken });
 * expect(res.status).toBe(200);
 * ```
 */
export async function revokeToken(
  app: AppType,
  params: RevokeTokenParams,
): Promise<Response> {
  const {
    token,
    tokenTypeHint,
    clientId = TEST_OAUTH_CLIENT.clientId,
    clientSecret,
  } = params;

  const payload: Record<string, string> = {
    token,
    client_id: clientId,
  };

  if (tokenTypeHint) {
    payload['token_type_hint'] = tokenTypeHint;
  }

  if (clientSecret) {
    payload['client_secret'] = clientSecret;
  }

  return app.request('/application/oauth/revoke', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
