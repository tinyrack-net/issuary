import z from 'zod';
import { DurationString } from '#backend/lib/duration.js';

/**
 * Configuration for revoked tokens cleanup
 */
const CleanupRevokedTokensConfigSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable revoked tokens cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired revoked tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Revoked tokens cleanup settings');

/**
 * Configuration for OAuth authorization codes cleanup
 */
const CleanupOAuthCodesConfigSchema = z
  .object({
    enabled: z.boolean().default(true).describe('Enable OAuth codes cleanup'),
    consumed_retention: DurationString.default('24h').describe(
      'How long to keep consumed authorization codes for debugging/audit.',
    ),
  })
  .describe('OAuth authorization codes cleanup settings');

/**
 * Configuration for email verification tokens cleanup
 */
const CleanupEmailVerificationsConfigSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable email verification tokens cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired email verification tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Email verification tokens cleanup settings');

/**
 * Configuration for password reset tokens cleanup
 */
const CleanupPasswordResetsConfigSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable password reset tokens cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired password reset tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Password reset tokens cleanup settings');

/**
 * Configuration for deleted users cleanup (permanent deletion)
 */
const CleanupDeletedUsersConfigSchema = z
  .object({
    enabled: z.boolean().default(true).describe('Enable deleted users cleanup'),
    retention: DurationString.default('30d').describe(
      'How long to retain soft-deleted users before permanent deletion.',
    ),
  })
  .describe('Deleted users cleanup settings');

/**
 * Configuration for pending OAuth registrations cleanup
 */
const CleanupPendingOAuthRegistrationsConfigSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe('Enable pending OAuth registrations cleanup'),
    retention: DurationString.default('0').describe(
      'How long to keep expired pending OAuth registrations. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Pending OAuth registrations cleanup settings');

/**
 * Configuration for JWT key rotation
 */
const CleanupJwtKeysConfigSchema = z
  .object({
    enabled: z.boolean().default(true).describe('Enable JWT key rotation'),
  })
  .describe('JWT key rotation settings');

/**
 * Default cleanup configuration
 */
export const DEFAULT_CLEANUP_CONFIG = {
  revoked_tokens: {
    enabled: true,
    retention: '0',
  },
  oauth_codes: {
    enabled: true,
    consumed_retention: '24h',
  },
  email_verifications: {
    enabled: true,
    retention: '0',
  },
  password_resets: {
    enabled: true,
    retention: '0',
  },
  deleted_users: {
    enabled: true,
    retention: '30d',
  },
  pending_oauth_registrations: {
    enabled: true,
    retention: '0',
  },
  jwt_keys: {
    enabled: true,
  },
} as const;

/**
 * Cleanup configuration
 *
 * Controls the cleanup behavior for various entities.
 * Run `tinyauth cleanup` to execute all enabled cleanup tasks.
 *
 * For Kubernetes deployments, create a CronJob that runs:
 * `tinyauth cleanup` on a regular schedule (e.g., daily at 2 AM).
 */
export const CleanupConfigSchema = z
  .object({
    revoked_tokens: CleanupRevokedTokensConfigSchema.default(
      DEFAULT_CLEANUP_CONFIG.revoked_tokens,
    ),
    oauth_codes: CleanupOAuthCodesConfigSchema.default(
      DEFAULT_CLEANUP_CONFIG.oauth_codes,
    ),
    email_verifications: CleanupEmailVerificationsConfigSchema.default(
      DEFAULT_CLEANUP_CONFIG.email_verifications,
    ),
    password_resets: CleanupPasswordResetsConfigSchema.default(
      DEFAULT_CLEANUP_CONFIG.password_resets,
    ),
    deleted_users: CleanupDeletedUsersConfigSchema.default(
      DEFAULT_CLEANUP_CONFIG.deleted_users,
    ),
    pending_oauth_registrations:
      CleanupPendingOAuthRegistrationsConfigSchema.default(
        DEFAULT_CLEANUP_CONFIG.pending_oauth_registrations,
      ),
    jwt_keys: CleanupJwtKeysConfigSchema.default(
      DEFAULT_CLEANUP_CONFIG.jwt_keys,
    ),
  })
  .default(DEFAULT_CLEANUP_CONFIG)
  .describe('Cleanup configuration for maintenance tasks');

export type CleanupConfig = z.infer<typeof CleanupConfigSchema>;
