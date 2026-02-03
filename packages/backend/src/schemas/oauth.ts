import z from 'zod/v4';

/**
 * Token introspection result (RFC 7662 §2.2)
 * @see https://datatracker.ietf.org/doc/html/rfc7662#section-2.2
 */
const TokenIntrospectionResult = z.object({
  /** Whether the token is currently active */
  active: z.boolean(),
  /** Space-separated list of scopes (only if active) */
  scope: z.string().optional(),
  /** Client identifier (only if active) */
  client_id: z.string().optional(),
  /** Type of token (only if active) */
  token_type: z.literal('Bearer').optional(),
  /** Expiration timestamp in seconds (only if active) */
  exp: z.number().int().optional(),
  /** Issued-at timestamp in seconds (only if active) */
  iat: z.number().int().optional(),
  /** Subject identifier - user ID (only if active) */
  sub: z.string().optional(),
  /** Issuer identifier (only if active) */
  iss: z.string().optional(),
});

/**
 * OAuth 2.0 / OIDC token response (RFC 6749 §5.1)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
 * @see https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
 */
const TokenResponse = z.object({
  /** OAuth 2.0 access token (JWT format) */
  access_token: z.string(),
  /** Token type identifier */
  token_type: z.literal('Bearer'),
  /** Access token lifetime in seconds */
  expires_in: z.number().int(),
  /** Refresh token for obtaining new access tokens */
  refresh_token: z.string(),
  /** OpenID Connect ID Token (JWT format, only if openid scope requested) */
  id_token: z.string().optional(),
  /** Space-separated list of granted scopes */
  scope: z.string(),
});

/**
 * OAuth-related schemas namespace
 * Contains only schemas used for runtime validation (route schemas, etc.)
 */
export const oauthSchema = {
  TokenIntrospectionResult,
  TokenResponse,
};
