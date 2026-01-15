import { decodeJwt } from 'jose';
import type {
  IDTokenPayload,
  IntrospectionResponse,
  JWKS,
  OIDCConfig,
  OpenIDConfiguration,
  TokenResponse,
  UserInfo,
} from '@/types/oidc';
import { env } from './env';

/**
 * Cached OIDC configuration
 */
let cachedConfig: OIDCConfig | null = null;

/**
 * Fetch OpenID Configuration from discovery endpoint
 */
export async function fetchOpenIDConfiguration(
  issuer: string,
): Promise<OpenIDConfiguration> {
  const discoveryUrl = `${issuer}/application/oauth/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenID Configuration: ${response.statusText}`,
    );
  }

  return (await response.json()) as OpenIDConfiguration;
}

/**
 * Initialize and get OIDC configuration
 * Fetches discovery document and merges with client config
 */
export async function initializeOIDCConfig(): Promise<OIDCConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const discovery = await fetchOpenIDConfiguration(env.OIDC_ISSUER);

  cachedConfig = {
    issuer: discovery.issuer,
    authorization_endpoint: discovery.authorization_endpoint,
    token_endpoint: discovery.token_endpoint,
    userinfo_endpoint: discovery.userinfo_endpoint || '',
    introspection_endpoint: discovery.introspection_endpoint || '',
    revocation_endpoint: discovery.revocation_endpoint || '',
    jwks_uri: discovery.jwks_uri,
    openid_configuration_uri: `${discovery.issuer}/.well-known/openid-configuration`,

    client_id: env.OIDC_CLIENT_ID,
    redirect_uri: env.OIDC_REDIRECT_URI,

    scope: env.OIDC_SCOPE,
    response_type: 'code',
  };

  return cachedConfig;
}

/**
 * Get cached OIDC configuration
 * Throws if not initialized
 */
export function getOIDCConfig(): OIDCConfig {
  if (!cachedConfig) {
    throw new Error(
      'OIDC config not initialized. Call initializeOIDCConfig() first.',
    );
  }
  return cachedConfig;
}

/**
 * Check if OIDC configuration is initialized
 */
export function isOIDCConfigInitialized(): boolean {
  return cachedConfig !== null;
}

/**
 * Build authorization URL for OAuth/OIDC flow
 */
export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  nonce: string,
): string {
  const config = getOIDCConfig();
  const params = new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    response_type: config.response_type,
    scope: config.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    nonce,
  });

  return `${config.authorization_endpoint}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 * Public Client: No client_secret required, uses PKCE
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const config = getOIDCConfig();
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirect_uri,
    client_id: config.client_id,
    code_verifier: codeVerifier,
  });

  const response = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Refresh access token using refresh token
 * Public Client: No client_secret required
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const config = getOIDCConfig();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.client_id,
  });

  const response = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Fetch user info from userinfo endpoint
 */
export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const config = getOIDCConfig();
  const response = await fetch(config.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`UserInfo fetch failed: ${error}`);
  }

  return (await response.json()) as UserInfo;
}

/**
 * Decode ID token (without verification - for display purposes)
 * For production, use jose's jwtVerify with proper key
 */
export function decodeIDToken(idToken: string): IDTokenPayload {
  return decodeJwt(idToken) as IDTokenPayload;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwt(token);
    if (!payload.exp) {
      return false;
    }
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Introspect a token (access token or refresh token)
 * RFC 7662 - OAuth 2.0 Token Introspection
 * Public Client: No client_secret required
 */
export async function introspectToken(
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token',
): Promise<IntrospectionResponse> {
  const config = getOIDCConfig();
  const params = new URLSearchParams({
    token,
    client_id: config.client_id,
    ...(tokenTypeHint && { token_type_hint: tokenTypeHint }),
  });

  const response = await fetch(config.introspection_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token introspection failed: ${error}`);
  }

  return (await response.json()) as IntrospectionResponse;
}

/**
 * Revoke a token (access token or refresh token)
 * RFC 7009 - OAuth 2.0 Token Revocation
 * Public Client: No client_secret required
 */
export async function revokeToken(
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token',
): Promise<void> {
  const config = getOIDCConfig();
  const params = new URLSearchParams({
    token,
    client_id: config.client_id,
    ...(tokenTypeHint && { token_type_hint: tokenTypeHint }),
  });

  const response = await fetch(config.revocation_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token revocation failed: ${error}`);
  }
}

/**
 * Fetch JWKS from the provider
 */
export async function fetchJWKS(): Promise<JWKS> {
  const config = getOIDCConfig();
  if (!config.jwks_uri) {
    throw new Error('JWKS URI not available');
  }

  const response = await fetch(config.jwks_uri);

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
  }

  return (await response.json()) as JWKS;
}
