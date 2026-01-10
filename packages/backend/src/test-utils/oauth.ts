import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';
import { DEFAULT_SCOPES, TEST_OAUTH_CLIENT } from './fixtures.js';
import { createAuthenticatedSession } from './helpers.js';

/**
 * Parameters for getting authorization code
 */
export interface GetAuthorizationCodeParams {
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  nonce?: string;
  sessionCookie: string;
}

/**
 * Result from authorization code request
 */
export interface AuthorizationCodeResult {
  code: string;
  location: URL;
  statusCode: number;
}

/**
 * Get authorization code from /authorize endpoint.
 * This is a common helper for OAuth flow tests.
 *
 * @param app - Fastify instance
 * @param params - Authorization request parameters
 * @returns Authorization code and redirect location
 */
export async function getAuthorizationCode(
  app: FastifyInstance,
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

  const queryParams: Record<string, string> = {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  };

  if (codeChallenge) {
    queryParams['code_challenge'] = codeChallenge;
    queryParams['code_challenge_method'] = codeChallengeMethod || 'S256';
  }

  if (nonce) {
    queryParams['nonce'] = nonce;
  }

  const res = await app.inject({
    method: 'GET',
    url: '/application/oauth/authorize',
    query: queryParams,
    cookies: { session: sessionCookie },
  });

  expect(res.statusCode).toBe(302);

  const location = new URL(
    res.headers.location as string,
    'http://localhost:8080',
  );
  const code = location.searchParams.get('code');

  expect(code).toBeDefined();
  expect(code).not.toBe('');

  return {
    code: code as string,
    location,
    statusCode: res.statusCode,
  };
}

/**
 * Parameters for token exchange
 */
export interface ExchangeCodeParams {
  code: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  codeVerifier?: string;
}

/**
 * Exchange authorization code for tokens.
 *
 * @param app - Fastify instance
 * @param params - Token request parameters
 * @returns Token response
 */
export async function exchangeCodeForTokens(
  app: FastifyInstance,
  params: ExchangeCodeParams,
) {
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

  return app.inject({
    method: 'POST',
    url: '/application/oauth/token',
    payload,
  });
}

/**
 * Parameters for refresh token request
 */
export interface RefreshTokenParams {
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Refresh access token using refresh token.
 *
 * @param app - Fastify instance
 * @param params - Refresh token request parameters
 * @returns Token response
 */
export async function refreshAccessToken(
  app: FastifyInstance,
  params: RefreshTokenParams,
) {
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

  return app.inject({
    method: 'POST',
    url: '/application/oauth/token',
    payload,
  });
}

/**
 * Parameters for getting access token
 */
export interface GetAccessTokenParams {
  scope?: string;
  sessionCookie?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  codeVerifier?: string;
}

/**
 * Complete OAuth flow and get access token.
 * This is a convenience helper that creates session, gets auth code, and exchanges for token.
 *
 * @param app - Fastify instance
 * @param params - Access token request parameters
 * @returns Access token string
 */
export async function getAccessToken(
  app: FastifyInstance,
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

  // Get authorization code
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

  expect(tokenRes.statusCode).toBe(200);
  const { access_token } = tokenRes.json();
  expect(access_token).toBeDefined();

  return access_token;
}

/**
 * Get user info using access token.
 *
 * @param app - Fastify instance
 * @param accessToken - Access token
 * @returns UserInfo response
 */
export async function getUserInfo(app: FastifyInstance, accessToken: string) {
  return app.inject({
    method: 'GET',
    url: '/application/oauth/userinfo',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}
