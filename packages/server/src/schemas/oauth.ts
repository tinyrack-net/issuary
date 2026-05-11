import { z } from 'zod';

/**
 * Token introspection result (RFC 7662 §2.2)
 * @see https://datatracker.ietf.org/doc/html/rfc7662#section-2.2
 */
const TokenIntrospectionResult = z.object({
  /** Whether the token is currently active */
  active: z.boolean().describe('Whether the token is currently active'),
  /** Space-separated list of scopes (only if active) */
  scope: z.string().optional().describe('Space-separated list of scopes'),
  /** Client identifier (only if active) */
  client_id: z.string().optional().describe('OAuth client identifier'),
  /** Type of token (only if active) */
  token_type: z.literal('Bearer').optional().describe('OAuth token type'),
  /** Expiration timestamp in seconds (only if active) */
  exp: z.number().int().optional().describe('Expiration timestamp (seconds)'),
  /** Issued-at timestamp in seconds (only if active) */
  iat: z.number().int().optional().describe('Issued-at timestamp (seconds)'),
  /** Subject identifier - user ID (only if active) */
  sub: z.string().optional().describe('Subject identifier'),
  /** Issuer identifier (only if active) */
  iss: z.string().url().optional().describe('Token issuer URL'),
});

/**
 * OAuth 2.0 / OIDC token response (RFC 6749 §5.1)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
 * @see https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
 */
const TokenResponse = z.object({
  /** OAuth 2.0 access token (JWT format) */
  access_token: z.string().describe('OAuth 2.0 access token (JWT)'),
  /** Token type identifier */
  token_type: z.literal('Bearer').describe('OAuth token type'),
  /** Access token lifetime in seconds */
  expires_in: z.number().int().describe('Access token lifetime in seconds'),
  /** Refresh token for obtaining new access tokens */
  refresh_token: z.string().describe('Refresh token'),
  /** OpenID Connect ID Token (JWT format, only if openid scope requested) */
  id_token: z.string().optional().describe('OpenID Connect ID token (JWT)'),
  /** Space-separated list of granted scopes */
  scope: z.string().describe('Space-separated granted scopes'),
});

/**
 * OAuth-related schemas namespace
 * Contains only schemas used for runtime validation (route schemas, etc.)
 */
export const oauthSchema = {
  TokenIntrospectionResult,
  TokenResponse,
};
