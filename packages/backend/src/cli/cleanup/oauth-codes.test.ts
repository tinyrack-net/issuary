import type { FastifyInstance } from 'fastify';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { createServer } from '@/server.js';
import {
  CLI_TEST_CONFIG,
  countEntities,
  createOAuthCode,
  createTestOAuthClient,
  createTestUser,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';
import { oauthCodesTask } from './oauth-codes.js';

describe('oauthCodesTask', () => {
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
      const result = await oauthCodesTask.run({
        fastify: disabledApp,
        dryRun: false,
        verbose: false,
      });

      expect(result.skipped).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toBe('Disabled in config');
    } finally {
      await disabledApp.close();
    }
  });

  test('should return message when nothing to clean', async () => {
    const result = await oauthCodesTask.run({
      fastify: app,
      dryRun: false,
      verbose: false,
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

    const result = await oauthCodesTask.run({
      fastify: app,
      dryRun: false,
      verbose: false,
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

    const result = await oauthCodesTask.run({
      fastify: app,
      dryRun: false,
      verbose: false,
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

      const result = await oauthCodesTask.run({
        fastify: retentionApp,
        dryRun: false,
        verbose: false,
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

    const result = await oauthCodesTask.run({
      fastify: app,
      dryRun: false,
      verbose: false,
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

    const result = await oauthCodesTask.run({
      fastify: app,
      dryRun: true,
      verbose: false,
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

    const result = await oauthCodesTask.run({
      fastify: app,
      dryRun: false,
      verbose: false,
    });

    expect(result.deletedCount).toBe(3);
    expect(result.message).toContain('2 expired');
    expect(result.message).toContain('1 consumed');
  });
});
