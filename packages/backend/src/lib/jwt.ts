import { e } from '@/schemas/error.js';
import {
  type JWK,
  type JWTPayload,
  type KeyObject,
  SignJWT,
  decodeJwt,
  jwtVerify,
} from 'jose';
import { AppConfigs } from './config.js';

const JWT_SECRET = AppConfigs.app.jwt_secret || AppConfigs.app.cookie_secret;
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

/**
 * Base JWT payload with standard claims
 */
interface BaseJWTPayload extends JWTPayload {
  sub: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

/**
 * Access token payload structure (RFC 6749)
 */
export interface AccessTokenPayload extends BaseJWTPayload {
  typ: 'access_token';
  client_id: string;
  scope: string;
  aud?: string;
}

/**
 * Refresh token payload structure (RFC 6749)
 */
export interface RefreshTokenPayload extends BaseJWTPayload {
  typ: 'refresh_token';
  client_id: string;
  scope: string;
  aud?: string;
}

/**
 * ID token payload structure (OpenID Connect Core 1.0 §2)
 */
export interface IdTokenPayload extends BaseJWTPayload {
  aud: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Sign an access token using JWT
 */
export async function signAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  const ttl = AppConfigs.app.jwt_access_token_ttl || 3600;

  const jwt = await new SignJWT({
    typ: 'access_token',
    sub: payload.sub,
    client_id: payload.client_id,
    scope: payload.scope,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setIssuer(AppConfigs.app.host)
    .sign(SECRET_KEY);

  return jwt;
}

/**
 * Sign a refresh token using JWT
 */
export async function signRefreshToken(
  payload: RefreshTokenPayload,
): Promise<string> {
  const ttl = AppConfigs.app.jwt_refresh_token_ttl || 2592000;

  const jwt = await new SignJWT({
    typ: 'refresh_token',
    sub: payload.sub,
    client_id: payload.client_id,
    scope: payload.scope,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setIssuer(AppConfigs.app.host)
    .sign(SECRET_KEY);

  return jwt;
}

/**
 * Sign an ID token using JWT (for OIDC)
 */
export async function signIdToken(payload: IdTokenPayload): Promise<string> {
  const ttl = AppConfigs.app.jwt_access_token_ttl || 3600;

  const jwt = await new SignJWT({
    sub: payload.sub,
    aud: payload.aud,
    ...(payload.nonce && { nonce: payload.nonce }),
    ...(payload.email && { email: payload.email }),
    ...(payload.email_verified !== undefined && {
      email_verified: payload.email_verified,
    }),
    ...(payload.name && { name: payload.name }),
    ...(payload.picture && { picture: payload.picture }),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setIssuer(AppConfigs.app.host)
    .sign(SECRET_KEY);

  return jwt;
}

/**
 * Type guard to validate access token payload structure
 */
function isAccessTokenPayload(
  payload: JWTPayload,
): payload is AccessTokenPayload {
  return (
    payload['typ'] === 'access_token' &&
    typeof payload.sub === 'string' &&
    typeof payload['client_id'] === 'string' &&
    typeof payload['scope'] === 'string'
  );
}

/**
 * Verify and decode an access token
 *
 * @throws {InvalidAccessToken} When token is invalid or expired
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (!isAccessTokenPayload(payload)) {
      throw new Error('Invalid access token payload structure');
    }
    return payload as AccessTokenPayload;
  } catch {
    throw new e.InvalidAccessToken.Error();
  }
}

/**
 * Type guard to validate refresh token payload structure
 */
function isRefreshTokenPayload(
  payload: JWTPayload,
): payload is RefreshTokenPayload {
  return (
    payload['typ'] === 'refresh_token' &&
    typeof payload.sub === 'string' &&
    typeof payload['client_id'] === 'string' &&
    typeof payload['scope'] === 'string'
  );
}

/**
 * Verify and decode a refresh token
 *
 * @throws {InvalidRefreshToken} When token is invalid or expired
 */
export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (!isRefreshTokenPayload(payload)) {
      throw new Error('Invalid refresh token payload structure');
    }
    return payload as RefreshTokenPayload;
  } catch {
    throw new e.InvalidRefreshToken.Error();
  }
}

/**
 * Type guard to validate ID token payload structure
 */
function isIdTokenPayload(payload: JWTPayload): payload is IdTokenPayload {
  return typeof payload.sub === 'string' && typeof payload.aud === 'string';
}

/**
 * Verify and decode an ID token
 *
 * @throws {InvalidIdToken} When token is invalid or expired
 */
export async function verifyIdToken(token: string): Promise<IdTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (!isIdTokenPayload(payload)) {
      throw new Error('Invalid ID token payload structure');
    }
    return payload as IdTokenPayload;
  } catch {
    throw new e.InvalidIdToken.Error();
  }
}

/**
 * Decode a JWT without verification (for introspection)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return decodeJwt(token);
  } catch {
    return null;
  }
}
