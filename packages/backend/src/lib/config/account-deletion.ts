import z from 'zod';
import { DurationString } from '#backend/lib/duration.js';
import { zz } from '#backend/schemas/provider.js';

export const ACCOUNT_DELETION_CONFIG_DEFAULT = {
  enabled: false,
  retention: '30d',
} as const;

export const AccountDeletionConfigSchema = z
  .object({
    enabled: zz.COERCE_BOOLEAN.default(
      ACCOUNT_DELETION_CONFIG_DEFAULT.enabled,
    ).describe('Whether users can request account deletion.'),
    retention: DurationString.default(
      ACCOUNT_DELETION_CONFIG_DEFAULT.retention,
    ).describe(
      'Grace period before permanently deleting a user account after request.',
    ),
  })
  .strict()
  .default(ACCOUNT_DELETION_CONFIG_DEFAULT)
  .describe('Account deletion configuration.');

export type AccountDeletionConfig = z.infer<typeof AccountDeletionConfigSchema>;
