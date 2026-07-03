import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { initializeServices } from '@tinyrack/tinyauth-server/services';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, resolveConfig } from '../src/lib/load-config.ts';
import { createLogger } from '../src/lib/logger.ts';
import {
  createTestConfigFile,
  removeDirectoryWithRetry,
} from './helpers/config-factory.ts';
import { runCli } from './helpers/spawn-cli.ts';

interface CleanupDbCounts {
  emailVerifications: number;
  passwordResets: number;
  pendingOAuthRegistrations: number;
}

interface CleanupDbFixture {
  configPath: string;
  cwd: string;
  cleanup: () => Promise<void>;
}

async function cleanupServicesAndRestoreCwd(
  previousCwd: string,
  servicesCleanup: (() => Promise<void>) | undefined,
): Promise<void> {
  try {
    await servicesCleanup?.();
  } finally {
    process.chdir(previousCwd);
  }
}

async function withServices<T>(
  configPath: string,
  cwd: string,
  action: (connection: {
    execute: <R>(query: string, params?: unknown[]) => Promise<R>;
  }) => Promise<T>,
): Promise<T> {
  const logger = createLogger({
    logging: {
      level: 'error',
      format: 'json',
    },
  });
  const previousCwd = process.cwd();
  let servicesCleanup: (() => Promise<void>) | undefined;
  process.chdir(cwd);

  try {
    const { services, cleanup } = await initializeServices(
      await resolveConfig(loadConfig(configPath)),
      logger,
    );
    servicesCleanup = cleanup;
    return await action(services.mikro.orm.em.getConnection());
  } finally {
    await cleanupServicesAndRestoreCwd(previousCwd, servicesCleanup);
  }
}

async function createCleanupDbFixture(): Promise<CleanupDbFixture> {
  const dbDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'tinyauth-cleanup-db-'),
  );
  const { configPath, cleanup } = await createTestConfigFile({
    database: {
      type: 'sqlite',
      path: path.join(dbDir, 'cleanup.sqlite'),
      test: false,
    },
    cleanup: {
      revoked_tokens: {
        enabled: false,
      },
      oauth_codes: {
        enabled: false,
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
        enabled: false,
      },
    },
  });

  return {
    configPath,
    cwd: dbDir,
    cleanup: async () => {
      await cleanup();
      await removeDirectoryWithRetry(dbDir);
    },
  };
}

async function seedCleanupRecords(
  configPath: string,
  cwd: string,
): Promise<void> {
  await withServices(configPath, cwd, async (connection) => {
    const now = new Date();
    const expiredAt = new Date(now.getTime() - 60_000);
    const futureAt = new Date(now.getTime() + 60_000);

    await connection.execute(
      `insert into user (sub, created_at, updated_at, email, email_verified, managed_by, role)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['cleanup-user', now, now, 'cleanup@example.com', 1, 'database', 'user'],
    );

    await connection.execute(
      `insert into email_verification (id, created_at, updated_at, user_sub, token, expires_at, verified)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        'expired-email-verification',
        now,
        now,
        'cleanup-user',
        'expired-email-token',
        expiredAt,
        0,
      ],
    );
    await connection.execute(
      `insert into email_verification (id, created_at, updated_at, user_sub, token, expires_at, verified)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        'active-email-verification',
        now,
        now,
        'cleanup-user',
        'active-email-token',
        futureAt,
        0,
      ],
    );

    await connection.execute(
      `insert into password_reset (id, created_at, updated_at, user_sub, token, expires_at, used)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        'expired-password-reset',
        now,
        now,
        'cleanup-user',
        'expired-password-token',
        expiredAt,
        0,
      ],
    );
    await connection.execute(
      `insert into password_reset (id, created_at, updated_at, user_sub, token, expires_at, used)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        'active-password-reset',
        now,
        now,
        'cleanup-user',
        'active-password-token',
        futureAt,
        0,
      ],
    );

    await connection.execute(
      `insert into pending_oauth_registration
       (id, created_at, updated_at, token, provider_id, access_token, refresh_token, expires_in, token_type, user_info, return_url, expires_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'expired-pending-oauth-registration',
        now,
        now,
        'expired-pending-oauth-token',
        'github',
        'access-token',
        null,
        3600,
        'Bearer',
        JSON.stringify({
          id: 'github-expired-user',
          email: 'github-expired@example.com',
          email_verified: true,
        }),
        '/profile',
        expiredAt,
      ],
    );
    await connection.execute(
      `insert into pending_oauth_registration
       (id, created_at, updated_at, token, provider_id, access_token, refresh_token, expires_in, token_type, user_info, return_url, expires_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'active-pending-oauth-registration',
        now,
        now,
        'active-pending-oauth-token',
        'github',
        'access-token',
        null,
        3600,
        'Bearer',
        JSON.stringify({
          id: 'github-active-user',
          email: 'github-active@example.com',
          email_verified: true,
        }),
        '/profile',
        futureAt,
      ],
    );
  });
}

async function countRows(
  configPath: string,
  cwd: string,
): Promise<CleanupDbCounts> {
  return await withServices(configPath, cwd, async (connection) => {
    const emailVerificationRows = await connection.execute<
      { count: number | string }[]
    >('select count(*) as count from email_verification');
    const passwordResetRows = await connection.execute<
      { count: number | string }[]
    >('select count(*) as count from password_reset');
    const pendingOAuthRegistrationRows = await connection.execute<
      { count: number | string }[]
    >('select count(*) as count from pending_oauth_registration');

    return {
      emailVerifications: Number(emailVerificationRows[0]?.count ?? 0),
      passwordResets: Number(passwordResetRows[0]?.count ?? 0),
      pendingOAuthRegistrations: Number(
        pendingOAuthRegistrationRows[0]?.count ?? 0,
      ),
    };
  });
}

async function findToken(
  configPath: string,
  cwd: string,
  table: 'email_verification' | 'password_reset' | 'pending_oauth_registration',
  token: string,
): Promise<string | undefined> {
  return await withServices(configPath, cwd, async (connection) => {
    const rows = await connection.execute<{ token: string }[]>(
      `select token from ${table} where token = ?`,
      [token],
    );
    return rows[0]?.token;
  });
}

describe('cleanup e2e', { timeout: 90_000 }, () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup();
    }
  });

  it('deletes expired cleanup records while preserving non-expired records', async () => {
    const { configPath, cwd, cleanup } = await createCleanupDbFixture();
    cleanups.push(cleanup);
    await seedCleanupRecords(configPath, cwd);

    await expect(countRows(configPath, cwd)).resolves.toEqual({
      emailVerifications: 2,
      passwordResets: 2,
      pendingOAuthRegistrations: 2,
    });

    const result = await runCli({
      args: ['cleanup', '-c', configPath],
      cwd,
    });

    expect(result.exitCode, result.stdout + result.stderr).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain('Summary: 3 items cleaned');

    await expect(countRows(configPath, cwd)).resolves.toEqual({
      emailVerifications: 1,
      passwordResets: 1,
      pendingOAuthRegistrations: 1,
    });
    await expect(
      findToken(configPath, cwd, 'email_verification', 'expired-email-token'),
    ).resolves.toBeUndefined();
    await expect(
      findToken(configPath, cwd, 'email_verification', 'active-email-token'),
    ).resolves.toBe('active-email-token');
    await expect(
      findToken(configPath, cwd, 'password_reset', 'expired-password-token'),
    ).resolves.toBeUndefined();
    await expect(
      findToken(configPath, cwd, 'password_reset', 'active-password-token'),
    ).resolves.toBe('active-password-token');
    await expect(
      findToken(
        configPath,
        cwd,
        'pending_oauth_registration',
        'expired-pending-oauth-token',
      ),
    ).resolves.toBeUndefined();
    await expect(
      findToken(
        configPath,
        cwd,
        'pending_oauth_registration',
        'active-pending-oauth-token',
      ),
    ).resolves.toBe('active-pending-oauth-token');
  });

  it('dry run reports matches without deleting database records', async () => {
    const { configPath, cwd, cleanup } = await createCleanupDbFixture();
    cleanups.push(cleanup);
    await seedCleanupRecords(configPath, cwd);

    const result = await runCli({
      args: ['cleanup', '-c', configPath, '--dry-run'],
      cwd,
    });

    expect(result.exitCode, result.stdout + result.stderr).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain('[DRY RUN]');
    expect(output).toContain('Summary: 3 items would be cleaned');
    await expect(countRows(configPath, cwd)).resolves.toEqual({
      emailVerifications: 2,
      passwordResets: 2,
      pendingOAuthRegistrations: 2,
    });
  });

  it('verbose mode includes per-task details and summary', async () => {
    const { configPath, cwd, cleanup } = await createCleanupDbFixture();
    cleanups.push(cleanup);
    await seedCleanupRecords(configPath, cwd);

    const result = await runCli({
      args: ['cleanup', '-c', configPath, '--verbose'],
      cwd,
    });

    expect(result.exitCode, result.stdout + result.stderr).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain('Remove expired email verification tokens');
    expect(output).toContain('Remove expired password reset tokens');
    expect(output).toContain('Remove expired pending OAuth registrations');
    expect(output).toContain('Summary: 3 items cleaned');
    expect(output).toContain('Duration:');
  });

  it('missing --config-path exits with non-zero code', async () => {
    const result = await runCli({
      args: ['cleanup'],
    });

    expect(result.exitCode).not.toBe(0);
  });

  it('restores cwd when service initialization fails after chdir', async () => {
    const cwd = await fs.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-cleanup-cwd-'),
    );
    cleanups.push(async () => {
      await removeDirectoryWithRetry(cwd);
    });
    const previousCwd = process.cwd();
    const missingConfigPath = path.join(cwd, 'missing-config.yaml');

    await expect(countRows(missingConfigPath, cwd)).rejects.toBeInstanceOf(
      Error,
    );

    expect(process.cwd()).toBe(previousCwd);
  });

  it('restores cwd when service cleanup rejects after chdir', async () => {
    const cwd = await fs.mkdtemp(
      path.join(os.tmpdir(), 'tinyauth-cleanup-reject-cwd-'),
    );
    cleanups.push(async () => {
      await removeDirectoryWithRetry(cwd);
    });
    const previousCwd = process.cwd();
    const cleanupError = new Error('cleanup failed');
    process.chdir(cwd);

    await expect(
      cleanupServicesAndRestoreCwd(previousCwd, async () => {
        throw cleanupError;
      }),
    ).rejects.toBe(cleanupError);

    expect(process.cwd()).toBe(previousCwd);
  });
});
