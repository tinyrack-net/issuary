import z from 'zod/v4';

/**
 * Base JWT payload with standard claims (RFC 7519)
 * @see https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
 */
export const BaseJWTPayload = z.object({
  /** Subject - identifies the principal that is the subject of the JWT */
  sub: z.string(),
  /** JWT ID - unique identifier for the JWT */
  jti: z.string().optional(),
  /** Issued At - time at which the JWT was issued (seconds since epoch) */
  iat: z.number().int().optional(),
  /** Expiration Time - time after which the JWT must not be accepted (seconds since epoch) */
  exp: z.number().int().optional(),
  /** Issuer - identifies the principal that issued the JWT */
  iss: z.string().optional(),
});

/**
 * Access token payload structure (RFC 6749)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-1.4
 */
export const AccessTokenPayload = BaseJWTPayload.extend({
  /** Token type discriminator */
  typ: z.literal('access_token'),
  /** Client identifier */
  client_id: z.string(),
  /** Space-separated list of scopes */
  scope: z.string(),
  /** Audience - intended recipient of the token */
  aud: z.string().optional(),
});

/**
 * Refresh token payload structure (RFC 6749)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-1.5
 */
export const RefreshTokenPayload = BaseJWTPayload.extend({
  /** Token type discriminator */
  typ: z.literal('refresh_token'),
  /** Client identifier */
  client_id: z.string(),
  /** Space-separated list of scopes */
  scope: z.string(),
  /** Audience - intended recipient of the token */
  aud: z.string().optional(),
});

/**
 * ID token payload structure (OpenID Connect Core 1.0 §2)
 * @see https://openid.net/specs/openid-connect-core-1_0.html#IDToken
 */
export const IdTokenPayload = BaseJWTPayload.extend({
  /** Audience - client_id of the Relying Party */
  aud: z.string(),
  /** Nonce - value used to associate a Client session with an ID Token */
  nonce: z.string().optional(),
  /**
   * Time when the End-User authentication occurred (OIDC Core 1.0 §2)
   * Unix timestamp in seconds
   */
  auth_time: z.number().int().optional(),
  /**
   * Access Token hash value (OIDC Core 1.0 §3.1.3.6)
   * Left-most half of the hash of the access token using the hash algorithm
   * from the alg Header Parameter of the ID Token's JOSE Header
   */
  at_hash: z.string().optional(),
  /** Email address */
  email: z.string().email().optional(),
  /** Whether the email address has been verified */
  email_verified: z.boolean().optional(),
  /** Full name */
  name: z.string().optional(),
  /** Profile picture URL */
  picture: z.string().optional(),
});

/**
 * JWT-related schemas namespace
 * Usage: import { jwtPayload } from '@/schemas/jwt.js'
 * Type inference: type AccessToken = z.infer<typeof jwtPayload.AccessToken>
 */
export const jwtPayload = {
  BaseJWTPayload,
  AccessTokenPayload,
  RefreshTokenPayload,
  IdTokenPayload,
};
