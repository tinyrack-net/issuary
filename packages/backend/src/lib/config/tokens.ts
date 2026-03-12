import z from 'zod';
import { zz } from '#backend/schemas/provider.js';

export const TOKEN_ROTATION_CONFIG_DEFAULT = {
  enabled: true,
  interval_days: 30,
  overlap_days: 7,
} as const;

export const TOKENS_CONFIG_DEFAULT = {
  access_token_ttl: 3600,
  refresh_token_ttl: 2592000,
  key_rotation: TOKEN_ROTATION_CONFIG_DEFAULT,
} as const;

export const TokenKeyRotationConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(
      TOKEN_ROTATION_CONFIG_DEFAULT.enabled,
    ).describe('Whether automatic signing key rotation is enabled.'),
    interval_days: zz
      .coerceInt()
      .pipe(z.number().int().min(1))
      .default(TOKEN_ROTATION_CONFIG_DEFAULT.interval_days)
      .describe('Number of days between signing key rotations.'),
    overlap_days: zz
      .coerceInt()
      .pipe(z.number().int().min(1))
      .default(TOKEN_ROTATION_CONFIG_DEFAULT.overlap_days)
      .describe(
        'Number of days the old key remains valid after rotation for graceful transition.',
      ),
  })
  .strict()
  .default(TOKEN_ROTATION_CONFIG_DEFAULT)
  .describe('Signing key rotation configuration.');

export type TokenKeyRotationConfig = z.infer<
  typeof TokenKeyRotationConfigSchema
>;

export const TokensConfigSchema = z
  .object({
    access_token_ttl: zz
      .coerceInt()
      .pipe(z.number().int().min(60))
      .default(TOKENS_CONFIG_DEFAULT.access_token_ttl)
      .describe('Access token time-to-live in seconds.'),
    refresh_token_ttl: zz
      .coerceInt()
      .pipe(z.number().int().min(3600))
      .default(TOKENS_CONFIG_DEFAULT.refresh_token_ttl)
      .describe('Refresh token time-to-live in seconds.'),
    key_rotation: TokenKeyRotationConfigSchema,
  })
  .strict()
  .default(TOKENS_CONFIG_DEFAULT)
  .describe('Token issuance and signing key configuration.');

export type TokensConfig = z.infer<typeof TokensConfigSchema>;
