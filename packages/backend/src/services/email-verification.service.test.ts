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
import { createServer } from '@/server.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createEmailVerification,
  createTestUser,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';

describe('EmailVerificationService', () => {
  describe('cleanupExpired', () => {
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
      // Clean up email verifications before each test
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
          await disabledApp.emailVerificationService?.cleanupExpired({
            dryRun: false,
          });

        expect(result?.skipped).toBe(true);
        expect(result?.deletedCount).toBe(0);
        expect(result?.message).toBe('Disabled in config');
      } finally {
        await disabledApp.close();
      }
    });

    test('should return "No expired tokens" when nothing to clean', async () => {
      const result = await app.emailVerificationService?.cleanupExpired({
        dryRun: false,
      });

      expect(result?.skipped).toBe(false);
      expect(result?.deletedCount).toBe(0);
      expect(result?.message).toBe('No expired tokens');
    });

    test('should delete expired unverified tokens', async () => {
      // Create expired, unverified tokens
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

      const result = await app.emailVerificationService?.cleanupExpired({
        dryRun: false,
      });

      expect(result?.skipped).toBe(false);
      expect(result?.deletedCount).toBe(2);

      const countAfter = await countEntities(app, 'emailVerification');
      expect(countAfter).toBe(0);
    });

    test('should not delete verified email verification records', async () => {
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

      const result = await app.emailVerificationService?.cleanupExpired({
        dryRun: false,
      });

      // Only the unverified token should be deleted
      expect(result?.deletedCount).toBe(1);

      const countAfter = await countEntities(app, 'emailVerification');
      expect(countAfter).toBe(1);
    });

    test('should not delete non-expired tokens', async () => {
      // Create non-expired unverified token
      await createEmailVerification(app, {
        userId,
        expiresAt: new Date(Date.now() + 60000), // Valid
        verified: false,
      });

      const result = await app.emailVerificationService?.cleanupExpired({
        dryRun: false,
      });

      expect(result?.deletedCount).toBe(0);

      const countAfter = await countEntities(app, 'emailVerification');
      expect(countAfter).toBe(1);
    });

    test('should respect retention configuration', async () => {
      // Create app with 1 hour retention
      const retentionApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            email_verifications: { enabled: true, retention: '1h' },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const testUserId = await createTestUser(retentionApp);

        // Create token expired 30 minutes ago (within retention)
        await createEmailVerification(retentionApp, {
          userId: testUserId,
          expiresAt: new Date(Date.now() - 30 * 60 * 1000),
          verified: false,
        });

        // Create token expired 2 hours ago (past retention)
        await createEmailVerification(retentionApp, {
          userId: testUserId,
          expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          verified: false,
        });

        const result =
          await retentionApp.emailVerificationService?.cleanupExpired({
            dryRun: false,
          });

        // Only the 2-hour old token should be deleted
        expect(result?.deletedCount).toBe(1);
        expect(result?.message).toContain('1 hour');
      } finally {
        await retentionApp.close();
      }
    });

    test('should work in dry-run mode', async () => {
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

      const result = await app.emailVerificationService?.cleanupExpired({
        dryRun: true,
      });

      expect(result?.deletedCount).toBe(2);
      expect(result?.message).toContain('Would delete');

      // Tokens should NOT be deleted
      const countAfter = await countEntities(app, 'emailVerification');
      expect(countAfter).toBe(2);
    });
  });
});
