import z from 'zod';

/**
 * Duration string pattern supporting multiple time units:
 * - s: seconds (e.g., "30s")
 * - m: minutes (e.g., "30m")
 * - h: hours (e.g., "24h")
 * - d: days (e.g., "7d")
 * - y: years (e.g., "1y")
 *
 * Special value "0" means immediate (no retention).
 */
export const DurationString = z
  .string()
  .regex(
    /^(0|\d+[smhdy])$/,
    'Duration must be "0" or format like "30s", "30m", "24h", "7d", "1y"',
  )
  .describe('Duration string (e.g., "0", "30m", "24h", "7d", "1y")');

export type DurationString = z.infer<typeof DurationString>;

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_YEAR = 365 * MS_PER_DAY; // Approximate year as 365 days

/**
 * Parse duration string to milliseconds
 * @param duration - Duration string like "30s", "30m", "24h", "7d", "1y" or "0"
 * @returns Duration in milliseconds
 */
export function parseDurationToMs(duration: string): number {
  // Special case: "0" means immediate (no retention)
  if (duration === '0') {
    return 0;
  }

  const match = duration.match(/^(\d+)([smhdy])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = Number.parseInt(match[1] as string, 10);
  const unit = match[2] as string;

  switch (unit) {
    case 's':
      return value * MS_PER_SECOND;
    case 'm':
      return value * MS_PER_MINUTE;
    case 'h':
      return value * MS_PER_HOUR;
    case 'd':
      return value * MS_PER_DAY;
    case 'y':
      return value * MS_PER_YEAR;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Calculate a cutoff date by subtracting a duration from now
 * @param retention - Duration string for retention period
 * @returns Date before which items should be cleaned up
 */
export function calculateCutoffDate(retention: string): Date {
  const retentionMs = parseDurationToMs(retention);
  return new Date(Date.now() - retentionMs);
}

/**
 * Format milliseconds as a human-readable duration
 * @param ms - Duration in milliseconds
 * @returns Human-readable string like "24 hours", "7 days", "30 days"
 */
export function formatDuration(ms: number): string {
  if (ms === 0) {
    return 'immediate';
  }

  if (ms < MS_PER_MINUTE) {
    const seconds = Math.round(ms / MS_PER_SECOND);
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  if (ms < MS_PER_HOUR) {
    const minutes = Math.round(ms / MS_PER_MINUTE);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  if (ms < MS_PER_DAY) {
    const hours = Math.round(ms / MS_PER_HOUR);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  if (ms < MS_PER_YEAR) {
    const days = Math.round(ms / MS_PER_DAY);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  const years = Math.round(ms / MS_PER_YEAR);
  return `${years} year${years !== 1 ? 's' : ''}`;
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
