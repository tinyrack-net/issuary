import fastifyPlugin from 'fastify-plugin';
import {
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
} from 'jose';
import { JwtKeyEntity, JwtKeyStatus } from '@/entities/jwt-key.entity.js';
import { AppConfigs } from '@/lib/config.js';
import type { MikroService } from '@/plugins/mikro-orm.js';

declare module 'fastify' {
  interface FastifyInstance {
    jwtKeyService: JwtKeyService;
  }
}

/**
 * Key pair with PEM-encoded keys
 */
interface KeyPair {
  kid: string;
  privateKey: string;
  publicKey: string;
  algorithm: string;
}

/**
 * Public JWK for JWKS endpoint (RFC 7517)
 *
 * All required fields are guaranteed to be present.
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
  n?: string;
  /** RSA exponent (base64url encoded) */
  e?: string;
  /** EC x coordinate (base64url encoded) */
  x?: string;
  /** EC y coordinate (base64url encoded) */
  y?: string;
  /** EC curve name */
  crv?: string;
}

/**
 * JWT Key Service
 *
 * Manages RSA key pairs for JWT signing and verification.
 * Handles automatic key generation, rotation, and JWKS endpoint support.
 *
 * Key Lifecycle:
 * 1. next: Generated, waiting to be activated
 * 2. active: Currently used for signing tokens
 * 3. previous: Recently rotated, still valid for verification
 * 4. retired: No longer valid for any operation
 */
export class JwtKeyService {
  /** Cache for active signing key */
  private activeKeyCache: JwtKeyEntity | null = null;
  private activeKeyCacheTime: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute

  constructor(private readonly mikro: MikroService) {}

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
    const rotationDays = AppConfigs.app.jwt_key_rotation_days ?? 30;

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
    const rotationDays = AppConfigs.app.jwt_key_rotation_days ?? 30;

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
    const days = overlapDays ?? AppConfigs.app.jwt_key_overlap_days ?? 7;
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
   * Called periodically by scheduler.
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

    const key = await this.mikro.jwtKey.getActiveKey();

    if (!key) {
      throw new Error('No active JWT signing key found');
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
  async getJWKS(): Promise<{ keys: PublicJWK[] }> {
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
}

export default fastifyPlugin(
  async (fastify) => {
    fastify.decorate('jwtKeyService', new JwtKeyService(fastify.mikro));

    // Ensure active key exists on startup (use forked EM for bootstrap)
    const em = fastify.mikro.orm.em.fork();
    const jwtKeyRepo = em.getRepository(JwtKeyEntity);

    // Check if active key exists, if not create one
    const activeKey = await jwtKeyRepo.findOne({
      status: JwtKeyStatus.ACTIVE,
    });
    if (!activeKey) {
      const nextKey = await jwtKeyRepo.findOne({
        status: JwtKeyStatus.NEXT,
      });
      if (nextKey) {
        nextKey.status = JwtKeyStatus.ACTIVE;
        nextKey.activated_at = new Date();
        await em.flush();
      } else {
        // Generate and activate a new key
        const keyPair = await fastify.jwtKeyService.generateKeyPair();
        const rotationDays = AppConfigs.app.jwt_key_rotation_days ?? 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + rotationDays);

        const entity = em.create(JwtKeyEntity, {
          kid: keyPair.kid,
          private_key: keyPair.privateKey,
          public_key: keyPair.publicKey,
          algorithm: keyPair.algorithm,
          status: JwtKeyStatus.ACTIVE,
          activated_at: new Date(),
          expires_at: expiresAt,
        });
        await em.persist(entity).flush();
      }
    }

    // Clear cache after bootstrap
    fastify.jwtKeyService.clearActiveKeyCache();

    // Optional: Set up periodic rotation check
    const rotationEnabled = AppConfigs.app.jwt_key_rotation_enabled ?? true;

    if (rotationEnabled) {
      const checkInterval = setInterval(
        async () => {
          try {
            const rotated = await fastify.jwtKeyService.checkAndRotate();
            if (rotated) {
              fastify.log.info('JWT key rotation performed');
            }
          } catch (err) {
            fastify.log.error(err, 'JWT key rotation check failed');
          }
        },
        60 * 60 * 1000,
      ); // Check every hour

      fastify.addHook('onClose', () => {
        clearInterval(checkInterval);
      });
    }
  },
  {
    name: 'jwt-key-service-plugin',
    dependencies: ['mikro-orm-plugin'],
  },
);
