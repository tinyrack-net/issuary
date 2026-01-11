import type { FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import {
  decodeJwt,
  importPKCS8,
  importSPKI,
  type JWTPayload,
  jwtVerify,
  SignJWT,
} from 'jose';
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
    const _decoded = decodeJwt(token);
    const headerPart = token.split('.')[0];
    if (!headerPart) {
      throw new Error('Invalid token format');
    }
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());
    const kid = header.kid as string | undefined;

    // If kid is present, find specific key
    if (kid) {
      const key = await this.jwtKeyService.getKeyByKid(kid);

      if (key?.isVerificationKey()) {
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
      } catch {}
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

  /**
   * Extract Bearer token from Authorization header
   *
   * @param req - Fastify request object
   * @returns Extracted Bearer token
   * @throws {MissingAuthorizationHeader} When Authorization header is missing
   * @throws {InvalidAuthorizationHeaderFormat} When header format is invalid
   * @throws {MissingBearerToken} When token is missing in header
   *
   * @example
   * ```typescript
   * const token = jwtService.extractBearerToken(req);
   * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * ```
   */
  extractBearerToken(req: FastifyRequest): string {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new e.MissingAuthorizationHeader.Error();
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new e.InvalidAuthorizationHeaderFormat.Error();
    }

    const token = parts[1];
    if (!token) {
      throw new e.MissingBearerToken.Error();
    }

    return token;
  }

  /**
   * Validate Bearer token and return decoded payload
   *
   * Extracts Bearer token from Authorization header and verifies it.
   * This is the main authentication handler for protected API endpoints.
   *
   * @param req - Fastify request object
   * @returns Decoded access token payload with user and client info
   * @throws {MissingAuthorizationHeader} When Authorization header is missing
   * @throws {InvalidAuthorizationHeaderFormat} When header format is invalid
   * @throws {MissingBearerToken} When token is missing in header
   * @throws {InvalidAccessToken} When token is invalid or expired
   *
   * @example
   * ```typescript
   * // In a route handler
   * const payload = await fastify.jwtService.validateBearerToken(req);
   * console.log(payload.sub);       // User ID
   * console.log(payload.client_id); // OAuth client ID
   * console.log(payload.scope);     // Granted scopes
   * ```
   */
  async validateBearerToken(req: FastifyRequest): Promise<AccessTokenPayload> {
    const token = this.extractBearerToken(req);

    // Use jwtService for RS256 token verification
    const payload = await this.verifyAccessToken(token);
    return payload;
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
