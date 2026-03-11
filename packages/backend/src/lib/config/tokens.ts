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
    enabled: zz.COERCE_BOOLEAN.default(TOKEN_ROTATION_CONFIG_DEFAULT.enabled),
    interval_days: zz
      .coerceInt()
      .pipe(z.number().int().min(1))
      .default(TOKEN_ROTATION_CONFIG_DEFAULT.interval_days),
    overlap_days: zz
      .coerceInt()
      .pipe(z.number().int().min(1))
      .default(TOKEN_ROTATION_CONFIG_DEFAULT.overlap_days),
  })
  .strict()
  .default(TOKEN_ROTATION_CONFIG_DEFAULT);

export type TokenKeyRotationConfig = z.infer<
  typeof TokenKeyRotationConfigSchema
>;

export const TokensConfigSchema = z
  .object({
    access_token_ttl: zz
      .coerceInt()
      .pipe(z.number().int().min(60))
      .default(TOKENS_CONFIG_DEFAULT.access_token_ttl),
    refresh_token_ttl: zz
      .coerceInt()
      .pipe(z.number().int().min(3600))
      .default(TOKENS_CONFIG_DEFAULT.refresh_token_ttl),
    key_rotation: TokenKeyRotationConfigSchema,
  })
  .strict()
  .default(TOKENS_CONFIG_DEFAULT);

export type TokensConfig = z.infer<typeof TokensConfigSchema>;
