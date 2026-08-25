/**
 * CLI test utilities for testing cleanup tasks and CLI commands.
 * Provides helper functions for creating test data with specific states.
 */

import { EmailVerificationEntitySchema } from '../entities/email-verification.entity.ts';
import { JwtKeyEntity, JwtKeyStatus } from '../entities/jwt-key.entity.ts';
import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.ts';
import { OAuthCodeEntitySchema } from '../entities/oauth-code.entity.ts';
import { PasswordResetEntitySchema } from '../entities/password-reset.entity.ts';
import { PendingOAuthRegistrationEntitySchema } from '../entities/pending-oauth-registration.entity.ts';
import {
  RevokedTokenEntitySchema,
  type TokenType,
} from '../entities/revoked-token.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';
import {
  type IssuaryRuntimeConfig,
  IssuaryRuntimeConfigSchema,
} from '../lib/config/index.ts';
import type { ServiceContainer } from '../services/container.ts';
import { withMikroContext } from './helpers.ts';
import { MINIMAL_TEST_CONFIG } from './setup.ts';

/**
 * Minimal CLI test configuration with cleanup enabled.
 * Uses immediate retention (0) for faster test execution.
 */
export const CLI_TEST_CONFIG = {
  ...IssuaryRuntimeConfigSchema.parse({
    ...MINIMAL_TEST_CONFIG,
    account_deletion: {
      enabled: true,
      retention: '0',
    },
    cleanup: {
      revoked_tokens: {
        enabled: true,
        retention: '0',
      },
      oauth_codes: {
        enabled: true,
        consumed_retention: '0',
      },
      email_verifications: {
        enabled: true,
        retention: '0',
      },
      password_resets: {
        enabled: true,
        retention: '0',
      },
      pending_oauth_registrations: {
        enabled: true,
        retention: '0',
      },
    },
    tokens: {
      key_rotation: {
        enabled: true,
      },
    },
  }),
} satisfies IssuaryRuntimeConfig;

/**
 * Create a test user in the database.
 *
 * @param services - Service container
 * @param options - User creation options
 * @returns Created user ID
 */
export async function createTestUser(
  services: ServiceContainer,
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

  let userSub = '';

  await withMikroContext(services, async () => {
    const passwordHash = await services.securityService.hashPassword(password);
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = emailVerified;
    user.deleted_at = deletedAt;
    user.managed_by = managedBy;
    await services.mikro.em.persist(user).flush();
    userSub = user.sub;
  });

  return userSub;
}

/**
 * Create a test OAuth client in the database.
 *
 * @param services - Service container
 * @param options - Client creation options
 * @returns Created client ID
 */
export async function createTestOAuthClient(
  services: ServiceContainer,
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

  await withMikroContext(services, async () => {
    const em = services.mikro.em;
    const clientSecretHash =
      await services.securityService.hashClientSecret('test-secret-hash');
    const client = em.create(OAuthClientEntitySchema, {
      clientId,
      clientSecretHash,
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
 * @param services - Service container
 * @param options - Token creation options
 * @returns Created token ID
 */
export async function createRevokedToken(
  services: ServiceContainer,
  options: {
    userSub: string;
    clientId: string;
    expiresAt?: Date;
    tokenType?: TokenType;
  },
): Promise<string> {
  const {
    userSub,
    clientId,
    expiresAt = new Date(Date.now() - 1000), // Expired by default
    tokenType = 'access_token',
  } = options;

  let tokenId = '';

  await withMikroContext(services, async () => {
    // Use repository's revokeToken method for proper entity creation
    const token = await services.mikro.revokedToken.revokeToken({
      jti: `test-jti-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      token_type: tokenType,
      clientId,
      userSub,
      expires_at: expiresAt,
    });
    tokenId = token.id;
  });

  return tokenId;
}

/**
 * Create an OAuth authorization code for testing.
 *
 * @param services - Service container
 * @param options - Code creation options
 * @returns Created code ID
 */
export async function createOAuthCode(
  services: ServiceContainer,
  options: {
    userSub: string;
    clientId: string;
    expiredAt?: Date;
    consumedAt?: Date | null;
  },
): Promise<string> {
  const {
    userSub,
    clientId,
    expiredAt = new Date(Date.now() - 1000), // Expired by default
    consumedAt = null,
  } = options;

  let codeId = '';

  await withMikroContext(services, async () => {
    const codeHash = await services.securityService.hashOpaqueToken(
      'oauth-code',
      `test-oauth-code-${crypto.randomUUID()}`,
    );
    const entity = await services.mikro.oauthCode.createAuthorizationCode({
      clientId,
      userSub,
      codeHash,
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
    await services.mikro.em.flush();
    codeId = entity.id;
  });

  return codeId;
}

/**
 * Create an email verification token for testing.
 *
 * @param services - Service container
 * @param options - Token creation options
 * @returns Created verification ID
 */
export async function createEmailVerification(
  services: ServiceContainer,
  options: {
    userSub: string;
    expiresAt?: Date;
    verified?: boolean;
  },
): Promise<string> {
  const {
    userSub,
    expiresAt = new Date(Date.now() - 1000), // Expired by default
    verified = false,
  } = options;

  let verificationId = '';

  await withMikroContext(services, async () => {
    // Create the requested fixture state directly. generateToken() expires
    // previous tokens at the current millisecond, which makes cleanup tests
    // race their strict `$lt` cutoff under parallel load.
    const verification = services.mikro.emailVerification.create({
      user: userSub,
      token: crypto.randomUUID(),
      expiresAt,
      verified,
    });
    await services.mikro.em.persist(verification).flush();
    verificationId = verification.id;
  });

  return verificationId;
}

/**
 * Create a password reset token for testing.
 *
 * @param services - Service container
 * @param options - Token creation options
 * @returns Created reset ID
 */
export async function createPasswordReset(
  services: ServiceContainer,
  options: {
    userSub: string;
    expiresAt?: Date;
    used?: boolean;
  },
): Promise<string> {
  const {
    userSub,
    expiresAt = new Date(Date.now() - 1000), // Expired by default
    used = false,
  } = options;

  let resetId = '';

  await withMikroContext(services, async () => {
    // Create the requested fixture state directly. generateToken() expires
    // previous tokens at the current millisecond, which makes cleanup tests
    // race their strict `$lt` cutoff under parallel load.
    const reset = services.mikro.passwordReset.create({
      user: userSub,
      token: crypto.randomUUID(),
      expiresAt,
      used,
    });
    await services.mikro.em.persist(reset).flush();
    resetId = reset.id;
  });

  return resetId;
}

/**
 * Create a pending OAuth registration for testing.
 *
 * @param services - Service container
 * @param options - Registration creation options
 * @returns Created registration token
 */
export async function createPendingOAuthRegistration(
  services: ServiceContainer,
  options: {
    expiresAt?: Date;
  } = {},
): Promise<string> {
  const { expiresAt = new Date(Date.now() - 1000) } = options;

  let token = '';

  await withMikroContext(services, async () => {
    token =
      await services.mikro.pendingOAuthRegistration.createPendingRegistration({
        providerId: 'google',
        accessToken: `test-access-token-${Date.now()}`,
        refreshToken: `test-refresh-token-${Date.now()}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
        userInfo: {
          id: `provider-user-${Date.now()}`,
          email: `test-${Date.now()}@example.com`,
          email_verified: true,
          name: 'Test User',
        },
        expiresAt,
      });
  });

  return token;
}

/**
 * Create a JWT key for testing.
 *
 * @param services - Service container
 * @param options - Key creation options
 * @returns Created key ID (kid)
 */
export async function createJwtKey(
  services: ServiceContainer,
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

  await withMikroContext(services, async () => {
    // Generate a real key pair for testing
    const keyPair = await services.jwtService.generateKeyPair();

    const key = services.mikro.jwtKey.create({
      kid: keyPair.kid,
      private_key: keyPair.privateKey,
      public_key: keyPair.publicKey,
      algorithm: keyPair.algorithm,
      status,
      expires_at: expiresAt,
      activated_at: activatedAt,
      deactivated_at: deactivatedAt,
    });

    await services.mikro.em.persist(key).flush();
    kid = key.kid;
  });

  return kid;
}

/**
 * Count entities in the database.
 *
 * @param services - Service container
 * @param entityName - Name of the entity to count
 * @param filter - Optional filter criteria
 * @returns Count of entities
 */
export async function countEntities(
  services: ServiceContainer,
  entityName:
    | 'revokedToken'
    | 'oauthCode'
    | 'emailVerification'
    | 'passwordReset'
    | 'pendingOAuthRegistration'
    | 'jwtKey'
    | 'user',
  filter: Record<string, unknown> = {},
): Promise<number> {
  let count = 0;

  await withMikroContext(services, async () => {
    const em = services.mikro.em.fork();

    switch (entityName) {
      case 'revokedToken':
        count = await em.count(RevokedTokenEntitySchema, filter);
        break;
      case 'oauthCode':
        count = await em.count(OAuthCodeEntitySchema, filter);
        break;
      case 'emailVerification':
        count = await em.count(EmailVerificationEntitySchema, filter);
        break;
      case 'passwordReset':
        count = await em.count(PasswordResetEntitySchema, filter);
        break;
      case 'pendingOAuthRegistration':
        count = await em.count(PendingOAuthRegistrationEntitySchema, filter);
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
 * @param services - Service container
 * @param kid - Key ID
 * @returns JWT key entity or null
 */
export async function getJwtKey(
  services: ServiceContainer,
  kid: string,
): Promise<JwtKeyEntity | null> {
  let key: JwtKeyEntity | null = null;

  await withMikroContext(services, async () => {
    const em = services.mikro.em.fork();
    key = await em.findOne(JwtKeyEntity, { kid });
  });

  return key;
}
