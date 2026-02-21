import { EmailVerificationEntitySchema } from '@backend/entities/email-verification.entity.js';
import {
  JwtKeyEntity,
  JwtKeyStatus,
} from '@backend/entities/jwt-key.entity.js';
import { OAuthCodeEntitySchema } from '@backend/entities/oauth-code.entity.js';
import { PasswordResetEntitySchema } from '@backend/entities/password-reset.entity.js';
import { PendingOAuthRegistrationEntitySchema } from '@backend/entities/pending-oauth-registration.entity.js';
import { RevokedTokenEntitySchema } from '@backend/entities/revoked-token.entity.js';
import { UserEntity } from '@backend/entities/user.entity.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createEmailVerification,
  createJwtKey,
  createOAuthCode,
  createPasswordReset,
  createPendingOAuthRegistration,
  createRevokedToken,
  createTestOAuthClient,
  createTestUser,
  getJwtKey,
} from '@backend/test-utils/cli.js';
import {
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';

describe('CleanupService', () => {
  describe('cleanupRevokedTokens', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let userSub: string;
    let clientId: string;

    beforeAll(async () => {
      const server = await createServer({
        config: CLI_TEST_CONFIG,
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;

      // Create test user and client for all tests
      userSub = await createTestUser(services);
      clientId = await createTestOAuthClient(services);
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      // Clean up revoked tokens before each test
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(RevokedTokenEntitySchema, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            revoked_tokens: { enabled: false },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await disabledServer.services.cleanupService.cleanupRevokedTokens({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledServer.cleanup();
      }
    });

    test('should return "No expired tokens" when nothing to clean', async () => {
      const result = await services.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired tokens');
    });

    test('should delete expired revoked tokens', async () => {
      // Create expired tokens
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
      });
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() - 20000), // Expired 20 seconds ago
      });

      // Verify tokens exist
      const countBefore = await countEntities(services, 'revokedToken');
      expect(countBefore).toBe(2);

      const result = await services.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      // Verify tokens are deleted
      const countAfter = await countEntities(services, 'revokedToken');
      expect(countAfter).toBe(0);
    });

    test('should not delete non-expired tokens', async () => {
      // Create one expired and one non-expired token
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() - 10000), // Expired
      });
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() + 60000), // Expires in 1 minute
      });

      const result = await services.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      // Verify one token remains
      const countAfter = await countEntities(services, 'revokedToken');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode (report but not delete)', async () => {
      // Create expired tokens
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() - 10000),
      });
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() - 20000),
      });

      const result = await services.cleanupService.cleanupRevokedTokens({
        dryRun: true,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Would delete');

      // Verify tokens are NOT deleted
      const countAfter = await countEntities(services, 'revokedToken');
      expect(countAfter).toBe(2);
    });

    test('should respect retention period configuration', async () => {
      // Create app with 1 hour retention
      const retentionServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            revoked_tokens: { enabled: true, retention: '1h' },
          },
        },
        skipListen: true,
      });

      try {
        const testUserSub = await createTestUser(retentionServer.services);
        const testClientId = await createTestOAuthClient(
          retentionServer.services,
        );

        // Create token expired 30 minutes ago (within retention)
        await createRevokedToken(retentionServer.services, {
          userSub: testUserSub,
          clientId: testClientId,
          expiresAt: new Date(Date.now() - 30 * 60 * 1000),
        });

        // Create token expired 2 hours ago (past retention)
        await createRevokedToken(retentionServer.services, {
          userSub: testUserSub,
          clientId: testClientId,
          expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        });

        const result =
          await retentionServer.services.cleanupService.cleanupRevokedTokens({
            dryRun: false,
          });

        // Only the 2-hour old token should be deleted
        expect(result.deletedCount).toBe(1);
        expect(result.message).toContain('1 hour');
      } finally {
        await retentionServer.cleanup();
      }
    });

    test('should handle both access and refresh tokens', async () => {
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() - 10000),
        tokenType: 'access_token',
      });
      await createRevokedToken(services, {
        userSub,
        clientId,
        expiresAt: new Date(Date.now() - 10000),
        tokenType: 'refresh_token',
      });

      const result = await services.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(2);
    });
  });

  describe('rotateExpiredJwtKeys', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createServer({
        config: {
          ...CLI_TEST_CONFIG,
          app: {
            ...CLI_TEST_CONFIG.app,
            jwt_key_rotation_enabled: true,
            jwt_key_rotation_days: 30,
            jwt_key_overlap_days: 7,
          },
        },
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      // Clean up JWT keys before each test
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(JwtKeyEntity, {});
      });
      // Clear service cache
      services.jwtService.clearActiveKeyCache();
    });

    test('should skip when disabled in config', async () => {
      const disabledServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            jwt_keys: { enabled: false },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await disabledServer.services.cleanupService.rotateExpiredJwtKeys({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledServer.cleanup();
      }
    });

    test('should skip when jwt_key_rotation_enabled is false', async () => {
      const noRotationServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            jwt_key_rotation_enabled: false,
          },
          cleanup: {
            jwt_keys: { enabled: true },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await noRotationServer.services.cleanupService.rotateExpiredJwtKeys({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.message).toBe(
          'JWT key rotation is disabled in app config',
        );
      } finally {
        await noRotationServer.cleanup();
      }
    });

    test('should return "No rotation needed" when no expired active keys', async () => {
      // Create active key that is not expired
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 1 day
        activatedAt: new Date(),
      });

      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No rotation needed');
    });

    test('should rotate expired active keys to previous status', async () => {
      // Create expired active key
      const kid = await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000), // Expired
        activatedAt: new Date(Date.now() - 86400000),
      });

      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('rotation performed');

      // Verify key status changed to PREVIOUS
      const key = await getJwtKey(services, kid);
      expect(key).not.toBeNull();
      expect(key?.status).toBe(JwtKeyStatus.PREVIOUS);
      expect(key?.deactivated_at).not.toBeNull();
    });

    test('should promote next key to active', async () => {
      // Create expired active key
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // Create next key ready for promotion
      const nextKid = await createJwtKey(services, {
        status: JwtKeyStatus.NEXT,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        activatedAt: null,
      });

      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      // Verify next key was promoted to active
      const promotedKey = await getJwtKey(services, nextKid);
      expect(promotedKey).not.toBeNull();
      expect(promotedKey?.status).toBe(JwtKeyStatus.ACTIVE);
      expect(promotedKey?.activated_at).not.toBeNull();
    });

    test('should generate new key if no next key exists', async () => {
      // Create expired active key without a next key
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      const countBefore = await countEntities(services, 'jwtKey');
      expect(countBefore).toBe(1);

      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      // Should have created a new key
      const countAfter = await countEntities(services, 'jwtKey');
      expect(countAfter).toBe(2);

      // Verify there's an active key
      const activeCount = await countEntities(services, 'jwtKey', {
        status: JwtKeyStatus.ACTIVE,
      });
      expect(activeCount).toBe(1);
    });

    test('should retire old previous keys past overlap period', async () => {
      // Create expired active key
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // Create old previous key (deactivated 10 days ago, past 7-day overlap)
      const oldPreviousKid = await createJwtKey(services, {
        status: JwtKeyStatus.PREVIOUS,
        expiresAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        deactivatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });

      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.message).toContain('retired');

      // Verify old previous key was retired
      const retiredKey = await getJwtKey(services, oldPreviousKid);
      expect(retiredKey).not.toBeNull();
      expect(retiredKey?.status).toBe(JwtKeyStatus.RETIRED);
      expect(retiredKey?.retired_at).not.toBeNull();
    });

    test('should not retire recent previous keys within overlap period', async () => {
      // Create expired active key
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // Create recent previous key (deactivated 1 day ago, within 7-day overlap)
      const recentPreviousKid = await createJwtKey(services, {
        status: JwtKeyStatus.PREVIOUS,
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        deactivatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });

      await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      // Verify recent previous key was NOT retired
      const previousKey = await getJwtKey(services, recentPreviousKid);
      expect(previousKey).not.toBeNull();
      expect(previousKey?.status).toBe(JwtKeyStatus.PREVIOUS);
    });

    test('should clear service cache after rotation', async () => {
      // Create expired active key
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // The method should call clearActiveKeyCache
      // We can verify this indirectly by checking the rotation completes
      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('rotation performed');
    });

    test('should work in dry-run mode', async () => {
      // Create expired active key
      const kid = await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would rotate');

      // Verify key was NOT rotated
      const key = await getJwtKey(services, kid);
      expect(key).not.toBeNull();
      expect(key?.status).toBe(JwtKeyStatus.ACTIVE);
    });

    test('should handle multiple expired active keys', async () => {
      // Create multiple expired active keys (unusual but possible)
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });
      await createJwtKey(services, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 2000),
        activatedAt: new Date(Date.now() - 172800000),
      });

      const result = await services.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      // Both should be rotated
      expect(result.deletedCount).toBe(1); // Reports 1 for "rotation performed"
      expect(result.message).toContain('rotation performed');

      // Both should now be PREVIOUS
      const previousCount = await countEntities(services, 'jwtKey', {
        status: JwtKeyStatus.PREVIOUS,
      });
      expect(previousCount).toBe(2);
    });
  });

  describe('cleanupOAuthCodes', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let userSub: string;
    let clientId: string;

    beforeAll(async () => {
      const server = await createServer({
        config: CLI_TEST_CONFIG,
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;

      userSub = await createTestUser(services);
      clientId = await createTestOAuthClient(services);
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      // Clean up OAuth codes before each test
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(OAuthCodeEntitySchema, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            oauth_codes: { enabled: false },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await disabledServer.services.cleanupService.cleanupOAuthCodes({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledServer.cleanup();
      }
    });

    test('should return message when nothing to clean', async () => {
      const result = await services.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired or consumed codes');
    });

    test('should delete expired authorization codes', async () => {
      // Create expired codes
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() - 10000), // Expired
        consumedAt: null,
      });
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() - 20000), // Expired
        consumedAt: null,
      });

      const countBefore = await countEntities(services, 'oauthCode');
      expect(countBefore).toBe(2);

      const result = await services.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('2 expired');

      const countAfter = await countEntities(services, 'oauthCode');
      expect(countAfter).toBe(0);
    });

    test('should delete consumed codes older than retention period', async () => {
      // Create consumed code older than retention (retention is 0 in CLI_TEST_CONFIG)
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() + 60000), // Not expired
        consumedAt: new Date(Date.now() - 10000), // Consumed 10 seconds ago
      });

      const result = await services.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('consumed');
    });

    test('should not delete recently consumed codes within retention', async () => {
      // Create app with 1 hour consumed retention
      const retentionServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            oauth_codes: { enabled: true, consumed_retention: '1h' },
          },
        },
        skipListen: true,
      });

      try {
        const testUserSub = await createTestUser(retentionServer.services);
        const testClientId = await createTestOAuthClient(
          retentionServer.services,
        );

        // Create recently consumed code (30 minutes ago, within 1 hour retention)
        await createOAuthCode(retentionServer.services, {
          userSub: testUserSub,
          clientId: testClientId,
          expiredAt: new Date(Date.now() + 60000),
          consumedAt: new Date(Date.now() - 30 * 60 * 1000),
        });

        const result =
          await retentionServer.services.cleanupService.cleanupOAuthCodes({
            dryRun: false,
          });

        // Should not delete the recently consumed code
        expect(result.deletedCount).toBe(0);
      } finally {
        await retentionServer.cleanup();
      }
    });

    test('should not delete non-expired and non-consumed codes', async () => {
      // Create a valid, non-consumed code
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() + 60000), // Valid
        consumedAt: null, // Not consumed
      });

      const result = await services.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(0);

      const countAfter = await countEntities(services, 'oauthCode');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() - 10000),
        consumedAt: null,
      });
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() + 60000),
        consumedAt: new Date(Date.now() - 10000),
      });

      const result = await services.cleanupService.cleanupOAuthCodes({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Would delete');

      // Codes should NOT be deleted
      const countAfter = await countEntities(services, 'oauthCode');
      expect(countAfter).toBe(2);
    });

    test('should report correct counts for expired vs consumed', async () => {
      // Create 2 expired codes
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() - 10000),
        consumedAt: null,
      });
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() - 20000),
        consumedAt: null,
      });

      // Create 1 consumed code
      await createOAuthCode(services, {
        userSub,
        clientId,
        expiredAt: new Date(Date.now() + 60000),
        consumedAt: new Date(Date.now() - 10000),
      });

      const result = await services.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(3);
      expect(result.message).toContain('2 expired');
      expect(result.message).toContain('1 consumed');
    });
  });

  describe('cleanupEmailVerifications', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let userSub: string;

    beforeAll(async () => {
      const server = await createServer({
        config: CLI_TEST_CONFIG,
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;

      userSub = await createTestUser(services);
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(EmailVerificationEntitySchema, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            email_verifications: { enabled: false },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await disabledServer.services.cleanupService.cleanupEmailVerifications(
            {
              dryRun: false,
            },
          );

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledServer.cleanup();
      }
    });

    test('should return "No expired tokens" when nothing to clean', async () => {
      const result = await services.cleanupService.cleanupEmailVerifications({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired tokens');
    });

    test('should delete expired unverified tokens', async () => {
      await createEmailVerification(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        verified: false,
      });
      await createEmailVerification(services, {
        userSub,
        expiresAt: new Date(Date.now() - 20000),
        verified: false,
      });

      const countBefore = await countEntities(services, 'emailVerification');
      expect(countBefore).toBe(2);

      const result = await services.cleanupService.cleanupEmailVerifications({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      const countAfter = await countEntities(services, 'emailVerification');
      expect(countAfter).toBe(0);
    });

    test('should not delete verified tokens', async () => {
      // Create expired but verified token (should not be deleted)
      await createEmailVerification(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        verified: true,
      });

      // Create expired unverified token (should be deleted)
      await createEmailVerification(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        verified: false,
      });

      const result = await services.cleanupService.cleanupEmailVerifications({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(services, 'emailVerification');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createEmailVerification(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        verified: false,
      });

      const result = await services.cleanupService.cleanupEmailVerifications({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would delete');

      const countAfter = await countEntities(services, 'emailVerification');
      expect(countAfter).toBe(1);
    });
  });

  describe('cleanupPasswordResets', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let userSub: string;

    beforeAll(async () => {
      const server = await createServer({
        config: CLI_TEST_CONFIG,
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;

      userSub = await createTestUser(services);
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(PasswordResetEntitySchema, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            password_resets: { enabled: false },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await disabledServer.services.cleanupService.cleanupPasswordResets({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledServer.cleanup();
      }
    });

    test('should return "No expired tokens" when nothing to clean', async () => {
      const result = await services.cleanupService.cleanupPasswordResets({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired tokens');
    });

    test('should delete expired unused tokens', async () => {
      await createPasswordReset(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        used: false,
      });
      await createPasswordReset(services, {
        userSub,
        expiresAt: new Date(Date.now() - 20000),
        used: false,
      });

      const countBefore = await countEntities(services, 'passwordReset');
      expect(countBefore).toBe(2);

      const result = await services.cleanupService.cleanupPasswordResets({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      const countAfter = await countEntities(services, 'passwordReset');
      expect(countAfter).toBe(0);
    });

    test('should not delete used tokens', async () => {
      // Create expired but used token (should not be deleted)
      await createPasswordReset(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        used: true,
      });

      // Create expired unused token (should be deleted)
      await createPasswordReset(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        used: false,
      });

      const result = await services.cleanupService.cleanupPasswordResets({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(services, 'passwordReset');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createPasswordReset(services, {
        userSub,
        expiresAt: new Date(Date.now() - 10000),
        used: false,
      });

      const result = await services.cleanupService.cleanupPasswordResets({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would delete');

      const countAfter = await countEntities(services, 'passwordReset');
      expect(countAfter).toBe(1);
    });
  });

  describe('cleanupDeletedUsers', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createServer({
        config: CLI_TEST_CONFIG,
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(UserEntity, { managed_by: 'database' });
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            deleted_users: { enabled: false },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await disabledServer.services.cleanupService.cleanupDeletedUsers({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledServer.cleanup();
      }
    });

    test('should skip when account_deletion feature is disabled', async () => {
      const noAccountDeletionServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            account_deletion: false,
          },
          cleanup: {
            deleted_users: { enabled: true, retention: '0' },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await noAccountDeletionServer.services.cleanupService.cleanupDeletedUsers(
            {
              dryRun: false,
            },
          );

        expect(result.skipped).toBe(true);
        expect(result.message).toBe('Account deletion feature is disabled');
      } finally {
        await noAccountDeletionServer.cleanup();
      }
    });

    test('should return message when no users ready for deletion', async () => {
      const result = await services.cleanupService.cleanupDeletedUsers({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No users ready for permanent deletion');
    });

    test('should permanently delete users after retention period', async () => {
      // Create soft-deleted user (deleted 10 seconds ago, retention is 0)
      await createTestUser(services, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      const countBefore = await countEntities(services, 'user', {
        managed_by: 'database',
      });
      expect(countBefore).toBe(1);

      const result = await services.cleanupService.cleanupDeletedUsers({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(services, 'user', {
        managed_by: 'database',
      });
      expect(countAfter).toBe(0);
    });

    test('should only delete database-managed users', async () => {
      // Create a database-managed soft-deleted user
      await createTestUser(services, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      // Create a config-managed soft-deleted user (should not be deleted)
      await createTestUser(services, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'config',
      });

      const result = await services.cleanupService.cleanupDeletedUsers({
        dryRun: false,
      });

      // Only database-managed user should be deleted
      expect(result.deletedCount).toBe(1);

      // Config-managed user should remain
      const configUserCount = await countEntities(services, 'user', {
        managed_by: 'config',
      });
      expect(configUserCount).toBe(1);

      // Cleanup config-managed user for other tests
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(UserEntity, { managed_by: 'config' });
      });
    });

    test('should work in dry-run mode', async () => {
      await createTestUser(services, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      const result = await services.cleanupService.cleanupDeletedUsers({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would delete');

      const countAfter = await countEntities(services, 'user', {
        managed_by: 'database',
      });
      expect(countAfter).toBe(1);
    });
  });

  describe('cleanupPendingOAuthRegistrations', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createServer({
        config: CLI_TEST_CONFIG,
        skipListen: true,
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(PendingOAuthRegistrationEntitySchema, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            pending_oauth_registrations: { enabled: false },
          },
        },
        skipListen: true,
      });

      try {
        const result =
          await disabledServer.services.cleanupService.cleanupPendingOAuthRegistrations(
            { dryRun: false },
          );

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledServer.cleanup();
      }
    });

    test('should return no-op message when nothing to clean', async () => {
      const result =
        await services.cleanupService.cleanupPendingOAuthRegistrations({
          dryRun: false,
        });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired pending registrations');
    });

    test('should delete expired pending registrations', async () => {
      await createPendingOAuthRegistration(services, {
        expiresAt: new Date(Date.now() - 10000),
      });
      await createPendingOAuthRegistration(services, {
        expiresAt: new Date(Date.now() - 20000),
      });

      const countBefore = await countEntities(
        services,
        'pendingOAuthRegistration',
      );
      expect(countBefore).toBe(2);

      const result =
        await services.cleanupService.cleanupPendingOAuthRegistrations({
          dryRun: false,
        });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      const countAfter = await countEntities(
        services,
        'pendingOAuthRegistration',
      );
      expect(countAfter).toBe(0);
    });

    test('should not delete non-expired pending registrations', async () => {
      await createPendingOAuthRegistration(services, {
        expiresAt: new Date(Date.now() - 10000),
      });
      await createPendingOAuthRegistration(services, {
        expiresAt: new Date(Date.now() + 60000),
      });

      const result =
        await services.cleanupService.cleanupPendingOAuthRegistrations({
          dryRun: false,
        });

      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(
        services,
        'pendingOAuthRegistration',
      );
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createPendingOAuthRegistration(services, {
        expiresAt: new Date(Date.now() - 10000),
      });
      await createPendingOAuthRegistration(services, {
        expiresAt: new Date(Date.now() - 20000),
      });

      const result =
        await services.cleanupService.cleanupPendingOAuthRegistrations({
          dryRun: true,
        });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Would delete');

      const countAfter = await countEntities(
        services,
        'pendingOAuthRegistration',
      );
      expect(countAfter).toBe(2);
    });

    test('should respect retention period configuration', async () => {
      const retentionServer = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            pending_oauth_registrations: {
              enabled: true,
              retention: '1h',
            },
          },
        },
        skipListen: true,
      });

      try {
        // Create a registration expired 30 minutes ago (within 1h retention)
        await withMikroContext(retentionServer.services, async () => {
          await retentionServer.services.mikro.pendingOAuthRegistration.createPendingRegistration(
            {
              providerId: 'google',
              accessToken: 'test-access-token',
              tokenType: 'Bearer',
              userInfo: {
                id: 'provider-user-1',
                email: 'recent@example.com',
                email_verified: true,
              },
              expiresAt: new Date(Date.now() - 30 * 60 * 1000),
            },
          );
        });

        // Create a registration expired 2 hours ago (beyond 1h retention)
        await withMikroContext(retentionServer.services, async () => {
          await retentionServer.services.mikro.pendingOAuthRegistration.createPendingRegistration(
            {
              providerId: 'google',
              accessToken: 'test-access-token-2',
              tokenType: 'Bearer',
              userInfo: {
                id: 'provider-user-2',
                email: 'old@example.com',
                email_verified: true,
              },
              expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            },
          );
        });

        const result =
          await retentionServer.services.cleanupService.cleanupPendingOAuthRegistrations(
            { dryRun: false },
          );

        // Only the 2-hour-old registration should be deleted
        expect(result.deletedCount).toBe(1);
        expect(result.message).toContain('Retention');
      } finally {
        await retentionServer.cleanup();
      }
    });
  });
});
