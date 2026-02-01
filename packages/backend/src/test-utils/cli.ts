/**
 * CLI test utilities for testing cleanup tasks and CLI commands.
 * Provides helper functions for creating test data with specific states.
 */

import type { FastifyInstance } from 'fastify';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { JwtKeyEntity, JwtKeyStatus } from '@/entities/jwt-key.entity.js';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import {
  RevokedTokenEntity,
  type TokenType,
} from '@/entities/revoked-token.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import type { AppConfigInput } from '@/lib/config/schemas/root.js';
import { withMikroContext } from './helpers.js';
import { MINIMAL_TEST_CONFIG } from './setup.js';

/**
 * Minimal CLI test configuration with cleanup enabled.
 * Uses immediate retention (0) for faster test execution.
 */
export const CLI_TEST_CONFIG = {
  ...MINIMAL_TEST_CONFIG,
  app: {
    ...MINIMAL_TEST_CONFIG.app,
    account_deletion: true,
  },
  cleanup: {
    revoked_tokens: { enabled: true, retention: '0' },
    oauth_codes: { enabled: true, consumed_retention: '0' },
    email_verifications: { enabled: true, retention: '0' },
    password_resets: { enabled: true, retention: '0' },
    deleted_users: { enabled: true, retention: '0' },
    jwt_keys: { enabled: true },
  },
} as const satisfies AppConfigInput;

/**
 * Create a test user in the database.
 *
 * @param app - Fastify instance
 * @param options - User creation options
 * @returns Created user ID
 */
export async function createTestUser(
  app: FastifyInstance,
  options: {
    email?: string;
    password?: string;
    emailVerified?: boolean;
    deletedAt?: Date | null;
    managedBy?: 'database' | 'config';
  } = {},
): Promise<string> {
  const {
    email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password = 'password123',
    emailVerified = true,
    deletedAt = null,
    managedBy = 'database',
  } = options;

  let userId = '';

  await withMikroContext(app, async () => {
    const user = app.mikro.user.create({
      email,
      password_hash: password,
    });
    user.email_verified = emailVerified;
    user.deleted_at = deletedAt;
    user.managed_by = managedBy;
    await app.mikro.em.persist(user).flush();
    userId = user.id;
  });

  return userId;
}

/**
 * Create a test OAuth client in the database.
 *
 * @param app - Fastify instance
 * @param options - Client creation options
 * @returns Created client ID
 */
export async function createTestOAuthClient(
  app: FastifyInstance,
  options: {
    clientId?: string;
    name?: string;
    redirectUris?: string[];
  } = {},
): Promise<string> {
  const {
    clientId = `test-client-${Date.now()}`,
    name = 'Test Client',
    redirectUris = ['http://localhost/callback'],
  } = options;

  let id = '';

  await withMikroContext(app, async () => {
    const em = app.mikro.em;
    const client = em.create(OAuthClientEntity, {
      clientId,
      clientSecretHash: 'test-secret-hash',
      name,
      redirectUris,
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scopes: ['openid', 'profile', 'email'],
      enabled: true,
      managed_by: 'database',
    });
    await em.persist(client).flush();
    id = client.id;
  });

  return id;
}

/**
 * Create a revoked token for testing.
 *
 * @param app - Fastify instance
 * @param options - Token creation options
 * @returns Created token ID
 */
export async function createRevokedToken(
  app: FastifyInstance,
  options: {
    userId: string;
    clientId: string;
    expiresAt?: Date;
    tokenType?: TokenType;
  },
): Promise<string> {
  const {
    userId,
    clientId,
    expiresAt = new Date(Date.now() - 1000), // Expired by default
    tokenType = 'access_token',
  } = options;

  let tokenId = '';

  await withMikroContext(app, async () => {
    // Use repository's revokeToken method for proper entity creation
    const token = await app.mikro.revokedToken.revokeToken({
      jti: `test-jti-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      token_type: tokenType,
      clientId,
      userId,
      expires_at: expiresAt,
    });
    tokenId = token.id;
  });

  return tokenId;
}

/**
 * Create an OAuth authorization code for testing.
 *
 * @param app - Fastify instance
 * @param options - Code creation options
 * @returns Created code ID
 */
export async function createOAuthCode(
  app: FastifyInstance,
  options: {
    userId: string;
    clientId: string;
    expiredAt?: Date;
    consumedAt?: Date | null;
  },
): Promise<string> {
  const {
    userId,
    clientId,
    expiredAt = new Date(Date.now() - 1000), // Expired by default
    consumedAt = null,
  } = options;

  let codeId = '';

  await withMikroContext(app, async () => {
    // Use repository's generateAuthorizationCode method for proper entity creation
    const { entity } = await app.mikro.oauthCode.generateAuthorizationCode({
      clientId,
      userId,
      redirectUri: 'http://localhost/callback',
      scope: ['openid'],
      nonce: 'test-nonce',
      codeChallenge: 'test-challenge',
      codeChallengeMethod: 'S256',
      expiresInSeconds: 600,
    });
    // Override expiredAt for expired codes
    entity.expiredAt = expiredAt;
    if (consumedAt !== null) {
      entity.consumedAt = consumedAt;
    }
    await app.mikro.em.flush();
    codeId = entity.id;
  });

  return codeId;
}

/**
 * Create an email verification token for testing.
 *
 * @param app - Fastify instance
 * @param options - Token creation options
 * @returns Created verification ID
 */
export async function createEmailVerification(
  app: FastifyInstance,
  options: {
    userId: string;
    expiresAt?: Date;
    verified?: boolean;
  },
): Promise<string> {
  const {
    userId,
    expiresAt = new Date(Date.now() - 1000), // Expired by default
    verified = false,
  } = options;

  let verificationId = '';

  await withMikroContext(app, async () => {
    // Use repository's generateToken method for proper entity creation
    const verification = await app.mikro.emailVerification.generateToken({
      userId,
      expiresInHours: 1,
    });
    // Override the fields for test purposes
    verification.expiresAt = expiresAt;
    verification.verified = verified;
    await app.mikro.em.flush();
    verificationId = verification.id;
  });

  return verificationId;
}

/**
 * Create a password reset token for testing.
 *
 * @param app - Fastify instance
 * @param options - Token creation options
 * @returns Created reset ID
 */
export async function createPasswordReset(
  app: FastifyInstance,
  options: {
    userId: string;
    expiresAt?: Date;
    used?: boolean;
  },
): Promise<string> {
  const {
    userId,
    expiresAt = new Date(Date.now() - 1000), // Expired by default
    used = false,
  } = options;

  let resetId = '';

  await withMikroContext(app, async () => {
    // Use repository's generateToken method for proper entity creation
    const reset = await app.mikro.passwordReset.generateToken({
      userId,
      expiresInHours: 1,
    });
    // Override the fields for test purposes
    reset.expiresAt = expiresAt;
    reset.used = used;
    await app.mikro.em.flush();
    resetId = reset.id;
  });

  return resetId;
}

/**
 * Create a JWT key for testing.
 *
 * @param app - Fastify instance
 * @param options - Key creation options
 * @returns Created key ID (kid)
 */
export async function createJwtKey(
  app: FastifyInstance,
  options: {
    status?: JwtKeyStatus;
    expiresAt?: Date | null;
    activatedAt?: Date | null;
    deactivatedAt?: Date | null;
  } = {},
): Promise<string> {
  const {
    status = JwtKeyStatus.ACTIVE,
    expiresAt = new Date(Date.now() - 1000), // Expired by default
    activatedAt = new Date(Date.now() - 86400000), // 1 day ago
    deactivatedAt = null,
  } = options;

  let kid = '';

  await withMikroContext(app, async () => {
    // Generate a real key pair for testing
    const keyPair = await app.jwtKeyService.generateKeyPair();

    const key = app.mikro.jwtKey.create({
      kid: keyPair.kid,
      private_key: keyPair.privateKey,
      public_key: keyPair.publicKey,
      algorithm: keyPair.algorithm,
      status,
      expires_at: expiresAt,
      activated_at: activatedAt,
      deactivated_at: deactivatedAt,
    });

    await app.mikro.em.persist(key).flush();
    kid = key.kid;
  });

  return kid;
}

/**
 * Count entities in the database.
 *
 * @param app - Fastify instance
 * @param entityName - Name of the entity to count
 * @param filter - Optional filter criteria
 * @returns Count of entities
 */
export async function countEntities(
  app: FastifyInstance,
  entityName:
    | 'revokedToken'
    | 'oauthCode'
    | 'emailVerification'
    | 'passwordReset'
    | 'jwtKey'
    | 'user',
  filter: Record<string, unknown> = {},
): Promise<number> {
  let count = 0;

  await withMikroContext(app, async () => {
    const em = app.mikro.em.fork();

    switch (entityName) {
      case 'revokedToken':
        count = await em.count(RevokedTokenEntity, filter);
        break;
      case 'oauthCode':
        count = await em.count(OAuthCodeEntity, filter);
        break;
      case 'emailVerification':
        count = await em.count(EmailVerificationEntity, filter);
        break;
      case 'passwordReset':
        count = await em.count(PasswordResetEntity, filter);
        break;
      case 'jwtKey':
        count = await em.count(JwtKeyEntity, filter);
        break;
      case 'user':
        count = await em.count(UserEntity, filter);
        break;
    }
  });

  return count;
}

/**
 * Get a JWT key by kid.
 *
 * @param app - Fastify instance
 * @param kid - Key ID
 * @returns JWT key entity or null
 */
export async function getJwtKey(
  app: FastifyInstance,
  kid: string,
): Promise<JwtKeyEntity | null> {
  let key: JwtKeyEntity | null = null;

  await withMikroContext(app, async () => {
    const em = app.mikro.em.fork();
    key = await em.findOne(JwtKeyEntity, { kid });
  });

  return key;
}
