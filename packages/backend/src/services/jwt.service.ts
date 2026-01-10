import {
  type JWTPayload,
  SignJWT,
  decodeJwt,
  importPKCS8,
  importSPKI,
  jwtVerify,
} from 'jose';
import fastifyPlugin from 'fastify-plugin';
import { AppConfigs } from '@/lib/config.js';
import type { MikroService } from '@/plugins/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { JwtKeyService } from './jwt-key.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    jwtService: JwtService;
  }
}

/**
 * Base JWT payload with standard claims
 */
interface BaseJWTPayload extends JWTPayload {
  sub: string;
  jti?: string;
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
 * JWT Service
 *
 * Handles JWT signing and verification using RS256 asymmetric keys.
 * Keys are managed by JwtKeyService with automatic rotation support.
 * Supports token revocation via RevokedToken repository.
 */
export class JwtService {
  constructor(
    private readonly jwtKeyService: JwtKeyService,
    private readonly mikro: MikroService,
  ) {}

  /**
   * Sign an access token using RS256
   */
  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const ttl = AppConfigs.app.jwt_access_token_ttl || 3600;
    const key = await this.jwtKeyService.getActiveKey();
    const privateKey = await importPKCS8(key.private_key, key.algorithm);
    const jti = crypto.randomUUID();

    const jwt = await new SignJWT({
      typ: 'access_token',
      sub: payload.sub,
      client_id: payload.client_id,
      scope: payload.scope,
    })
      .setProtectedHeader({ alg: key.algorithm, typ: 'JWT', kid: key.kid })
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .setIssuer(AppConfigs.app.host)
      .sign(privateKey);

    return jwt;
  }

  /**
   * Sign a refresh token using RS256
   */
  async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    const ttl = AppConfigs.app.jwt_refresh_token_ttl || 2592000;
    const key = await this.jwtKeyService.getActiveKey();
    const privateKey = await importPKCS8(key.private_key, key.algorithm);
    const jti = crypto.randomUUID();

    const jwt = await new SignJWT({
      typ: 'refresh_token',
      sub: payload.sub,
      client_id: payload.client_id,
      scope: payload.scope,
    })
      .setProtectedHeader({ alg: key.algorithm, typ: 'JWT', kid: key.kid })
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .setIssuer(AppConfigs.app.host)
      .sign(privateKey);

    return jwt;
  }

  /**
   * Sign an ID token using RS256 (for OIDC)
   */
  async signIdToken(payload: IdTokenPayload): Promise<string> {
    const ttl = AppConfigs.app.jwt_access_token_ttl || 3600;
    const key = await this.jwtKeyService.getActiveKey();
    const privateKey = await importPKCS8(key.private_key, key.algorithm);

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
      .setProtectedHeader({ alg: key.algorithm, typ: 'JWT', kid: key.kid })
      .setIssuedAt()
      .setExpirationTime(`${ttl}s`)
      .setIssuer(AppConfigs.app.host)
      .sign(privateKey);

    return jwt;
  }

  /**
   * Verify and decode an access token
   *
   * @throws {InvalidAccessToken} When token is invalid, expired, or revoked
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.verifyToken(token);

      if (!this.isAccessTokenPayload(payload)) {
        throw new Error('Invalid access token payload structure');
      }

      // Check if token is revoked
      if (payload.jti) {
        const isRevoked = await this.mikro.revokedToken.isRevoked(payload.jti);
        if (isRevoked) {
          throw new Error('Token has been revoked');
        }
      }

      return payload as AccessTokenPayload;
    } catch {
      throw new e.InvalidAccessToken.Error();
    }
  }

  /**
   * Verify and decode a refresh token
   *
   * @throws {InvalidRefreshToken} When token is invalid, expired, or revoked
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.verifyToken(token);

      if (!this.isRefreshTokenPayload(payload)) {
        throw new Error('Invalid refresh token payload structure');
      }

      // Check if token is revoked
      if (payload.jti) {
        const isRevoked = await this.mikro.revokedToken.isRevoked(payload.jti);
        if (isRevoked) {
          throw new Error('Token has been revoked');
        }
      }

      return payload as RefreshTokenPayload;
    } catch {
      throw new e.InvalidRefreshToken.Error();
    }
  }

  /**
   * Verify and decode an ID token
   *
   * @throws {InvalidIdToken} When token is invalid or expired
   */
  async verifyIdToken(token: string): Promise<IdTokenPayload> {
    try {
      const payload = await this.verifyToken(token);

      if (!this.isIdTokenPayload(payload)) {
        throw new Error('Invalid ID token payload structure');
      }

      return payload as IdTokenPayload;
    } catch {
      throw new e.InvalidIdToken.Error();
    }
  }

  /**
   * Internal: Verify token with appropriate key based on kid
   */
  private async verifyToken(token: string): Promise<JWTPayload> {
    // Decode header to get kid
    const decoded = decodeJwt(token);
    const header = JSON.parse(
      Buffer.from(token.split('.')[0]!, 'base64url').toString(),
    );
    const kid = header.kid as string | undefined;

    // If kid is present, find specific key
    if (kid) {
      const key = await this.jwtKeyService.getKeyByKid(kid);

      if (key && key.isVerificationKey()) {
        const publicKey = await importSPKI(key.public_key, key.algorithm);
        const { payload } = await jwtVerify(token, publicKey);
        return payload;
      }
    }

    // Fallback: try all verification keys
    const keys = await this.jwtKeyService.getVerificationKeys();

    for (const key of keys) {
      try {
        const publicKey = await importSPKI(key.public_key, key.algorithm);
        const { payload } = await jwtVerify(token, publicKey);
        return payload;
      } catch {
        // Try next key
        continue;
      }
    }

    throw new Error('Token verification failed with all available keys');
  }

  /**
   * Type guard to validate access token payload structure
   */
  private isAccessTokenPayload(
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
   * Type guard to validate refresh token payload structure
   */
  private isRefreshTokenPayload(
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
   * Type guard to validate ID token payload structure
   */
  private isIdTokenPayload(payload: JWTPayload): payload is IdTokenPayload {
    return typeof payload.sub === 'string' && typeof payload.aud === 'string';
  }

  /**
   * Decode a JWT without verification (for introspection)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return decodeJwt(token);
    } catch {
      return null;
    }
  }
}

export default fastifyPlugin(
  async (fastify) => {
    fastify.decorate(
      'jwtService',
      new JwtService(fastify.jwtKeyService, fastify.mikro),
    );
  },
  {
    name: 'jwt-service-plugin',
    dependencies: ['jwt-key-service-plugin', 'mikro-orm-plugin'],
  },
);
