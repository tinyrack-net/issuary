import z from 'zod/v4';

/**
 * Duration string pattern: e.g., "30d", "90d", "1y", "6m"
 * - d: days
 * - m: months
 * - y: years
 */
const DurationString = z
  .string()
  .regex(/^\d+[dmy]$/, 'Duration must be in format like "30d", "6m", or "1y"')
  .describe('Duration string (e.g., "30d", "6m", "1y")');

export const AppConfigAccountDeletion = z
  .object({
    enabled: z
      .boolean()
      .default(false)
      .describe('Whether account deletion is enabled'),
    retention_period: DurationString.default('30d').describe(
      'How long to retain user data after deletion request before permanent deletion',
    ),
  })
  .describe('Account deletion settings');

export type AppConfigAccountDeletion = z.infer<typeof AppConfigAccountDeletion>;

/**
 * Parse duration string to milliseconds
 * @param duration - Duration string like "30d", "6m", "1y"
 * @returns Duration in milliseconds
 */
export function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([dmy])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = Number.parseInt(match[1] as string, 10);
  const unit = match[2] as string;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  switch (unit) {
    case 'd':
      return value * MS_PER_DAY;
    case 'm':
      return value * 30 * MS_PER_DAY; // Approximate month as 30 days
    case 'y':
      return value * 365 * MS_PER_DAY; // Approximate year as 365 days
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Calculate the permanent deletion date based on deleted_at and retention period
 * @param deletedAt - The date when deletion was requested
 * @param retentionPeriod - Retention period string like "30d"
 * @returns Date when permanent deletion should occur
 */
export function calculatePermanentDeletionDate(
  deletedAt: Date,
  retentionPeriod: string,
): Date {
  const retentionMs = parseDurationToMs(retentionPeriod);
  return new Date(deletedAt.getTime() + retentionMs);
}
