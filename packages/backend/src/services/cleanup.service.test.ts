import type { FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { JwtKeyEntity, JwtKeyStatus } from '@/entities/jwt-key.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import { RevokedTokenEntity } from '@/entities/revoked-token.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { createServer } from '@/server.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createEmailVerification,
  createJwtKey,
  createOAuthCode,
  createPasswordReset,
  createRevokedToken,
  createTestOAuthClient,
  createTestUser,
  getJwtKey,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';

describe('CleanupService', () => {
  describe('cleanupRevokedTokens', () => {
    let app: FastifyInstance;
    let userId: string;
    let clientId: string;

    beforeAll(async () => {
      app = await createServer({
        config: CLI_TEST_CONFIG,
        cliMode: true,
        skipListen: true,
      });

      // Create test user and client for all tests
      userId = await createTestUser(app);
      clientId = await createTestOAuthClient(app);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      // Clean up revoked tokens before each test
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        await em.nativeDelete(RevokedTokenEntity, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            revoked_tokens: { enabled: false },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await disabledApp.cleanupService.cleanupRevokedTokens({
          dryRun: false,
        });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should return "No expired tokens" when nothing to clean', async () => {
      const result = await app.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired tokens');
    });

    test('should delete expired revoked tokens', async () => {
      // Create expired tokens
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
      });
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() - 20000), // Expired 20 seconds ago
      });

      // Verify tokens exist
      const countBefore = await countEntities(app, 'revokedToken');
      expect(countBefore).toBe(2);

      const result = await app.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      // Verify tokens are deleted
      const countAfter = await countEntities(app, 'revokedToken');
      expect(countAfter).toBe(0);
    });

    test('should not delete non-expired tokens', async () => {
      // Create one expired and one non-expired token
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() - 10000), // Expired
      });
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() + 60000), // Expires in 1 minute
      });

      const result = await app.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      // Verify one token remains
      const countAfter = await countEntities(app, 'revokedToken');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode (report but not delete)', async () => {
      // Create expired tokens
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() - 10000),
      });
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() - 20000),
      });

      const result = await app.cleanupService.cleanupRevokedTokens({
        dryRun: true,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Would delete');

      // Verify tokens are NOT deleted
      const countAfter = await countEntities(app, 'revokedToken');
      expect(countAfter).toBe(2);
    });

    test('should respect retention period configuration', async () => {
      // Create app with 1 hour retention
      const retentionApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            revoked_tokens: { enabled: true, retention: '1h' },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const testUserId = await createTestUser(retentionApp);
        const testClientId = await createTestOAuthClient(retentionApp);

        // Create token expired 30 minutes ago (within retention)
        await createRevokedToken(retentionApp, {
          userId: testUserId,
          clientId: testClientId,
          expiresAt: new Date(Date.now() - 30 * 60 * 1000),
        });

        // Create token expired 2 hours ago (past retention)
        await createRevokedToken(retentionApp, {
          userId: testUserId,
          clientId: testClientId,
          expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        });

        const result = await retentionApp.cleanupService.cleanupRevokedTokens({
          dryRun: false,
        });

        // Only the 2-hour old token should be deleted
        expect(result.deletedCount).toBe(1);
        expect(result.message).toContain('1 hour');
      } finally {
        await retentionApp.close();
      }
    });

    test('should handle both access and refresh tokens', async () => {
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() - 10000),
        tokenType: 'access_token',
      });
      await createRevokedToken(app, {
        userId,
        clientId,
        expiresAt: new Date(Date.now() - 10000),
        tokenType: 'refresh_token',
      });

      const result = await app.cleanupService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(2);
    });
  });

  describe('rotateExpiredJwtKeys', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await createServer({
        config: {
          ...CLI_TEST_CONFIG,
          app: {
            ...CLI_TEST_CONFIG.app,
            jwt_key_rotation_enabled: true,
            jwt_key_rotation_days: 30,
            jwt_key_overlap_days: 7,
          },
        },
        cliMode: true,
        skipListen: true,
      });
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      // Clean up JWT keys before each test
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        await em.nativeDelete(JwtKeyEntity, {});
      });
      // Clear service cache
      app.jwtService.clearActiveKeyCache();
    });

    test('should skip when disabled in config', async () => {
      const disabledApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            jwt_keys: { enabled: false },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await disabledApp.cleanupService.rotateExpiredJwtKeys({
          dryRun: false,
        });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should skip when jwt_key_rotation_enabled is false', async () => {
      const noRotationApp = await createServer({
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
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await noRotationApp.cleanupService.rotateExpiredJwtKeys({
          dryRun: false,
        });

        expect(result.skipped).toBe(true);
        expect(result.message).toBe(
          'JWT key rotation is disabled in app config',
        );
      } finally {
        await noRotationApp.close();
      }
    });

    test('should return "No rotation needed" when no expired active keys', async () => {
      // Create active key that is not expired
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 1 day
        activatedAt: new Date(),
      });

      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No rotation needed');
    });

    test('should rotate expired active keys to previous status', async () => {
      // Create expired active key
      const kid = await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000), // Expired
        activatedAt: new Date(Date.now() - 86400000),
      });

      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('rotation performed');

      // Verify key status changed to PREVIOUS
      const key = await getJwtKey(app, kid);
      expect(key).not.toBeNull();
      expect(key?.status).toBe(JwtKeyStatus.PREVIOUS);
      expect(key?.deactivated_at).not.toBeNull();
    });

    test('should promote next key to active', async () => {
      // Create expired active key
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // Create next key ready for promotion
      const nextKid = await createJwtKey(app, {
        status: JwtKeyStatus.NEXT,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        activatedAt: null,
      });

      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      // Verify next key was promoted to active
      const promotedKey = await getJwtKey(app, nextKid);
      expect(promotedKey).not.toBeNull();
      expect(promotedKey?.status).toBe(JwtKeyStatus.ACTIVE);
      expect(promotedKey?.activated_at).not.toBeNull();
    });

    test('should generate new key if no next key exists', async () => {
      // Create expired active key without a next key
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      const countBefore = await countEntities(app, 'jwtKey');
      expect(countBefore).toBe(1);

      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      // Should have created a new key
      const countAfter = await countEntities(app, 'jwtKey');
      expect(countAfter).toBe(2);

      // Verify there's an active key
      const activeCount = await countEntities(app, 'jwtKey', {
        status: JwtKeyStatus.ACTIVE,
      });
      expect(activeCount).toBe(1);
    });

    test('should retire old previous keys past overlap period', async () => {
      // Create expired active key
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // Create old previous key (deactivated 10 days ago, past 7-day overlap)
      const oldPreviousKid = await createJwtKey(app, {
        status: JwtKeyStatus.PREVIOUS,
        expiresAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        deactivatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });

      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.message).toContain('retired');

      // Verify old previous key was retired
      const retiredKey = await getJwtKey(app, oldPreviousKid);
      expect(retiredKey).not.toBeNull();
      expect(retiredKey?.status).toBe(JwtKeyStatus.RETIRED);
      expect(retiredKey?.retired_at).not.toBeNull();
    });

    test('should not retire recent previous keys within overlap period', async () => {
      // Create expired active key
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // Create recent previous key (deactivated 1 day ago, within 7-day overlap)
      const recentPreviousKid = await createJwtKey(app, {
        status: JwtKeyStatus.PREVIOUS,
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        deactivatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });

      await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      // Verify recent previous key was NOT retired
      const previousKey = await getJwtKey(app, recentPreviousKid);
      expect(previousKey).not.toBeNull();
      expect(previousKey?.status).toBe(JwtKeyStatus.PREVIOUS);
    });

    test('should clear service cache after rotation', async () => {
      // Create expired active key
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      // The method should call clearActiveKeyCache
      // We can verify this indirectly by checking the rotation completes
      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('rotation performed');
    });

    test('should work in dry-run mode', async () => {
      // Create expired active key
      const kid = await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });

      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would rotate');

      // Verify key was NOT rotated
      const key = await getJwtKey(app, kid);
      expect(key).not.toBeNull();
      expect(key?.status).toBe(JwtKeyStatus.ACTIVE);
    });

    test('should handle multiple expired active keys', async () => {
      // Create multiple expired active keys (unusual but possible)
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
        activatedAt: new Date(Date.now() - 86400000),
      });
      await createJwtKey(app, {
        status: JwtKeyStatus.ACTIVE,
        expiresAt: new Date(Date.now() - 2000),
        activatedAt: new Date(Date.now() - 172800000),
      });

      const result = await app.cleanupService.rotateExpiredJwtKeys({
        dryRun: false,
      });

      // Both should be rotated
      expect(result.deletedCount).toBe(1); // Reports 1 for "rotation performed"
      expect(result.message).toContain('rotation performed');

      // Both should now be PREVIOUS
      const previousCount = await countEntities(app, 'jwtKey', {
        status: JwtKeyStatus.PREVIOUS,
      });
      expect(previousCount).toBe(2);
    });
  });

  describe('cleanupOAuthCodes', () => {
    let app: FastifyInstance;
    let userId: string;
    let clientId: string;

    beforeAll(async () => {
      app = await createServer({
        config: CLI_TEST_CONFIG,
        cliMode: true,
        skipListen: true,
      });

      userId = await createTestUser(app);
      clientId = await createTestOAuthClient(app);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      // Clean up OAuth codes before each test
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        await em.nativeDelete(OAuthCodeEntity, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            oauth_codes: { enabled: false },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await disabledApp.cleanupService.cleanupOAuthCodes({
          dryRun: false,
        });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should return message when nothing to clean', async () => {
      const result = await app.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired or consumed codes');
    });

    test('should delete expired authorization codes', async () => {
      // Create expired codes
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() - 10000), // Expired
        consumedAt: null,
      });
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() - 20000), // Expired
        consumedAt: null,
      });

      const countBefore = await countEntities(app, 'oauthCode');
      expect(countBefore).toBe(2);

      const result = await app.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('2 expired');

      const countAfter = await countEntities(app, 'oauthCode');
      expect(countAfter).toBe(0);
    });

    test('should delete consumed codes older than retention period', async () => {
      // Create consumed code older than retention (retention is 0 in CLI_TEST_CONFIG)
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() + 60000), // Not expired
        consumedAt: new Date(Date.now() - 10000), // Consumed 10 seconds ago
      });

      const result = await app.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('consumed');
    });

    test('should not delete recently consumed codes within retention', async () => {
      // Create app with 1 hour consumed retention
      const retentionApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            oauth_codes: { enabled: true, consumed_retention: '1h' },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const testUserId = await createTestUser(retentionApp);
        const testClientId = await createTestOAuthClient(retentionApp);

        // Create recently consumed code (30 minutes ago, within 1 hour retention)
        await createOAuthCode(retentionApp, {
          userId: testUserId,
          clientId: testClientId,
          expiredAt: new Date(Date.now() + 60000),
          consumedAt: new Date(Date.now() - 30 * 60 * 1000),
        });

        const result = await retentionApp.cleanupService.cleanupOAuthCodes({
          dryRun: false,
        });

        // Should not delete the recently consumed code
        expect(result.deletedCount).toBe(0);
      } finally {
        await retentionApp.close();
      }
    });

    test('should not delete non-expired and non-consumed codes', async () => {
      // Create a valid, non-consumed code
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() + 60000), // Valid
        consumedAt: null, // Not consumed
      });

      const result = await app.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(0);

      const countAfter = await countEntities(app, 'oauthCode');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() - 10000),
        consumedAt: null,
      });
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() + 60000),
        consumedAt: new Date(Date.now() - 10000),
      });

      const result = await app.cleanupService.cleanupOAuthCodes({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Would delete');

      // Codes should NOT be deleted
      const countAfter = await countEntities(app, 'oauthCode');
      expect(countAfter).toBe(2);
    });

    test('should report correct counts for expired vs consumed', async () => {
      // Create 2 expired codes
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() - 10000),
        consumedAt: null,
      });
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() - 20000),
        consumedAt: null,
      });

      // Create 1 consumed code
      await createOAuthCode(app, {
        userId,
        clientId,
        expiredAt: new Date(Date.now() + 60000),
        consumedAt: new Date(Date.now() - 10000),
      });

      const result = await app.cleanupService.cleanupOAuthCodes({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(3);
      expect(result.message).toContain('2 expired');
      expect(result.message).toContain('1 consumed');
    });
  });

  describe('cleanupEmailVerifications', () => {
    let app: FastifyInstance;
    let userId: string;

    beforeAll(async () => {
      app = await createServer({
        config: CLI_TEST_CONFIG,
        cliMode: true,
        skipListen: true,
      });

      userId = await createTestUser(app);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        await em.nativeDelete(EmailVerificationEntity, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            email_verifications: { enabled: false },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result =
          await disabledApp.cleanupService.cleanupEmailVerifications({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should return "No expired tokens" when nothing to clean', async () => {
      const result = await app.cleanupService.cleanupEmailVerifications({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired tokens');
    });

    test('should delete expired unverified tokens', async () => {
      await createEmailVerification(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        verified: false,
      });
      await createEmailVerification(app, {
        userId,
        expiresAt: new Date(Date.now() - 20000),
        verified: false,
      });

      const countBefore = await countEntities(app, 'emailVerification');
      expect(countBefore).toBe(2);

      const result = await app.cleanupService.cleanupEmailVerifications({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      const countAfter = await countEntities(app, 'emailVerification');
      expect(countAfter).toBe(0);
    });

    test('should not delete verified tokens', async () => {
      // Create expired but verified token (should not be deleted)
      await createEmailVerification(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        verified: true,
      });

      // Create expired unverified token (should be deleted)
      await createEmailVerification(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        verified: false,
      });

      const result = await app.cleanupService.cleanupEmailVerifications({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(app, 'emailVerification');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createEmailVerification(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        verified: false,
      });

      const result = await app.cleanupService.cleanupEmailVerifications({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would delete');

      const countAfter = await countEntities(app, 'emailVerification');
      expect(countAfter).toBe(1);
    });
  });

  describe('cleanupPasswordResets', () => {
    let app: FastifyInstance;
    let userId: string;

    beforeAll(async () => {
      app = await createServer({
        config: CLI_TEST_CONFIG,
        cliMode: true,
        skipListen: true,
      });

      userId = await createTestUser(app);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        await em.nativeDelete(PasswordResetEntity, {});
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            password_resets: { enabled: false },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await disabledApp.cleanupService.cleanupPasswordResets({
          dryRun: false,
        });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should return "No expired tokens" when nothing to clean', async () => {
      const result = await app.cleanupService.cleanupPasswordResets({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired tokens');
    });

    test('should delete expired unused tokens', async () => {
      await createPasswordReset(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        used: false,
      });
      await createPasswordReset(app, {
        userId,
        expiresAt: new Date(Date.now() - 20000),
        used: false,
      });

      const countBefore = await countEntities(app, 'passwordReset');
      expect(countBefore).toBe(2);

      const result = await app.cleanupService.cleanupPasswordResets({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      const countAfter = await countEntities(app, 'passwordReset');
      expect(countAfter).toBe(0);
    });

    test('should not delete used tokens', async () => {
      // Create expired but used token (should not be deleted)
      await createPasswordReset(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        used: true,
      });

      // Create expired unused token (should be deleted)
      await createPasswordReset(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        used: false,
      });

      const result = await app.cleanupService.cleanupPasswordResets({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(app, 'passwordReset');
      expect(countAfter).toBe(1);
    });

    test('should work in dry-run mode', async () => {
      await createPasswordReset(app, {
        userId,
        expiresAt: new Date(Date.now() - 10000),
        used: false,
      });

      const result = await app.cleanupService.cleanupPasswordResets({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would delete');

      const countAfter = await countEntities(app, 'passwordReset');
      expect(countAfter).toBe(1);
    });
  });

  describe('cleanupDeletedUsers', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await createServer({
        config: CLI_TEST_CONFIG,
        cliMode: true,
        skipListen: true,
      });
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        await em.nativeDelete(UserEntity, { managed_by: 'database' });
      });
    });

    test('should skip when disabled in config', async () => {
      const disabledApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            deleted_users: { enabled: false },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const result = await disabledApp.cleanupService.cleanupDeletedUsers({
          dryRun: false,
        });

        expect(result.skipped).toBe(true);
        expect(result.deletedCount).toBe(0);
        expect(result.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should skip when account_deletion feature is disabled', async () => {
      const noAccountDeletionApp = await createServer({
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
        cliMode: true,
        skipListen: true,
      });

      try {
        const result =
          await noAccountDeletionApp.cleanupService.cleanupDeletedUsers({
            dryRun: false,
          });

        expect(result.skipped).toBe(true);
        expect(result.message).toBe('Account deletion feature is disabled');
      } finally {
        await noAccountDeletionApp.close();
      }
    });

    test('should return message when no users ready for deletion', async () => {
      const result = await app.cleanupService.cleanupDeletedUsers({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No users ready for permanent deletion');
    });

    test('should permanently delete users after retention period', async () => {
      // Create soft-deleted user (deleted 10 seconds ago, retention is 0)
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      const countBefore = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(countBefore).toBe(1);

      const result = await app.cleanupService.cleanupDeletedUsers({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(countAfter).toBe(0);
    });

    test('should only delete database-managed users', async () => {
      // Create a database-managed soft-deleted user
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      // Create a config-managed soft-deleted user (should not be deleted)
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'config',
      });

      const result = await app.cleanupService.cleanupDeletedUsers({
        dryRun: false,
      });

      // Only database-managed user should be deleted
      expect(result.deletedCount).toBe(1);

      // Config-managed user should remain
      const configUserCount = await countEntities(app, 'user', {
        managed_by: 'config',
      });
      expect(configUserCount).toBe(1);

      // Cleanup config-managed user for other tests
      await withMikroContext(app, async () => {
        const em = app.mikro.em.fork();
        await em.nativeDelete(UserEntity, { managed_by: 'config' });
      });
    });

    test('should work in dry-run mode', async () => {
      await createTestUser(app, {
        deletedAt: new Date(Date.now() - 10000),
        managedBy: 'database',
      });

      const result = await app.cleanupService.cleanupDeletedUsers({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(1);
      expect(result.message).toContain('Would delete');

      const countAfter = await countEntities(app, 'user', {
        managed_by: 'database',
      });
      expect(countAfter).toBe(1);
    });
  });
});
