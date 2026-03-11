import z from 'zod';
import { DurationString } from '#backend/lib/duration.js';
import { zz } from '#backend/schemas/provider.js';

export const ACCOUNT_DELETION_CONFIG_DEFAULT = {
  enabled: false,
  retention: '30d',
} as const;

export const AccountDeletionConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(ACCOUNT_DELETION_CONFIG_DEFAULT.enabled),
    retention: DurationString.default(
      ACCOUNT_DELETION_CONFIG_DEFAULT.retention,
    ),
  })
  .strict()
  .default(ACCOUNT_DELETION_CONFIG_DEFAULT);

export type AccountDeletionConfig = z.infer<typeof AccountDeletionConfigSchema>;
