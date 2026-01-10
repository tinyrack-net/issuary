import { decodeJwt } from 'jose';
import { oidcConfig } from './oidc-config';
import type { TokenResponse, IDTokenPayload, UserInfo } from '@/types/oidc';

/**
 * Build authorization URL for OAuth/OIDC flow
 */
export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  nonce: string,
): string {
  const params = new URLSearchParams({
    client_id: oidcConfig.client_id,
    redirect_uri: oidcConfig.redirect_uri,
    response_type: oidcConfig.response_type,
    scope: oidcConfig.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    nonce,
  });

  return `${oidcConfig.authorization_endpoint}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: oidcConfig.redirect_uri,
    client_id: oidcConfig.client_id,
    client_secret: oidcConfig.client_secret,
    code_verifier: codeVerifier,
  });

  const response = await fetch(oidcConfig.token_endpoint, {
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
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: oidcConfig.client_id,
    client_secret: oidcConfig.client_secret,
  });

  const response = await fetch(oidcConfig.token_endpoint, {
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
  const response = await fetch(oidcConfig.userinfo_endpoint, {
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
