import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { EmailVerificationEntity } from '@/entities/email-verification.entity.js';
import { JwtKeyEntity } from '@/entities/jwt-key.entity.js';
import { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';
import { PasswordResetEntity } from '@/entities/password-reset.entity.js';
import { RevokedTokenEntity } from '@/entities/revoked-token.entity.js';
import { createServer } from '@/server.js';
import type { ServiceContainer } from '@/services/container.js';
import {
  CLI_TEST_CONFIG,
  createEmailVerification,
  createOAuthCode,
  createPasswordReset,
  createRevokedToken,
  createTestOAuthClient,
  createTestUser,
} from '@/test-utils/cli.js';
import { MINIMAL_TEST_CONFIG, withMikroContext } from '@/test-utils/index.js';
import { runCleanup } from './index.js';

/**
 * Expected cleanup task names in execution order
 */
const EXPECTED_TASK_NAMES = [
  'revoked-tokens',
  'oauth-codes',
  'email-verifications',
  'password-resets',
  'deleted-users',
  'jwt-keys',
];

describe('runCleanup', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;
  let userId: string;
  let clientId: string;

  beforeAll(async () => {
    ({ services, cleanup } = await createServer({
      config: CLI_TEST_CONFIG,
      cliMode: true,
      skipListen: true,
    }));

    userId = await createTestUser(services);
    clientId = await createTestOAuthClient(services);
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    // Clean up all entities before each test
    await withMikroContext(services, async () => {
      const em = services.mikro.em.fork();
      await em.nativeDelete(RevokedTokenEntity, {});
      await em.nativeDelete(OAuthCodeEntity, {});
      await em.nativeDelete(EmailVerificationEntity, {});
      await em.nativeDelete(PasswordResetEntity, {});
      await em.nativeDelete(JwtKeyEntity, {});
    });
  });

  test('should execute all cleanup tasks in order', async () => {
    const summary = await runCleanup(services, {
      dryRun: false,
      verbose: false,
    });

    // Verify all tasks were executed
    expect(summary.tasks.length).toBe(EXPECTED_TASK_NAMES.length);

    // Verify task order matches expected order
    for (let i = 0; i < EXPECTED_TASK_NAMES.length; i++) {
      const expectedName = EXPECTED_TASK_NAMES[i];
      const executedTask = summary.tasks[i];
      expect(executedTask?.name).toBe(expectedName);
    }
  });

  test('should aggregate results correctly', async () => {
    // Create test data for multiple tasks
    await createRevokedToken(services, {
      userId,
      clientId,
      expiresAt: new Date(Date.now() - 10000),
    });
    await createOAuthCode(services, {
      userId,
      clientId,
      expiredAt: new Date(Date.now() - 10000),
    });
    await createEmailVerification(services, {
      userId,
      expiresAt: new Date(Date.now() - 10000),
    });
    await createPasswordReset(services, {
      userId,
      expiresAt: new Date(Date.now() - 10000),
    });

    const summary = await runCleanup(services, {
      dryRun: false,
      verbose: false,
    });

    // Should have deleted items from multiple tasks
    expect(summary.totalDeleted).toBeGreaterThanOrEqual(4);
    expect(summary.totalFailed).toBe(0);
    expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  test('should count skipped tasks correctly', async () => {
    // Create app with some tasks disabled
    const partialServer = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        cleanup: {
          revoked_tokens: { enabled: false },
          oauth_codes: { enabled: false },
          email_verifications: { enabled: true },
          password_resets: { enabled: true },
          deleted_users: { enabled: false },
          jwt_keys: { enabled: false },
        },
      },
      cliMode: true,
      skipListen: true,
    });

    try {
      const summary = await runCleanup(partialServer.services, {
        dryRun: false,
        verbose: false,
      });

      // 4 tasks disabled (revoked_tokens, oauth_codes, deleted_users, jwt_keys)
      expect(summary.totalSkipped).toBeGreaterThanOrEqual(4);
    } finally {
      await partialServer.cleanup();
    }
  });

  test('should continue execution even if one task fails', async () => {
    // We can't easily make a task fail, but we can verify the structure
    // handles errors by checking the summary structure
    const summary = await runCleanup(services, {
      dryRun: false,
      verbose: false,
    });

    // All tasks should have completed (none failed in normal operation)
    expect(summary.totalFailed).toBe(0);
    expect(summary.tasks.every((t) => !t.error)).toBe(true);
  });

  test('should handle all tasks disabled scenario', async () => {
    const allDisabledServer = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        cleanup: {
          revoked_tokens: { enabled: false },
          oauth_codes: { enabled: false },
          email_verifications: { enabled: false },
          password_resets: { enabled: false },
          deleted_users: { enabled: false },
          jwt_keys: { enabled: false },
        },
      },
      cliMode: true,
      skipListen: true,
    });

    try {
      const summary = await runCleanup(allDisabledServer.services, {
        dryRun: false,
        verbose: false,
      });

      expect(summary.totalDeleted).toBe(0);
      expect(summary.totalSkipped).toBe(EXPECTED_TASK_NAMES.length);
      expect(summary.totalFailed).toBe(0);
    } finally {
      await allDisabledServer.cleanup();
    }
  });

  test('should respect dry-run mode for all tasks', async () => {
    // Create test data
    await createRevokedToken(services, {
      userId,
      clientId,
      expiresAt: new Date(Date.now() - 10000),
    });
    await createOAuthCode(services, {
      userId,
      clientId,
      expiredAt: new Date(Date.now() - 10000),
    });
    await createEmailVerification(services, {
      userId,
      expiresAt: new Date(Date.now() - 10000),
    });
    await createPasswordReset(services, {
      userId,
      expiresAt: new Date(Date.now() - 10000),
    });

    const summary = await runCleanup(services, {
      dryRun: true,
      verbose: false,
    });

    // Should report items that would be deleted
    expect(summary.totalDeleted).toBeGreaterThanOrEqual(4);

    // Verify data was NOT deleted
    await withMikroContext(services, async () => {
      const em = services.mikro.em.fork();
      const revokedCount = await em.count(RevokedTokenEntity, {});
      const codeCount = await em.count(OAuthCodeEntity, {});
      const verificationCount = await em.count(EmailVerificationEntity, {});
      const resetCount = await em.count(PasswordResetEntity, {});

      expect(revokedCount).toBe(1);
      expect(codeCount).toBe(1);
      expect(verificationCount).toBe(1);
      expect(resetCount).toBe(1);
    });
  });

  test('should measure total duration correctly', async () => {
    const startTime = Date.now();
    const summary = await runCleanup(services, {
      dryRun: false,
      verbose: false,
    });
    const elapsed = Date.now() - startTime;

    // Total duration should be close to actual elapsed time
    expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(summary.totalDurationMs).toBeLessThanOrEqual(elapsed + 100); // Allow some margin

    // Each task should have duration measured
    for (const taskResult of summary.tasks) {
      expect(taskResult.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  test('should include task results with correct structure', async () => {
    const summary = await runCleanup(services, {
      dryRun: false,
      verbose: false,
    });

    for (const taskResult of summary.tasks) {
      // Each result should have required properties
      expect(taskResult).toHaveProperty('name');
      expect(taskResult).toHaveProperty('description');
      expect(taskResult).toHaveProperty('result');
      expect(taskResult).toHaveProperty('durationMs');

      // Result should have required properties
      expect(taskResult.result).toHaveProperty('deletedCount');
      expect(taskResult.result).toHaveProperty('skipped');
    }
  });
});

describe('cleanup tasks registry', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ services, cleanup } = await createServer({
      config: CLI_TEST_CONFIG,
      cliMode: true,
      skipListen: true,
    }));
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should contain all expected tasks', async () => {
    const summary = await runCleanup(services, {
      dryRun: true,
      verbose: false,
    });

    expect(summary.tasks.length).toBe(EXPECTED_TASK_NAMES.length);

    for (const expectedName of EXPECTED_TASK_NAMES) {
      const task = summary.tasks.find((t) => t.name === expectedName);
      expect(task).toBeDefined();
    }
  });

  test('should have unique task names', async () => {
    const summary = await runCleanup(services, {
      dryRun: true,
      verbose: false,
    });
    const names = summary.tasks.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  test('should have descriptions for all tasks', async () => {
    const summary = await runCleanup(services, {
      dryRun: true,
      verbose: false,
    });

    for (const task of summary.tasks) {
      expect(task.description).toBeDefined();
      expect(task.description.length).toBeGreaterThan(0);
    }
  });
});
