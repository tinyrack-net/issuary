import {
  type JWK,
  type JWTPayload,
  jwtVerify,
  type KeyObject,
  SignJWT,
  decodeJwt,
} from 'jose';
import { AppConfigs } from './config.js';

const JWT_SECRET = AppConfigs.app.jwt_secret || AppConfigs.app.cookie_secret;
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface AccessTokenPayload {
  sub: string; // user id
  client_id: string;
  scope: string;
  iat?: number | undefined;
  exp?: number | undefined;
  iss?: string | undefined;
  aud?: string | undefined;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  client_id: string;
  scope: string;
  iat?: number | undefined;
  exp?: number | undefined;
  iss?: string | undefined;
  aud?: string | undefined;
}

export interface IdTokenPayload {
  sub: string; // user id
  aud: string; // client_id
  iat?: number | undefined;
  exp?: number | undefined;
  iss?: string | undefined;
  nonce?: string | undefined;
  email?: string | undefined;
  email_verified?: boolean | undefined;
  name?: string | undefined;
  picture?: string | undefined;
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
 * Verify and decode an access token
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);

    return {
      sub: payload.sub as string,
      client_id: payload['client_id'] as string,
      scope: payload['scope'] as string,
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      aud: payload.aud as string | undefined,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);

    return {
      sub: payload.sub as string,
      client_id: payload['client_id'] as string,
      scope: payload['scope'] as string,
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      aud: payload.aud as string | undefined,
    };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Verify and decode an ID token
 */
export async function verifyIdToken(token: string): Promise<IdTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);

    return {
      sub: payload.sub as string,
      aud: payload.aud as string,
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      nonce: payload['nonce'] as string | undefined,
      email: payload['email'] as string | undefined,
      email_verified: payload['email_verified'] as boolean | undefined,
      name: payload['name'] as string | undefined,
      picture: payload['picture'] as string | undefined,
    };
  } catch (error) {
    throw new Error('Invalid or expired ID token');
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
