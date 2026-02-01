import type { FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import { createServer } from '@/server.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createPasswordReset,
  createTestUser,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';

describe('PasswordResetService', () => {
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
      // Clean up password resets before each test
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
        const result = await disabledApp.passwordResetService.cleanupExpired({
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
      const result = await app.passwordResetService.cleanupExpired({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('No expired tokens');
    });

    test('should delete expired unused tokens', async () => {
      // Create expired, unused tokens
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

      const result = await app.passwordResetService.cleanupExpired({
        dryRun: false,
      });

      expect(result.skipped).toBe(false);
      expect(result.deletedCount).toBe(2);

      const countAfter = await countEntities(app, 'passwordReset');
      expect(countAfter).toBe(0);
    });

    test('should not delete used password reset records', async () => {
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

      const result = await app.passwordResetService.cleanupExpired({
        dryRun: false,
      });

      // Only the unused token should be deleted
      expect(result.deletedCount).toBe(1);

      const countAfter = await countEntities(app, 'passwordReset');
      expect(countAfter).toBe(1);
    });

    test('should not delete non-expired tokens', async () => {
      // Create non-expired unused token
      await createPasswordReset(app, {
        userId,
        expiresAt: new Date(Date.now() + 60000), // Valid
        used: false,
      });

      const result = await app.passwordResetService.cleanupExpired({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(0);

      const countAfter = await countEntities(app, 'passwordReset');
      expect(countAfter).toBe(1);
    });

    test('should respect retention configuration', async () => {
      // Create app with 1 hour retention
      const retentionApp = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          cleanup: {
            password_resets: { enabled: true, retention: '1h' },
          },
        },
        cliMode: true,
        skipListen: true,
      });

      try {
        const testUserId = await createTestUser(retentionApp);

        // Create token expired 30 minutes ago (within retention)
        await createPasswordReset(retentionApp, {
          userId: testUserId,
          expiresAt: new Date(Date.now() - 30 * 60 * 1000),
          used: false,
        });

        // Create token expired 2 hours ago (past retention)
        await createPasswordReset(retentionApp, {
          userId: testUserId,
          expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          used: false,
        });

        const result = await retentionApp.passwordResetService.cleanupExpired({
          dryRun: false,
        });

        // Only the 2-hour old token should be deleted
        expect(result.deletedCount).toBe(1);
        expect(result.message).toContain('1 hour');
      } finally {
        await retentionApp.close();
      }
    });

    test('should work in dry-run mode', async () => {
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

      const result = await app.passwordResetService.cleanupExpired({
        dryRun: true,
      });

      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain('Would delete');

      // Tokens should NOT be deleted
      const countAfter = await countEntities(app, 'passwordReset');
      expect(countAfter).toBe(2);
    });
  });
});
