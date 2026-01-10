import {
  decodeJwt,
  type JWK,
  type JWTPayload,
  jwtVerify,
  type KeyObject,
  SignJWT,
} from 'jose';
import { e } from '@/schemas/error.js';
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
  client_id: string;
  scope: string;
  aud?: string;
}

/**
 * Refresh token payload structure (RFC 6749)
 */
export interface RefreshTokenPayload extends BaseJWTPayload {
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

export function createJWT(
  payload: JWTPayload,
  algorithm: string,
  privateKey: CryptoKey | KeyObject | JWK | Uint8Array<ArrayBufferLike>,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm, typ: 'JWT', kid: 'tinyrack' })
    .sign(privateKey);
}

export function verifyJWT<T>(
  token: string,
  publicKey: CryptoKey | KeyObject | JWK | Uint8Array<ArrayBufferLike>,
) {
  return jwtVerify<T>(token, publicKey);
}

/**
 * Sign an access token using JWT
 */
export async function signAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  const ttl = AppConfigs.app.jwt_access_token_ttl || 3600;

  const jwt = await new SignJWT({
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

  const claims: Record<string, unknown> = {
    sub: payload.sub,
    aud: payload.aud,
  };

  if (payload.nonce) {
    claims['nonce'] = payload.nonce;
  }
  if (payload.email) {
    claims['email'] = payload.email;
  }
  if (payload.email_verified !== undefined) {
    claims['email_verified'] = payload.email_verified;
  }
  if (payload.name) {
    claims['name'] = payload.name;
  }
  if (payload.picture) {
    claims['picture'] = payload.picture;
  }

  const jwt = await new SignJWT(claims)
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

    const result: AccessTokenPayload = {
      sub: payload.sub,
      client_id: payload['client_id'],
      scope: payload['scope'],
    };

    if (payload.iat !== undefined) result.iat = payload.iat;
    if (payload.exp !== undefined) result.exp = payload.exp;
    if (payload.iss !== undefined) result.iss = payload.iss;
    if (typeof payload.aud === 'string') result.aud = payload.aud;

    return result;
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

    const result: RefreshTokenPayload = {
      sub: payload.sub,
      client_id: payload['client_id'],
      scope: payload['scope'],
    };

    if (payload.iat !== undefined) result.iat = payload.iat;
    if (payload.exp !== undefined) result.exp = payload.exp;
    if (payload.iss !== undefined) result.iss = payload.iss;
    if (typeof payload.aud === 'string') result.aud = payload.aud;

    return result;
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

    const result: IdTokenPayload = {
      sub: payload.sub,
      aud: payload.aud,
    };

    if (payload.iat !== undefined) result.iat = payload.iat;
    if (payload.exp !== undefined) result.exp = payload.exp;
    if (payload.iss !== undefined) result.iss = payload.iss;
    if (typeof payload['nonce'] === 'string') result.nonce = payload['nonce'];
    if (typeof payload['email'] === 'string') result.email = payload['email'];
    if (typeof payload['email_verified'] === 'boolean')
      result.email_verified = payload['email_verified'];
    if (typeof payload['name'] === 'string') result.name = payload['name'];
    if (typeof payload['picture'] === 'string')
      result.picture = payload['picture'];

    return result;
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
