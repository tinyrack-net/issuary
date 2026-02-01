import type { FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { RevokedTokenEntity } from '@/entities/revoked-token.entity.js';
import { createServer } from '@/server.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createRevokedToken,
  createTestOAuthClient,
  createTestUser,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';

describe('JwtService', () => {
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
        const result = await disabledApp.jwtService.cleanupRevokedTokens({
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
      const result = await app.jwtService.cleanupRevokedTokens({
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

      const result = await app.jwtService.cleanupRevokedTokens({
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

      const result = await app.jwtService.cleanupRevokedTokens({
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

      const result = await app.jwtService.cleanupRevokedTokens({
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

        const result = await retentionApp.jwtService.cleanupRevokedTokens({
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

      const result = await app.jwtService.cleanupRevokedTokens({
        dryRun: false,
      });

      expect(result.deletedCount).toBe(2);
    });
  });
});
