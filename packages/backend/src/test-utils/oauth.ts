import type { AppType } from '@backend/app.js';
import { testClient } from 'hono/testing';
import { DEFAULT_SCOPES, TEST_OAUTH_CLIENT } from './fixtures.js';
import { createAuthenticatedSession, grantConsent } from './helpers.js';

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

  const client = testClient(app);

  const authorizeQuery = {
    response_type: 'code' as const,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    ...(codeChallenge != null
      ? {
          code_challenge: codeChallenge,
          code_challenge_method: (codeChallengeMethod || 'S256') as
            | 'S256'
            | 'plain',
        }
      : {}),
    ...(nonce != null ? { nonce } : {}),
  };

  const res = await client.application.oauth.authorize.$get(
    { query: authorizeQuery },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );

  if (res.status !== 302) {
    const body = await res.text();
    throw new Error(`Expected 302 redirect but got ${res.status}: ${body}`);
  }

  const locationHeader = res.headers.get('location');
  if (!locationHeader) {
    throw new Error('No Location header in authorize response');
  }

  const location = new URL(locationHeader, 'http://localhost:8080');
  const code = location.searchParams.get('code');

  if (!code) {
    throw new Error(`No authorization code in redirect: ${locationHeader}`);
  }

  return {
    code,
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

  const client = testClient(app);
  return client.application.oauth.token.$post({
    json: {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
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

  const client = testClient(app);
  return client.application.oauth.token.$post({
    json: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
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

  if (tokenRes.status !== 200) {
    const body = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} - ${body}`);
  }

  const { access_token } = await tokenRes.json();
  if (!access_token) {
    throw new Error('No access_token in token response');
  }

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
  const client = testClient(app);
  return client.application.oauth.userinfo.$get({
    header: {
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

  const client = testClient(app);
  return client.application.oauth.introspect.$post({
    json: {
      token,
      token_type_hint: tokenTypeHint,
      client_id: clientId,
      client_secret: clientSecret,
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

  const client = testClient(app);
  return client.application.oauth.revoke.$post({
    json: {
      token,
      token_type_hint: tokenTypeHint,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });
}
