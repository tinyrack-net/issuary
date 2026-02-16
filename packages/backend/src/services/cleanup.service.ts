import { EmailVerificationEntitySchema } from '@backend/entities/email-verification.entity.js';
import {
  JwtKeyEntity,
  JwtKeyStatus,
} from '@backend/entities/jwt-key.entity.js';
import { OAuthCodeEntitySchema } from '@backend/entities/oauth-code.entity.js';
import { PasswordResetEntitySchema } from '@backend/entities/password-reset.entity.js';
import { RevokedTokenEntitySchema } from '@backend/entities/revoked-token.entity.js';
import { UserEntity } from '@backend/entities/user.entity.js';
import { UserConsentEntity } from '@backend/entities/user-consent.entity.js';
import { UserOAuthEntitySchema } from '@backend/entities/user-oauth.entity.js';
import { UserPasskeyEntitySchema } from '@backend/entities/user-passkey.entity.js';
import { UserTermsConsentEntity } from '@backend/entities/user-terms-consent.entity.js';
import { UserTotpEntitySchema } from '@backend/entities/user-totp.entity.js';
import { UserTotpRecoveryCodeEntitySchema } from '@backend/entities/user-totp-recovery-code.entity.js';
import type { ResolvedAppConfig } from '@backend/lib/config/index.js';
import {
  calculateCutoffDate,
  formatDuration,
  parseDurationToMs,
} from '@backend/lib/duration.js';
import type { JwtKeyRepository } from '@backend/repositories/jwt-key.repository.js';
import type { MikroService } from '@backend/services/mikro.service.js';
import type { JwtService } from './jwt.service.js';

/**
 * Result of a cleanup operation.
 */
export interface CleanupResult {
  /** Number of items deleted (or would be deleted in dry-run mode) */
  deletedCount: number;
  /** If true, the cleanup was skipped (e.g., disabled in config) */
  skipped: boolean;
  /** Optional message with additional details */
  message?: string;
}

/**
 * Options for cleanup operations.
 */
export interface CleanupOptions {
  /** If true, don't actually delete anything, just report what would be deleted */
  dryRun: boolean;
}

/**
 * Cleanup task definition
 */
interface CleanupTask {
  /** Unique task identifier (kebab-case) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Execute the cleanup task */
  run: () => Promise<CleanupResult>;
}

/**
 * Result of a single task execution
 */
export interface TaskExecutionResult {
  name: string;
  description: string;
  result: CleanupResult;
  durationMs: number;
  error?: Error;
}

/**
 * Summary of all cleanup tasks execution
 */
export interface CleanupSummary {
  tasks: TaskExecutionResult[];
  totalDeleted: number;
  totalSkipped: number;
  totalFailed: number;
  totalDurationMs: number;
}

/**
 * Cleanup Service
 *
 * Centralizes all cleanup/maintenance tasks for the application.
 * Handles cleanup of:
 * - Revoked tokens (expired JWT revocations)
 * - OAuth authorization codes (expired/consumed)
 * - Email verification tokens (expired)
 * - Password reset tokens (expired)
 * - Deleted users (past retention period)
 * - JWT signing keys (rotation)
 *
 * Can be invoked via:
 * - CLI command: `tinyauth cleanup`
 * - In-process scheduler (cron-based)
 */
export class CleanupService {
  constructor(
    private readonly config: ResolvedAppConfig,
    private readonly mikro: MikroService,
    private readonly jwtService: JwtService,
  ) {}

  // ---------------------------------------------------------------------------
  // Revoked Tokens Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Remove expired revoked tokens from the database.
   *
   * Revoked tokens can be safely deleted after their original expiration time
   * since they would be invalid anyway due to JWT expiration.
   * The retention period allows keeping expired tokens for a while longer
   * for debugging purposes. Default is "0" (immediate cleanup after expiry).
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  async cleanupRevokedTokens(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.revoked_tokens;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const em = this.mikro.orm.em.fork();
    const revokedTokenRepo = em.getRepository(RevokedTokenEntitySchema);

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Find tokens that expired before the cutoff date
    const expiredTokens = await revokedTokenRepo.find({
      expires_at: { $lt: cutoffDate },
    });

    const count = expiredTokens.length;

    if (count === 0) {
      return { deletedCount: 0, skipped: false, message: 'No expired tokens' };
    }

    if (options.dryRun) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Would delete ${count} tokens (retention: ${formatDuration(retentionMs)})`,
      };
    }

    // Delete the tokens using nativeDelete for reliable removal
    const tokenIds = expiredTokens.map((token) => token.id);
    await em.nativeDelete(RevokedTokenEntitySchema, { id: { $in: tokenIds } });

    if (retentionMs > 0) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Retention: ${formatDuration(retentionMs)}`,
      };
    }

    return {
      deletedCount: count,
      skipped: false,
    };
  }

  // ---------------------------------------------------------------------------
  // OAuth Codes Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Remove expired and consumed OAuth authorization codes.
   *
   * Authorization codes have a short lifetime (typically 10 minutes)
   * and should be cleaned up regularly to prevent database bloat.
   * Also cleans up consumed codes after the configured retention period.
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  async cleanupOAuthCodes(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.oauth_codes;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const em = this.mikro.orm.em.fork();
    const oauthCodeRepo = em.getRepository(OAuthCodeEntitySchema);

    const now = new Date();
    const consumedRetentionMs = parseDurationToMs(config.consumed_retention);
    const consumedCutoffDate = calculateCutoffDate(config.consumed_retention);

    // Find expired authorization codes
    const expiredCodes = await oauthCodeRepo.find({
      expiredAt: { $lt: now },
    });

    // Find consumed codes older than retention period
    const consumedCodes = await oauthCodeRepo.find({
      consumedAt: { $ne: null, $lt: consumedCutoffDate },
    });

    const expiredCount = expiredCodes.length;
    const consumedCount = consumedCodes.length;
    const totalCount = expiredCount + consumedCount;

    if (totalCount === 0) {
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No expired or consumed codes',
      };
    }

    if (options.dryRun) {
      return {
        deletedCount: totalCount,
        skipped: false,
        message: `Would delete ${expiredCount} expired, ${consumedCount} consumed (retention: ${formatDuration(consumedRetentionMs)})`,
      };
    }

    // Delete the codes using nativeDelete for reliable removal
    const expiredIds = expiredCodes.map((code) => code.id);
    const consumedIds = consumedCodes.map((code) => code.id);
    const allIds = [...new Set([...expiredIds, ...consumedIds])];
    if (allIds.length > 0) {
      await em.nativeDelete(OAuthCodeEntitySchema, { id: { $in: allIds } });
    }

    return {
      deletedCount: totalCount,
      skipped: false,
      message: `${expiredCount} expired, ${consumedCount} consumed`,
    };
  }

  // ---------------------------------------------------------------------------
  // Email Verifications Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Remove expired email verification tokens.
   *
   * Expired tokens are no longer valid and can be safely deleted.
   * The retention period allows keeping expired tokens for a while longer
   * for debugging purposes. Default is "0" (immediate cleanup after expiry).
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  async cleanupEmailVerifications(
    options: CleanupOptions,
  ): Promise<CleanupResult> {
    const config = this.config.cleanup.email_verifications;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const em = this.mikro.orm.em.fork();
    const emailVerificationRepo = em.getRepository(
      EmailVerificationEntitySchema,
    );

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Count expired tokens before the cutoff date
    const count = await emailVerificationRepo.count({
      expiresAt: { $lt: cutoffDate },
      verified: false,
    });

    if (count === 0) {
      return { deletedCount: 0, skipped: false, message: 'No expired tokens' };
    }

    if (options.dryRun) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Would delete ${count} tokens (retention: ${formatDuration(retentionMs)})`,
      };
    }

    // Use native delete for efficiency
    const deletedCount = await emailVerificationRepo.nativeDelete({
      expiresAt: { $lt: cutoffDate },
      verified: false,
    });

    if (retentionMs > 0) {
      return {
        deletedCount,
        skipped: false,
        message: `Retention: ${formatDuration(retentionMs)}`,
      };
    }

    return {
      deletedCount,
      skipped: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Password Resets Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Remove expired password reset tokens.
   *
   * Expired tokens are no longer valid and can be safely deleted.
   * The retention period allows keeping expired tokens for a while longer
   * for debugging purposes. Default is "0" (immediate cleanup after expiry).
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  async cleanupPasswordResets(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.password_resets;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    const em = this.mikro.orm.em.fork();
    const passwordResetRepo = em.getRepository(PasswordResetEntitySchema);

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Count expired tokens before the cutoff date
    const count = await passwordResetRepo.count({
      expiresAt: { $lt: cutoffDate },
      used: false,
    });

    if (count === 0) {
      return { deletedCount: 0, skipped: false, message: 'No expired tokens' };
    }

    if (options.dryRun) {
      return {
        deletedCount: count,
        skipped: false,
        message: `Would delete ${count} tokens (retention: ${formatDuration(retentionMs)})`,
      };
    }

    // Use native delete for efficiency
    const deletedCount = await passwordResetRepo.nativeDelete({
      expiresAt: { $lt: cutoffDate },
      used: false,
    });

    if (retentionMs > 0) {
      return {
        deletedCount,
        skipped: false,
        message: `Retention: ${formatDuration(retentionMs)}`,
      };
    }

    return {
      deletedCount,
      skipped: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Deleted Users Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Permanently delete users marked for deletion whose retention period
   * has expired.
   *
   * This is a destructive operation that:
   * 1. Deletes all user-related data (OAuth accounts, TOTP, passkeys, consents)
   * 2. Removes the user record permanently
   *
   * The retention period is configured in cleanup.deleted_users.retention
   * (e.g., "30d", "90d").
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with deleted count and details
   */
  async cleanupDeletedUsers(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.deleted_users;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    // Check if account deletion feature is enabled
    if (!this.config.app.account_deletion) {
      return {
        deletedCount: 0,
        skipped: true,
        message: 'Account deletion feature is disabled',
      };
    }

    const em = this.mikro.orm.em.fork();
    const userRepo = em.getRepository(UserEntity);

    const retentionMs = parseDurationToMs(config.retention);
    const cutoffDate = calculateCutoffDate(config.retention);

    // Find users marked for deletion whose retention period has expired
    const usersToDelete = await userRepo.find({
      deleted_at: { $ne: null, $lt: cutoffDate },
      managed_by: 'database', // Only delete database-managed users
    });

    if (usersToDelete.length === 0) {
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No users ready for permanent deletion',
      };
    }

    if (options.dryRun) {
      return {
        deletedCount: usersToDelete.length,
        skipped: false,
        message: `Would delete ${usersToDelete.length} users (retention: ${formatDuration(retentionMs)})`,
      };
    }

    let deletedCount = 0;
    const userIds = usersToDelete.map((user) => user.id);

    for (const userId of userIds) {
      try {
        // Delete related entities first (cascading delete)
        // Use nativeDelete for reliable removal in MikroORM v7
        await em.nativeDelete(UserOAuthEntitySchema, { user: userId });
        await em.nativeDelete(UserTotpRecoveryCodeEntitySchema, {
          user: userId,
        });
        await em.nativeDelete(UserTotpEntitySchema, { user: userId });
        await em.nativeDelete(UserPasskeyEntitySchema, { user: userId });
        await em.nativeDelete(UserConsentEntity, { user: userId });
        await em.nativeDelete(UserTermsConsentEntity, {
          user: userId,
        });
        await em.nativeDelete(EmailVerificationEntitySchema, {
          user: userId,
        });
        await em.nativeDelete(PasswordResetEntitySchema, { user: userId });

        // Finally delete the user
        await em.nativeDelete(UserEntity, { id: userId });
        deletedCount++;
      } catch {
        // Log error but continue with other users
        // Note: In production, consider adding a logger parameter
      }
    }

    return {
      deletedCount,
      skipped: false,
      message: `Retention: ${formatDuration(retentionMs)}`,
    };
  }

  // ---------------------------------------------------------------------------
  // JWT Keys Rotation
  // ---------------------------------------------------------------------------

  /**
   * Rotate expired JWT signing keys and retire old keys.
   *
   * This method checks for expired active keys and performs rotation if needed.
   * Also retires old keys that have passed the overlap period.
   *
   * Key lifecycle:
   * 1. next: Generated, waiting to be activated
   * 2. active: Currently used for signing tokens
   * 3. previous: Recently rotated, still valid for verification
   * 4. retired: No longer valid for any operation
   *
   * @param options - Cleanup options (dryRun)
   * @returns Cleanup result with rotation details
   */
  async rotateExpiredJwtKeys(options: CleanupOptions): Promise<CleanupResult> {
    const config = this.config.cleanup.jwt_keys;

    if (!config.enabled) {
      return { deletedCount: 0, skipped: true, message: 'Disabled in config' };
    }

    // Check if JWT key rotation is enabled in app config
    const rotationEnabled = this.config.app.jwt_key_rotation_enabled ?? true;

    if (!rotationEnabled) {
      return {
        deletedCount: 0,
        skipped: true,
        message: 'JWT key rotation is disabled in app config',
      };
    }

    // Fork EntityManager for isolation
    const em = this.mikro.orm.em.fork();
    const jwtKeyRepo = em.getRepository(JwtKeyEntity) as JwtKeyRepository;

    // Check for expired active keys
    const now = new Date();
    const expiredKeys = await jwtKeyRepo.find({
      status: JwtKeyStatus.ACTIVE,
      expires_at: { $lt: now },
    });

    if (options.dryRun) {
      if (expiredKeys.length > 0) {
        return {
          deletedCount: expiredKeys.length,
          skipped: false,
          message: `Would rotate ${expiredKeys.length} expired key(s)`,
        };
      }
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No rotation needed',
      };
    }

    if (expiredKeys.length === 0) {
      return {
        deletedCount: 0,
        skipped: false,
        message: 'No rotation needed',
      };
    }

    // Perform rotation
    // 1. Deactivate expired active keys -> previous
    for (const key of expiredKeys) {
      key.status = JwtKeyStatus.PREVIOUS;
      key.deactivated_at = new Date();
    }

    // 2. Check for next key to promote, or create new one
    let nextKey = await jwtKeyRepo.findOne(
      { status: JwtKeyStatus.NEXT },
      { populate: ['private_key'] },
    );

    if (!nextKey) {
      // Generate new key
      const keyPair = await this.jwtService.generateKeyPair();
      const rotationDays = this.config.app.jwt_key_rotation_days ?? 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + rotationDays);

      nextKey = em.create(JwtKeyEntity, {
        kid: keyPair.kid,
        private_key: keyPair.privateKey,
        public_key: keyPair.publicKey,
        algorithm: keyPair.algorithm,
        status: JwtKeyStatus.NEXT,
        expires_at: expiresAt,
      });
    }

    // 3. Activate the next key
    nextKey.status = JwtKeyStatus.ACTIVE;
    nextKey.activated_at = new Date();

    // 4. Retire old previous keys past overlap period
    const overlapDays = this.config.app.jwt_key_overlap_days ?? 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overlapDays);

    const keysToRetire = await jwtKeyRepo.find({
      status: JwtKeyStatus.PREVIOUS,
      deactivated_at: { $lt: cutoffDate },
    });

    for (const key of keysToRetire) {
      key.status = JwtKeyStatus.RETIRED;
      key.retired_at = new Date();
    }

    await em.flush();

    // Clear JWT service cache after rotation
    this.jwtService.clearActiveKeyCache();

    return {
      deletedCount: 1,
      skipped: false,
      message: `Key rotation performed${keysToRetire.length > 0 ? `, ${keysToRetire.length} key(s) retired` : ''}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Run All Cleanup Tasks
  // ---------------------------------------------------------------------------

  /**
   * Build cleanup tasks
   */
  private buildCleanupTasks(dryRun: boolean): CleanupTask[] {
    return [
      {
        name: 'revoked-tokens',
        description: 'Remove expired revoked tokens',
        run: () => this.cleanupRevokedTokens({ dryRun }),
      },
      {
        name: 'oauth-codes',
        description: 'Remove expired and consumed OAuth authorization codes',
        run: () => this.cleanupOAuthCodes({ dryRun }),
      },
      {
        name: 'email-verifications',
        description: 'Remove expired email verification tokens',
        run: () => this.cleanupEmailVerifications({ dryRun }),
      },
      {
        name: 'password-resets',
        description: 'Remove expired password reset tokens',
        run: () => this.cleanupPasswordResets({ dryRun }),
      },
      {
        name: 'deleted-users',
        description: 'Permanently delete users after retention period',
        run: () => this.cleanupDeletedUsers({ dryRun }),
      },
      {
        name: 'jwt-keys',
        description: 'Rotate expired JWT signing keys',
        run: () => this.rotateExpiredJwtKeys({ dryRun }),
      },
    ];
  }

  /**
   * Run all cleanup tasks.
   *
   * @param options - Cleanup options (dryRun, verbose)
   * @returns Summary of all task executions
   */
  async runAll(options: {
    dryRun: boolean;
    verbose?: boolean;
  }): Promise<CleanupSummary> {
    const results: TaskExecutionResult[] = [];
    const startTime = Date.now();

    const tasks = this.buildCleanupTasks(options.dryRun);

    for (const task of tasks) {
      const taskStart = Date.now();

      try {
        const result = await task.run();

        results.push({
          name: task.name,
          description: task.description,
          result,
          durationMs: Date.now() - taskStart,
        });
      } catch (error) {
        results.push({
          name: task.name,
          description: task.description,
          result: {
            deletedCount: 0,
            skipped: false,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          durationMs: Date.now() - taskStart,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    const totalDeleted = results.reduce((sum, r) => {
      if (!r.error && !r.result.skipped) {
        return sum + r.result.deletedCount;
      }
      return sum;
    }, 0);

    const totalSkipped = results.filter((r) => r.result.skipped).length;
    const totalFailed = results.filter((r) => r.error).length;

    return {
      tasks: results,
      totalDeleted,
      totalSkipped,
      totalFailed,
      totalDurationMs: Date.now() - startTime,
    };
  }
}
