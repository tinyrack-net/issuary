import {
  type JwtKeyEntity,
  JwtKeyStatus,
} from '@backend/entities/jwt-key.entity.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import { e } from '@backend/schemas/error.js';
import type { MikroService } from '@backend/services/mikro.service.js';
import {
  decodeJwt,
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  type JWTPayload,
  jwtVerify,
  SignJWT,
} from 'jose';

// ---------------------------------------------------------------------------
// Key Management Types
// ---------------------------------------------------------------------------

/**
 * Key pair with PEM-encoded keys
 * Used for JWT signing key generation
 */
export interface KeyPair {
  /** Key ID for identifying the key in JWKS */
  kid: string;
  /** PEM-encoded private key (PKCS#8 format) */
  privateKey: string;
  /** PEM-encoded public key (SPKI format) */
  publicKey: string;
  /** Algorithm (e.g., "RS256") */
  algorithm: string;
}

/**
 * Public JWK for JWKS endpoint (RFC 7517)
 * All required fields are guaranteed to be present.
 * @see https://datatracker.ietf.org/doc/html/rfc7517
 */
export interface PublicJWK {
  /** Key Type (e.g., "RSA") */
  kty: string;
  /** Public Key Use ("sig" for signature) */
  use: string;
  /** Key ID */
  kid: string;
  /** Algorithm (e.g., "RS256") */
  alg: string;
  /** RSA modulus (base64url encoded) */
  n?: string | undefined;
  /** RSA exponent (base64url encoded) */
  e?: string | undefined;
  /** EC x coordinate (base64url encoded) */
  x?: string | undefined;
  /** EC y coordinate (base64url encoded) */
  y?: string | undefined;
  /** EC curve name */
  crv?: string | undefined;
}

// ---------------------------------------------------------------------------
// Token Payload Types
// ---------------------------------------------------------------------------

/**
 * Base JWT payload with standard claims (RFC 7519)
 * @see https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
 */
interface BaseJWTPayload {
  /** Subject - identifies the principal that is the subject of the JWT */
  sub: string;
  /** JWT ID - unique identifier for the JWT */
  jti?: string | undefined;
  /** Issued At - time at which the JWT was issued (seconds since epoch) */
  iat?: number | undefined;
  /** Expiration Time - time after which the JWT must not be accepted (seconds since epoch) */
  exp?: number | undefined;
  /** Issuer - identifies the principal that issued the JWT */
  iss?: string | undefined;
}

/**
 * Access token payload structure (RFC 6749)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-1.4
 */
export interface AccessTokenPayload extends BaseJWTPayload {
  /** Token type discriminator */
  typ: 'access_token';
  /** Client identifier */
  client_id: string;
  /** Space-separated list of scopes */
  scope: string;
  /** Audience - intended recipient of the token */
  aud?: string | undefined;
}

/**
 * Refresh token payload structure (RFC 6749)
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-1.5
 */
export interface RefreshTokenPayload extends BaseJWTPayload {
  /** Token type discriminator */
  typ: 'refresh_token';
  /** Client identifier */
  client_id: string;
  /** Space-separated list of scopes */
  scope: string;
  /** Audience - intended recipient of the token */
  aud?: string | undefined;
}

/**
 * ID token payload structure (OpenID Connect Core 1.0 §2)
 * @see https://openid.net/specs/openid-connect-core-1_0.html#IDToken
 */
export interface IdTokenPayload extends BaseJWTPayload {
  /** Audience - client_id of the Relying Party */
  aud: string;
  /** Nonce - value used to associate a Client session with an ID Token */
  nonce?: string | undefined;
  /**
   * Time when the End-User authentication occurred (OIDC Core 1.0 §2)
   * Unix timestamp in seconds
   */
  auth_time?: number | undefined;
  /**
   * Access Token hash value (OIDC Core 1.0 §3.1.3.6)
   * Left-most half of the hash of the access token using the hash algorithm
   * from the alg Header Parameter of the ID Token's JOSE Header
   */
  at_hash?: string | undefined;
  /** Email address */
  email?: string | undefined;
  /** Whether the email address has been verified */
  email_verified?: boolean | undefined;
  /** Full name */
  name?: string | undefined;
  /** Profile picture URL */
  picture?: string | undefined;
}

/**
 * JWT Service
 *
 * Handles JWT signing and verification using RS256 asymmetric keys.
 * Manages RSA key pairs for signing with automatic rotation support.
 * Supports token revocation via RevokedToken repository.
 *
 * Key Lifecycle:
 * 1. next: Generated, waiting to be activated
 * 2. active: Currently used for signing tokens
 * 3. previous: Recently rotated, still valid for verification
 * 4. retired: No longer valid for any operation
 */
export class JwtService {
  /** Cache for active signing key */
  private activeKeyCache: JwtKeyEntity | null = null;
  private activeKeyCacheTime: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute

  /** Deduplication lock for concurrent ensureActiveKey calls */
  private ensureActiveKeyPromise: Promise<JwtKeyEntity> | null = null;

  constructor(
    private readonly config: ResolvedAppConfig,
    private readonly mikro: MikroService,
  ) {}

  // ---------------------------------------------------------------------------
  // Key Generation & Management
  // ---------------------------------------------------------------------------

  /**
   * Generate a new RSA key pair
   *
   * @returns Generated key pair with PEM-encoded keys
   */
  async generateKeyPair(): Promise<KeyPair> {
    // Generate RSA key pair using jose
    const { privateKey, publicKey } = await generateKeyPair('RS256', {
      modulusLength: 2048,
      extractable: true,
    });

    // Export to PEM format using jose's export functions
    const privateKeyPem = await exportPKCS8(privateKey);
    const publicKeyPem = await exportSPKI(publicKey);

    // Generate unique kid
    const kid = this.generateKid();

    return {
      kid,
      privateKey: privateKeyPem,
      publicKey: publicKeyPem,
      algorithm: 'RS256',
    };
  }

  /**
   * Generate a unique Key ID
   *
   * Format: key-{timestamp}-{random}
   */
  private generateKid(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().slice(0, 8);
    return `key-${timestamp}-${random}`;
  }

  /**
   * Ensure at least one active key exists
   *
   * Called on server startup to guarantee signing capability.
   * Generates a new key if none exists.
   */
  async ensureActiveKey(): Promise<JwtKeyEntity> {
    const activeKey = await this.mikro.jwtKey.getActiveKey();

    if (activeKey) {
      return activeKey;
    }

    // No active key, check for a 'next' key to activate
    const nextKey = await this.mikro.jwtKey.getNextKey();

    if (nextKey) {
      return this.activateKey(nextKey);
    }

    // No keys at all, generate and activate a new one
    return this.createAndActivateKey();
  }

  /**
   * Create a new key and immediately activate it
   */
  async createAndActivateKey(): Promise<JwtKeyEntity> {
    const keyPair = await this.generateKeyPair();
    const rotationDays = this.config.app.jwt_key_rotation_days ?? 30;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + rotationDays);

    const entity = this.mikro.jwtKey.create({
      kid: keyPair.kid,
      private_key: keyPair.privateKey,
      public_key: keyPair.publicKey,
      algorithm: keyPair.algorithm,
      status: JwtKeyStatus.ACTIVE,
      activated_at: new Date(),
      expires_at: expiresAt,
    });

    await this.mikro.em.persist(entity).flush();

    // Clear cache
    this.activeKeyCache = null;

    return entity;
  }

  /**
   * Create a new key in 'next' status (pre-rotation)
   */
  async createNextKey(): Promise<JwtKeyEntity> {
    const keyPair = await this.generateKeyPair();
    const rotationDays = this.config.app.jwt_key_rotation_days ?? 30;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + rotationDays);

    const entity = this.mikro.jwtKey.create({
      kid: keyPair.kid,
      private_key: keyPair.privateKey,
      public_key: keyPair.publicKey,
      algorithm: keyPair.algorithm,
      status: JwtKeyStatus.NEXT,
      expires_at: expiresAt,
    });

    await this.mikro.em.persist(entity).flush();

    return entity;
  }

  /**
   * Activate a key (change status to 'active')
   */
  async activateKey(key: JwtKeyEntity): Promise<JwtKeyEntity> {
    key.status = JwtKeyStatus.ACTIVE;
    key.activated_at = new Date();

    await this.mikro.em.persist(key).flush();

    // Clear cache
    this.activeKeyCache = null;

    return key;
  }

  /**
   * Deactivate current active key and promote next key
   *
   * This is the main rotation operation:
   * 1. Current active -> previous
   * 2. Next -> active (or create new if no next)
   */
  async rotateKeys(): Promise<JwtKeyEntity> {
    const currentActive = await this.mikro.jwtKey.getActiveKey();

    // Deactivate current active key
    if (currentActive) {
      currentActive.status = JwtKeyStatus.PREVIOUS;
      currentActive.deactivated_at = new Date();
    }

    // Get or create next key
    let nextKey = await this.mikro.jwtKey.getNextKey();

    if (!nextKey) {
      nextKey = await this.createNextKey();
    }

    // Activate the next key
    nextKey.status = JwtKeyStatus.ACTIVE;
    nextKey.activated_at = new Date();

    await this.mikro.em.flush();

    // Clear cache
    this.activeKeyCache = null;

    return nextKey;
  }

  /**
   * Retire old keys past the overlap period
   *
   * @param overlapDays - Days to keep previous keys valid
   */
  async retireOldKeys(overlapDays?: number): Promise<number> {
    const days = overlapDays ?? this.config.app.jwt_key_overlap_days ?? 7;
    const keysToRetire = await this.mikro.jwtKey.getKeysToRetire(days);

    for (const key of keysToRetire) {
      key.status = JwtKeyStatus.RETIRED;
      key.retired_at = new Date();
    }

    if (keysToRetire.length > 0) {
      await this.mikro.em.flush();
    }

    return keysToRetire.length;
  }

  /**
   * Check and perform rotation if needed
   *
   * Called by `tinyauth cleanup` command.
   * Rotates if active key is past expiration date.
   */
  async checkAndRotate(): Promise<boolean> {
    const expiredKeys = await this.mikro.jwtKey.getExpiredActiveKeys();

    if (expiredKeys.length > 0) {
      await this.rotateKeys();
      await this.retireOldKeys();
      return true;
    }

    return false;
  }

  /**
   * Get the active signing key (with caching)
   *
   * @returns Active key with private_key loaded
   * @throws Error if no active key exists
   */
  async getActiveKey(): Promise<JwtKeyEntity> {
    const now = Date.now();

    // Check cache
    if (
      this.activeKeyCache &&
      now - this.activeKeyCacheTime < this.CACHE_TTL_MS
    ) {
      return this.activeKeyCache;
    }

    let key = await this.mikro.jwtKey.getActiveKey();

    if (!key) {
      // Lazy initialization: create or promote a key on demand.
      // Use promise-based deduplication to prevent concurrent
      // key generation within the same process.
      if (!this.ensureActiveKeyPromise) {
        this.ensureActiveKeyPromise = this.ensureActiveKey().finally(() => {
          this.ensureActiveKeyPromise = null;
        });
      }
      key = await this.ensureActiveKeyPromise;
    }

    // Update cache
    this.activeKeyCache = key;
    this.activeKeyCacheTime = now;

    return key;
  }

  /**
   * Get key by kid for verification
   *
   * @param kid - Key ID from JWT header
   * @returns Key entity or null
   */
  async getKeyByKid(kid: string): Promise<JwtKeyEntity | null> {
    return this.mikro.jwtKey.getByKid(kid);
  }

  /**
   * Get all keys valid for verification
   *
   * @returns Array of active and previous keys
   */
  async getVerificationKeys(): Promise<JwtKeyEntity[]> {
    return this.mikro.jwtKey.getVerificationKeys();
  }

  /**
   * Convert PEM public key to JWK format for JWKS endpoint
   *
   * @param key - JWT Key entity
   * @returns JWK object
   */
  async convertToJWK(key: JwtKeyEntity): Promise<PublicJWK> {
    // Import PEM to KeyLike
    const publicKey = await importSPKI(key.public_key, key.algorithm);

    // Export to JWK
    const jwk = await exportJWK(publicKey);

    // Return JWK with required fields for RS256
    return {
      kty: jwk.kty ?? 'RSA',
      use: 'sig',
      kid: key.kid,
      alg: key.algorithm,
      ...(jwk.n && { n: jwk.n }),
      ...(jwk.e && { e: jwk.e }),
    };
  }

  /**
   * Get JWKS (JSON Web Key Set) for public endpoint
   *
   * Returns all active and previous keys in JWK format.
   *
   * @returns JWKS object with keys array
   */
  async getJWKS(): Promise<{
    keys: PublicJWK[];
  }> {
    // Ensure at least one active key exists (lazy initialization)
    await this.getActiveKey();

    const keys = await this.mikro.jwtKey.getPublicKeys();

    const jwks = await Promise.all(keys.map((key) => this.convertToJWK(key)));

    return { keys: jwks };
  }

  /**
   * Import private key from PEM for signing
   *
   * @param pem - PEM-encoded private key
   * @param algorithm - Algorithm (RS256)
   * @returns KeyLike for jose signing
   */
  async importPrivateKey(pem: string, algorithm: string) {
    return importPKCS8(pem, algorithm);
  }

  /**
   * Import public key from PEM for verification
   *
   * @param pem - PEM-encoded public key
   * @param algorithm - Algorithm (RS256)
   * @returns KeyLike for jose verification
   */
  async importPublicKey(pem: string, algorithm: string) {
    return importSPKI(pem, algorithm);
  }

  /**
   * Clear the active key cache
   *
   * Used after bootstrap or key rotation to ensure fresh key lookup.
   */
  clearActiveKeyCache(): void {
    this.activeKeyCache = null;
  }

  // ---------------------------------------------------------------------------
  // Token Signing
  // ---------------------------------------------------------------------------

  /**
   * Sign an access token using RS256
   */
  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const ttl = this.config.app.jwt_access_token_ttl || 3600;
    const key = await this.getActiveKey();
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
  async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    const ttl = this.config.app.jwt_refresh_token_ttl || 2592000;
    const key = await this.getActiveKey();
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
  async signIdToken(payload: IdTokenPayload): Promise<string> {
    const ttl = this.config.app.jwt_access_token_ttl || 3600;
    const key = await this.getActiveKey();
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

  // ---------------------------------------------------------------------------
  // Token Verification
  // ---------------------------------------------------------------------------

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

      return payload as unknown as AccessTokenPayload;
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

      return payload as unknown as RefreshTokenPayload;
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

      return payload as unknown as IdTokenPayload;
    } catch {
      throw new e.InvalidIdToken.Error();
    }
  }

  /**
   * Internal: Verify token with appropriate key based on kid
   */
  private async verifyToken(token: string): Promise<JWTPayload> {
    // Decode header to get kid
    const headerPart = token.split('.')[0];
    if (!headerPart) {
      throw new Error('Invalid token format');
    }
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());
    const kid = header.kid as string | undefined;

    // If kid is present, find specific key
    if (kid) {
      const key = await this.getKeyByKid(kid);

      if (key?.isVerificationKey()) {
        const publicKey = await importSPKI(key.public_key, key.algorithm);
        const { payload } = await jwtVerify(token, publicKey);
        return payload;
      }
    }

    // Fallback: try all verification keys
    const keys = await this.getVerificationKeys();

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

  // ---------------------------------------------------------------------------
  // Bearer Token Extraction
  // ---------------------------------------------------------------------------

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
  extractBearerToken(req: { headers: { authorization?: string } }): string {
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
  async validateBearerToken(req: {
    headers: { authorization?: string };
  }): Promise<AccessTokenPayload> {
    const token = this.extractBearerToken(req);

    // Use jwtService for RS256 token verification
    const payload = await this.verifyAccessToken(token);
    return payload;
  }
}
