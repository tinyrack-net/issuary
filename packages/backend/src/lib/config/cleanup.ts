import z from 'zod';
import { DurationString } from '#backend/lib/duration.js';
import { zz } from '#backend/schemas/provider.js';

const CLEANUP_REVOKED_TOKENS_CONFIG_DEFAULT = {
  enabled: true,
  retention: '0',
};

/**
 * Configuration for revoked tokens cleanup
 */
const CleanupRevokedTokensConfigSchema = z
  .object({
    enabled: z
      .union([z.boolean(), z.string()])
      .pipe(zz.COERCE_BOOLEAN)
      .default(CLEANUP_REVOKED_TOKENS_CONFIG_DEFAULT.enabled)
      .describe('Enable revoked tokens cleanup'),
    retention: DurationString.default(
      CLEANUP_REVOKED_TOKENS_CONFIG_DEFAULT.retention,
    ).describe(
      'How long to keep expired revoked tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Revoked tokens cleanup settings');

const CLEANUP_OAUTH_CODES_CONFIG_DEFAULT = {
  enabled: true,
  consumed_retention: '24h',
};

/**
 * Configuration for OAuth authorization codes cleanup
 */
const CleanupOAuthCodesConfigSchema = z
  .object({
    enabled: z
      .union([z.boolean(), z.string()])
      .pipe(zz.COERCE_BOOLEAN)
      .default(CLEANUP_OAUTH_CODES_CONFIG_DEFAULT.enabled)
      .describe('Enable OAuth codes cleanup'),
    consumed_retention: DurationString.default(
      CLEANUP_OAUTH_CODES_CONFIG_DEFAULT.consumed_retention,
    ).describe(
      'How long to keep consumed authorization codes for debugging/audit.',
    ),
  })
  .describe('OAuth authorization codes cleanup settings');

const CLEANUP_EMAIL_VERIFICATIONS_CONFIG_DEFAULT = {
  enabled: true,
  retention: '0',
};

/**
 * Configuration for email verification tokens cleanup
 */
const CleanupEmailVerificationsConfigSchema = z
  .object({
    enabled: z
      .union([z.boolean(), z.string()])
      .pipe(zz.COERCE_BOOLEAN)
      .default(CLEANUP_EMAIL_VERIFICATIONS_CONFIG_DEFAULT.enabled)
      .describe('Enable email verification tokens cleanup'),
    retention: DurationString.default(
      CLEANUP_EMAIL_VERIFICATIONS_CONFIG_DEFAULT.retention,
    ).describe(
      'How long to keep expired email verification tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Email verification tokens cleanup settings');

const CLEANUP_PASSWORD_RESETS_CONFIG_DEFAULT = {
  enabled: true,
  retention: '0',
};

/**
 * Configuration for password reset tokens cleanup
 */
const CleanupPasswordResetsConfigSchema = z
  .object({
    enabled: z
      .union([z.boolean(), z.string()])
      .pipe(zz.COERCE_BOOLEAN)
      .default(CLEANUP_PASSWORD_RESETS_CONFIG_DEFAULT.enabled)
      .describe('Enable password reset tokens cleanup'),
    retention: DurationString.default(
      CLEANUP_PASSWORD_RESETS_CONFIG_DEFAULT.retention,
    ).describe(
      'How long to keep expired password reset tokens. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Password reset tokens cleanup settings');

const CLEANUP_PENDING_OAUTH_REGISTRATIONS_CONFIG_DEFAULT = {
  enabled: true,
  retention: '0',
};

/**
 * Configuration for pending OAuth registrations cleanup
 */
const CleanupPendingOAuthRegistrationsConfigSchema = z
  .object({
    enabled: z
      .union([z.boolean(), z.string()])
      .pipe(zz.COERCE_BOOLEAN)
      .default(CLEANUP_PENDING_OAUTH_REGISTRATIONS_CONFIG_DEFAULT.enabled)
      .describe('Enable pending OAuth registrations cleanup'),
    retention: DurationString.default(
      CLEANUP_PENDING_OAUTH_REGISTRATIONS_CONFIG_DEFAULT.retention,
    ).describe(
      'How long to keep expired pending OAuth registrations. "0" means delete immediately after expiry.',
    ),
  })
  .describe('Pending OAuth registrations cleanup settings');

/**
 * Default cleanup configuration
 */
export const CLEANUP_CONFIG_DEFAULT = {
  revoked_tokens: CLEANUP_REVOKED_TOKENS_CONFIG_DEFAULT,
  oauth_codes: CLEANUP_OAUTH_CODES_CONFIG_DEFAULT,
  email_verifications: CLEANUP_EMAIL_VERIFICATIONS_CONFIG_DEFAULT,
  password_resets: CLEANUP_PASSWORD_RESETS_CONFIG_DEFAULT,
  pending_oauth_registrations:
    CLEANUP_PENDING_OAUTH_REGISTRATIONS_CONFIG_DEFAULT,
};

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
      CLEANUP_CONFIG_DEFAULT.revoked_tokens,
    ),
    oauth_codes: CleanupOAuthCodesConfigSchema.default(
      CLEANUP_CONFIG_DEFAULT.oauth_codes,
    ),
    email_verifications: CleanupEmailVerificationsConfigSchema.default(
      CLEANUP_CONFIG_DEFAULT.email_verifications,
    ),
    password_resets: CleanupPasswordResetsConfigSchema.default(
      CLEANUP_CONFIG_DEFAULT.password_resets,
    ),
    pending_oauth_registrations:
      CleanupPendingOAuthRegistrationsConfigSchema.default(
        CLEANUP_CONFIG_DEFAULT.pending_oauth_registrations,
      ),
  })
  .strict()
  .default(CLEANUP_CONFIG_DEFAULT)
  .describe('Cleanup configuration for maintenance tasks');

export type CleanupConfig = z.infer<typeof CleanupConfigSchema>;
