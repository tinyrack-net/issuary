import z from 'zod/v4';

/**
 * OAuth authorization request parameters (RFC 6749 §4.1.1)
 * Also includes OpenID Connect parameters (OIDC Core 1.0 §3.1.2.1)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1
 * @see https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
 */
const AuthorizeParams = z.object({
  /** OAuth response type (e.g., "code" for authorization code flow) */
  response_type: z.string(),
  /** Redirect URI where the authorization response will be sent */
  redirect_uri: z.string(),
  /** Opaque value used to maintain state between request and callback (CSRF protection) */
  state: z.string().optional(),
  /** OAuth client identifier */
  client_id: z.string(),
  /** PKCE code challenge derived from code verifier (RFC 7636) */
  code_challenge: z.string().optional(),
  /** PKCE code challenge method (S256 or plain) */
  code_challenge_method: z.enum(['S256', 'plain']).optional(),
  /** Space-separated list of requested scopes */
  scope: z.string().optional(),
  /** OIDC nonce for replay attack prevention */
  nonce: z.string().optional(),
  /** OIDC prompt parameter to control authentication/consent UI */
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),
  /** OIDC max authentication age in seconds */
  max_age: z.number().int().optional(),
  /** OIDC display mode for authentication UI */
  display: z.enum(['page', 'popup', 'touch', 'wap']).optional(),
});

/**
 * OAuth authorization result
 * Currently only supports redirect type
 */
const AuthorizeResult = z.object({
  /** Result type discriminator */
  type: z.literal('redirect'),
  /** URL to redirect the user agent to */
  url: z.string().url(),
});

/**
 * Parameters for authorization code grant (RFC 6749 §4.1.3)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
 */
const AuthorizationCodeGrantParams = z.object({
  /** Authorization code received from /authorize endpoint */
  code: z.string(),
  /** Redirect URI used in authorization request (must match) */
  redirectUri: z.string(),
  /** OAuth client identifier */
  clientId: z.string(),
  /** PKCE code verifier (required if code_challenge was used) */
  codeVerifier: z.string().optional(),
});

/**
 * Parameters for refresh token grant (RFC 6749 §6)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-6
 */
const RefreshTokenGrantParams = z.object({
  /** Refresh token from previous token response */
  refreshToken: z.string(),
  /** OAuth client identifier (must match original request) */
  clientId: z.string(),
});

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
 * Usage: import { oauthSchema } from '@/schemas/oauth.js'
 * Type inference: type AuthParams = z.infer<typeof oauthSchema.AuthorizeParams>
 */
export const oauthSchema = {
  AuthorizeParams,
  AuthorizeResult,
  AuthorizationCodeGrantParams,
  RefreshTokenGrantParams,
  TokenIntrospectionResult,
  TokenResponse,
};
