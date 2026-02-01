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
import type z from 'zod/v4';
import { RevokedTokenEntity } from '@/entities/revoked-token.entity.js';
import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@/lib/config/duration.js';
import type { ResolvedAppConfig } from '@/lib/config/index.js';
import type { MikroService } from '@/plugins/core/mikro-orm.js';
import { e } from '@/schemas/error.js';
import type { jwtPayload } from '@/schemas/jwt.js';
import type { JwtKeyService } from './jwt-key.service.js';
import type { CleanupOptions, CleanupResult } from './types.js';

declare module 'fastify' {
  interface FastifyInstance {
    jwtService: JwtService;
  }
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
    private readonly config: ResolvedAppConfig,
    private readonly jwtKeyService: JwtKeyService,
    private readonly mikro: MikroService,
  ) {}

  /**
   * Sign an access token using RS256
   */
  async signAccessToken(
    payload: z.infer<typeof jwtPayload.AccessTokenPayload>,
  ): Promise<string> {
    const ttl = this.config.app.jwt_access_token_ttl || 3600;
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
      .setIssuer(this.config.app.host)
      .sign(privateKey);

    return jwt;
  }

  /**
   * Sign a refresh token using RS256
   */
  async signRefreshToken(
    payload: z.infer<typeof jwtPayload.RefreshTokenPayload>,
  ): Promise<string> {
    const ttl = this.config.app.jwt_refresh_token_ttl || 2592000;
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
      .setIssuer(this.config.app.host)
      .sign(privateKey);

    return jwt;
  }

  /**
   * Sign an ID token using RS256 (for OIDC)
   *
   * Includes standard OIDC claims:
   * - auth_time: Time when End-User authentication occurred
   * - at_hash: Access Token hash (when provided)
   */
  async signIdToken(
    payload: z.infer<typeof jwtPayload.IdTokenPayload>,
  ): Promise<string> {
    const ttl = this.config.app.jwt_access_token_ttl || 3600;
    const key = await this.jwtKeyService.getActiveKey();
    const privateKey = await importPKCS8(key.private_key, key.algorithm);

    const jwt = await new SignJWT({
      sub: payload.sub,
      aud: payload.aud,
      ...(payload.nonce && { nonce: payload.nonce }),
      ...(payload.auth_time !== undefined && { auth_time: payload.auth_time }),
      ...(payload.at_hash && { at_hash: payload.at_hash }),
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
      .setIssuer(this.config.app.host)
      .sign(privateKey);

    return jwt;
  }

  /**
   * Verify and decode an access token
   *
   * @throws {InvalidAccessToken} When token is invalid, expired, or revoked
   */
  async verifyAccessToken(
    token: string,
  ): Promise<z.infer<typeof jwtPayload.AccessTokenPayload>> {
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

      return payload as z.infer<typeof jwtPayload.AccessTokenPayload>;
    } catch {
      throw new e.InvalidAccessToken.Error();
    }
  }

  /**
   * Verify and decode a refresh token
   *
   * @throws {InvalidRefreshToken} When token is invalid, expired, or revoked
   */
  async verifyRefreshToken(
    token: string,
  ): Promise<z.infer<typeof jwtPayload.RefreshTokenPayload>> {
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

      return payload as z.infer<typeof jwtPayload.RefreshTokenPayload>;
    } catch {
      throw new e.InvalidRefreshToken.Error();
    }
  }

  /**
   * Verify and decode an ID token
   *
   * @throws {InvalidIdToken} When token is invalid or expired
   */
  async verifyIdToken(
    token: string,
  ): Promise<z.infer<typeof jwtPayload.IdTokenPayload>> {
    try {
      const payload = await this.verifyToken(token);

      if (!this.isIdTokenPayload(payload)) {
        throw new Error('Invalid ID token payload structure');
      }

      return payload as z.infer<typeof jwtPayload.IdTokenPayload>;
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
  private isAccessTokenPayload(payload: JWTPayload): boolean {
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
  private isRefreshTokenPayload(payload: JWTPayload): boolean {
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
  private isIdTokenPayload(payload: JWTPayload): boolean {
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
   * Remove expired revoked tokens from the database.
   *
   * Revoked tokens can be safely deleted after their original expiration time
   * since they would be invalid anyway due to JWT expiration.
   * The retention period allows keeping expired tokens for a while longer
   * for debugging purposes. Default is "0" (immediate cleanup after expiry).
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  async cleanupRevokedTokens(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.revoked_tokens;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const em = this.mikro.orm.em.fork();
    const revokedTokenRepo = em.getRepository(RevokedTokenEntity);

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Find tokens that expired before the cutoff date
    const expiredTokens = await revokedTokenRepo.find({
      expires_at: { $lt: cutoffDate },
    });

    const count = expiredTokens.length;

    if (count === 0) {
      return { deletedCount: 0, skipped: false, message: 'No expired tokens' };
    }

    if (options.dryRun) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Would delete ${count} tokens (retention: ${formatDuration(retentionMs)})`,
      };
    }

    // Delete the tokens
    for (const token of expiredTokens) {
      em.remove(token);
    }
    await em.flush();

    if (retentionMs > 0) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Retention: ${formatDuration(retentionMs)}`,
      };
    }

    return {
      deletedCount: count,
      skipped: false,
    };
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
  async validateBearerToken(
    req: FastifyRequest,
  ): Promise<z.infer<typeof jwtPayload.AccessTokenPayload>> {
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
      new JwtService(fastify.config, fastify.jwtKeyService, fastify.mikro),
    );
  },
  {
    name: 'jwt-service-plugin',
    dependencies: ['jwt-key-service-plugin', 'mikro-orm-plugin'],
  },
);
