import { decodeJwt } from 'jose';
import type {
  IDTokenPayload,
  IntrospectionResponse,
  TokenResponse,
} from '@/types/oidc';
import { getOIDCConfig } from './oidc-config';
import {
  assertIDTokenPayload,
  assertIntrospectionResponse,
  assertTokenResponse,
} from './validators';

/**
 * Build authorization URL for OAuth/OIDC flow
 */
export async function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  nonce: string,
): Promise<string> {
  const config = await getOIDCConfig();
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
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const config = await getOIDCConfig();
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirect_uri,
    client_id: config.client_id,
    client_secret: config.client_secret,
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

  const json: unknown = await response.json();
  assertTokenResponse(json);
  return json;
}

/**
 * Decode ID token (without verification - for display purposes)
 * For production, use jose's jwtVerify with proper key
 */
export function decodeIDToken(idToken: string): IDTokenPayload {
  const payload: unknown = decodeJwt(idToken);
  assertIDTokenPayload(payload);
  return payload;
}

/**
 * Introspect a token (access token or refresh token)
 * RFC 7662 - OAuth 2.0 Token Introspection
 */
export async function introspectToken(
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token',
): Promise<IntrospectionResponse> {
  const config = await getOIDCConfig();
  const params = new URLSearchParams({
    token,
    client_id: config.client_id,
    client_secret: config.client_secret,
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

  const json: unknown = await response.json();
  assertIntrospectionResponse(json);
  return json;
}

/**
 * Revoke a token (access token or refresh token)
 * RFC 7009 - OAuth 2.0 Token Revocation
 *
 * Per RFC 7009 §2.1:
 * - Returns 200 OK whether the token was successfully revoked or was invalid
 * - Client authentication is recommended for confidential clients
 */
export async function revokeToken(
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token',
): Promise<void> {
  const config = await getOIDCConfig();
  const params = new URLSearchParams({
    token,
    client_id: config.client_id,
    client_secret: config.client_secret,
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

  // RFC 7009: Returns 200 OK with empty body on success
}
