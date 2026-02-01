import z from 'zod/v4';

/**
 * Account deletion configuration
 *
 * Controls whether users can request account deletion.
 * The retention period for deleted users is configured in the cleanup section.
 */
export const AppConfigAccountDeletion = z
  .object({
    enabled: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether account deletion is enabled'),
  })
  .describe('Account deletion settings');

export type AppConfigAccountDeletion = z.infer<typeof AppConfigAccountDeletion>;
