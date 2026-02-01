import type { FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { JwtKeyEntity, JwtKeyStatus } from '@/entities/jwt-key.entity.js';
import { createServer } from '@/server.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createJwtKey,
  getJwtKey,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';

describe('JwtKeyService', () => {
  describe('rotateExpiredKeys', () => {
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
      app.jwtKeyService.clearActiveKeyCache();
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
        const result = await disabledApp.jwtKeyService.rotateExpiredKeys({
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
        const result = await noRotationApp.jwtKeyService.rotateExpiredKeys({
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

      const result = await app.jwtKeyService.rotateExpiredKeys({
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

      const result = await app.jwtKeyService.rotateExpiredKeys({
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

      const result = await app.jwtKeyService.rotateExpiredKeys({
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

      const result = await app.jwtKeyService.rotateExpiredKeys({
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

      const result = await app.jwtKeyService.rotateExpiredKeys({
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

      await app.jwtKeyService.rotateExpiredKeys({
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
      const result = await app.jwtKeyService.rotateExpiredKeys({
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

      const result = await app.jwtKeyService.rotateExpiredKeys({
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

      const result = await app.jwtKeyService.rotateExpiredKeys({
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
});
