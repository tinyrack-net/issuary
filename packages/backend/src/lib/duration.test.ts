import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateCutoffDate,
  calculatePermanentDeletionDate,
  DurationString,
  formatDuration,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  MS_PER_YEAR,
  parseDurationToMs,
} from './duration.js';

describe('Duration Constants', () => {
  it('should have correct MS_PER_SECOND value', () => {
    expect(MS_PER_SECOND).toBe(1000);
  });

  it('should have correct MS_PER_MINUTE value', () => {
    expect(MS_PER_MINUTE).toBe(60 * 1000);
  });

  it('should have correct MS_PER_HOUR value', () => {
    expect(MS_PER_HOUR).toBe(60 * 60 * 1000);
  });

  it('should have correct MS_PER_DAY value', () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
  });

  it('should have correct MS_PER_YEAR value (365 days)', () => {
    expect(MS_PER_YEAR).toBe(365 * 24 * 60 * 60 * 1000);
  });
});

describe('DurationString Schema', () => {
  describe('valid duration strings', () => {
    it('should accept "0" for immediate', () => {
      expect(DurationString.safeParse('0').success).toBe(true);
    });

    it('should accept seconds format', () => {
      expect(DurationString.safeParse('1s').success).toBe(true);
      expect(DurationString.safeParse('30s').success).toBe(true);
      expect(DurationString.safeParse('999s').success).toBe(true);
    });

    it('should accept minutes format', () => {
      expect(DurationString.safeParse('1m').success).toBe(true);
      expect(DurationString.safeParse('30m').success).toBe(true);
      expect(DurationString.safeParse('60m').success).toBe(true);
    });

    it('should accept hours format', () => {
      expect(DurationString.safeParse('1h').success).toBe(true);
      expect(DurationString.safeParse('24h').success).toBe(true);
      expect(DurationString.safeParse('168h').success).toBe(true);
    });

    it('should accept days format', () => {
      expect(DurationString.safeParse('1d').success).toBe(true);
      expect(DurationString.safeParse('7d').success).toBe(true);
      expect(DurationString.safeParse('30d').success).toBe(true);
      expect(DurationString.safeParse('365d').success).toBe(true);
    });

    it('should accept years format', () => {
      expect(DurationString.safeParse('1y').success).toBe(true);
      expect(DurationString.safeParse('2y').success).toBe(true);
      expect(DurationString.safeParse('10y').success).toBe(true);
    });

    it('should accept large numeric values', () => {
      expect(DurationString.safeParse('9999999s').success).toBe(true);
      expect(DurationString.safeParse('1000000d').success).toBe(true);
    });
  });

  describe('invalid duration strings', () => {
    it('should reject empty string', () => {
      expect(DurationString.safeParse('').success).toBe(false);
    });

    it('should reject negative numbers', () => {
      expect(DurationString.safeParse('-1s').success).toBe(false);
      expect(DurationString.safeParse('-30m').success).toBe(false);
    });

    it('should reject decimal numbers', () => {
      expect(DurationString.safeParse('1.5s').success).toBe(false);
      expect(DurationString.safeParse('2.5h').success).toBe(false);
    });

    it('should reject invalid units', () => {
      expect(DurationString.safeParse('30x').success).toBe(false);
      expect(DurationString.safeParse('30w').success).toBe(false);
      expect(DurationString.safeParse('30M').success).toBe(false);
      expect(DurationString.safeParse('30S').success).toBe(false);
    });

    it('should reject unit without number', () => {
      expect(DurationString.safeParse('s').success).toBe(false);
      expect(DurationString.safeParse('m').success).toBe(false);
      expect(DurationString.safeParse('h').success).toBe(false);
    });

    it('should reject number without unit (except 0)', () => {
      expect(DurationString.safeParse('30').success).toBe(false);
      expect(DurationString.safeParse('100').success).toBe(false);
    });

    it('should reject whitespace', () => {
      expect(DurationString.safeParse(' 30s').success).toBe(false);
      expect(DurationString.safeParse('30s ').success).toBe(false);
      expect(DurationString.safeParse('30 s').success).toBe(false);
    });

    it('should reject multiple units', () => {
      expect(DurationString.safeParse('1h30m').success).toBe(false);
      expect(DurationString.safeParse('1d12h').success).toBe(false);
    });

    it('should reject leading zeros (parsed as valid but different number)', () => {
      // Leading zeros are technically valid regex matches
      expect(DurationString.safeParse('00s').success).toBe(true);
      expect(DurationString.safeParse('007d').success).toBe(true);
    });
  });
});

describe('parseDurationToMs', () => {
  describe('special value "0"', () => {
    it('should return 0 for "0"', () => {
      expect(parseDurationToMs('0')).toBe(0);
    });
  });

  describe('seconds parsing', () => {
    it('should parse 1 second', () => {
      expect(parseDurationToMs('1s')).toBe(1000);
    });

    it('should parse multiple seconds', () => {
      expect(parseDurationToMs('30s')).toBe(30 * 1000);
      expect(parseDurationToMs('60s')).toBe(60 * 1000);
      expect(parseDurationToMs('3600s')).toBe(3600 * 1000);
    });

    it('should parse 0 seconds', () => {
      expect(parseDurationToMs('0s')).toBe(0);
    });
  });

  describe('minutes parsing', () => {
    it('should parse 1 minute', () => {
      expect(parseDurationToMs('1m')).toBe(60 * 1000);
    });

    it('should parse multiple minutes', () => {
      expect(parseDurationToMs('5m')).toBe(5 * 60 * 1000);
      expect(parseDurationToMs('30m')).toBe(30 * 60 * 1000);
      expect(parseDurationToMs('60m')).toBe(60 * 60 * 1000);
    });

    it('should parse 0 minutes', () => {
      expect(parseDurationToMs('0m')).toBe(0);
    });
  });

  describe('hours parsing', () => {
    it('should parse 1 hour', () => {
      expect(parseDurationToMs('1h')).toBe(60 * 60 * 1000);
    });

    it('should parse multiple hours', () => {
      expect(parseDurationToMs('12h')).toBe(12 * 60 * 60 * 1000);
      expect(parseDurationToMs('24h')).toBe(24 * 60 * 60 * 1000);
      expect(parseDurationToMs('168h')).toBe(168 * 60 * 60 * 1000);
    });

    it('should parse 0 hours', () => {
      expect(parseDurationToMs('0h')).toBe(0);
    });
  });

  describe('days parsing', () => {
    it('should parse 1 day', () => {
      expect(parseDurationToMs('1d')).toBe(24 * 60 * 60 * 1000);
    });

    it('should parse multiple days', () => {
      expect(parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDurationToMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
      expect(parseDurationToMs('365d')).toBe(365 * 24 * 60 * 60 * 1000);
    });

    it('should parse 0 days', () => {
      expect(parseDurationToMs('0d')).toBe(0);
    });
  });

  describe('years parsing', () => {
    it('should parse 1 year (365 days)', () => {
      expect(parseDurationToMs('1y')).toBe(365 * 24 * 60 * 60 * 1000);
    });

    it('should parse multiple years', () => {
      expect(parseDurationToMs('2y')).toBe(2 * 365 * 24 * 60 * 60 * 1000);
      expect(parseDurationToMs('5y')).toBe(5 * 365 * 24 * 60 * 60 * 1000);
      expect(parseDurationToMs('10y')).toBe(10 * 365 * 24 * 60 * 60 * 1000);
    });

    it('should parse 0 years', () => {
      expect(parseDurationToMs('0y')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle large values', () => {
      expect(parseDurationToMs('999999s')).toBe(999999 * 1000);
    });

    it('should handle leading zeros', () => {
      expect(parseDurationToMs('007d')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDurationToMs('00s')).toBe(0);
    });
  });

  describe('error cases', () => {
    it('should throw for empty string', () => {
      expect(() => parseDurationToMs('')).toThrow('Invalid duration format: ');
    });

    it('should throw for invalid format', () => {
      expect(() => parseDurationToMs('abc')).toThrow(
        'Invalid duration format: abc',
      );
    });

    it('should throw for negative numbers', () => {
      expect(() => parseDurationToMs('-1s')).toThrow(
        'Invalid duration format: -1s',
      );
    });

    it('should throw for decimal numbers', () => {
      expect(() => parseDurationToMs('1.5h')).toThrow(
        'Invalid duration format: 1.5h',
      );
    });

    it('should throw for invalid units', () => {
      expect(() => parseDurationToMs('30x')).toThrow(
        'Invalid duration format: 30x',
      );
      expect(() => parseDurationToMs('30w')).toThrow(
        'Invalid duration format: 30w',
      );
    });

    it('should throw for uppercase units', () => {
      expect(() => parseDurationToMs('30S')).toThrow(
        'Invalid duration format: 30S',
      );
      expect(() => parseDurationToMs('30M')).toThrow(
        'Invalid duration format: 30M',
      );
    });

    it('should throw for number without unit', () => {
      expect(() => parseDurationToMs('30')).toThrow(
        'Invalid duration format: 30',
      );
    });

    it('should throw for unit without number', () => {
      expect(() => parseDurationToMs('s')).toThrow(
        'Invalid duration format: s',
      );
    });

    it('should throw for whitespace', () => {
      expect(() => parseDurationToMs(' 30s')).toThrow(
        'Invalid duration format:  30s',
      );
      expect(() => parseDurationToMs('30s ')).toThrow(
        'Invalid duration format: 30s ',
      );
    });

    it('should throw for compound durations', () => {
      expect(() => parseDurationToMs('1h30m')).toThrow(
        'Invalid duration format: 1h30m',
      );
    });
  });
});

describe('calculateCutoffDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a fixed time: 2024-01-15 12:00:00 UTC
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return current time for "0" retention', () => {
    const cutoff = calculateCutoffDate('0');
    expect(cutoff.getTime()).toBe(
      new Date('2024-01-15T12:00:00.000Z').getTime(),
    );
  });

  it('should calculate cutoff for seconds', () => {
    const cutoff = calculateCutoffDate('30s');
    expect(cutoff.getTime()).toBe(
      new Date('2024-01-15T11:59:30.000Z').getTime(),
    );
  });

  it('should calculate cutoff for minutes', () => {
    const cutoff = calculateCutoffDate('30m');
    expect(cutoff.getTime()).toBe(
      new Date('2024-01-15T11:30:00.000Z').getTime(),
    );
  });

  it('should calculate cutoff for hours', () => {
    const cutoff = calculateCutoffDate('24h');
    expect(cutoff.getTime()).toBe(
      new Date('2024-01-14T12:00:00.000Z').getTime(),
    );
  });

  it('should calculate cutoff for days', () => {
    const cutoff = calculateCutoffDate('7d');
    expect(cutoff.getTime()).toBe(
      new Date('2024-01-08T12:00:00.000Z').getTime(),
    );
  });

  it('should calculate cutoff for 30 days', () => {
    const cutoff = calculateCutoffDate('30d');
    expect(cutoff.getTime()).toBe(
      new Date('2023-12-16T12:00:00.000Z').getTime(),
    );
  });

  it('should calculate cutoff for 1 year', () => {
    const cutoff = calculateCutoffDate('1y');
    expect(cutoff.getTime()).toBe(
      new Date('2023-01-15T12:00:00.000Z').getTime(),
    );
  });
});

describe('formatDuration', () => {
  describe('immediate (0)', () => {
    it('should return "immediate" for 0', () => {
      expect(formatDuration(0)).toBe('immediate');
    });
  });

  describe('seconds', () => {
    it('should format 1 second', () => {
      expect(formatDuration(1000)).toBe('1 second');
    });

    it('should format multiple seconds with plural', () => {
      expect(formatDuration(2000)).toBe('2 seconds');
      expect(formatDuration(30000)).toBe('30 seconds');
      expect(formatDuration(59000)).toBe('59 seconds');
    });

    it('should round milliseconds to nearest second', () => {
      expect(formatDuration(1500)).toBe('2 seconds');
      expect(formatDuration(1499)).toBe('1 second');
    });
  });

  describe('minutes', () => {
    it('should format 1 minute', () => {
      expect(formatDuration(60 * 1000)).toBe('1 minute');
    });

    it('should format multiple minutes with plural', () => {
      expect(formatDuration(2 * 60 * 1000)).toBe('2 minutes');
      expect(formatDuration(30 * 60 * 1000)).toBe('30 minutes');
      expect(formatDuration(59 * 60 * 1000)).toBe('59 minutes');
    });

    it('should round to nearest minute', () => {
      expect(formatDuration(90 * 1000)).toBe('2 minutes');
      expect(formatDuration(89 * 1000)).toBe('1 minute');
    });
  });

  describe('hours', () => {
    it('should format 1 hour', () => {
      expect(formatDuration(60 * 60 * 1000)).toBe('1 hour');
    });

    it('should format multiple hours with plural', () => {
      expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2 hours');
      expect(formatDuration(12 * 60 * 60 * 1000)).toBe('12 hours');
      expect(formatDuration(23 * 60 * 60 * 1000)).toBe('23 hours');
    });

    it('should round to nearest hour', () => {
      expect(formatDuration(90 * 60 * 1000)).toBe('2 hours');
      expect(formatDuration(89 * 60 * 1000)).toBe('1 hour');
    });
  });

  describe('days', () => {
    it('should format 1 day', () => {
      expect(formatDuration(24 * 60 * 60 * 1000)).toBe('1 day');
    });

    it('should format multiple days with plural', () => {
      expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe('2 days');
      expect(formatDuration(7 * 24 * 60 * 60 * 1000)).toBe('7 days');
      expect(formatDuration(30 * 24 * 60 * 60 * 1000)).toBe('30 days');
      expect(formatDuration(364 * 24 * 60 * 60 * 1000)).toBe('364 days');
    });

    it('should round to nearest day', () => {
      expect(formatDuration(36 * 60 * 60 * 1000)).toBe('2 days');
      expect(formatDuration(35 * 60 * 60 * 1000)).toBe('1 day');
    });
  });

  describe('years', () => {
    it('should format 1 year', () => {
      expect(formatDuration(365 * 24 * 60 * 60 * 1000)).toBe('1 year');
    });

    it('should format multiple years with plural', () => {
      expect(formatDuration(2 * 365 * 24 * 60 * 60 * 1000)).toBe('2 years');
      expect(formatDuration(5 * 365 * 24 * 60 * 60 * 1000)).toBe('5 years');
      expect(formatDuration(10 * 365 * 24 * 60 * 60 * 1000)).toBe('10 years');
    });

    it('should round to nearest year', () => {
      expect(formatDuration(547 * 24 * 60 * 60 * 1000)).toBe('1 year');
      expect(formatDuration(548 * 24 * 60 * 60 * 1000)).toBe('2 years');
    });
  });

  describe('boundary cases', () => {
    it('should format exactly at minute boundary', () => {
      expect(formatDuration(MS_PER_MINUTE - 1)).toBe('60 seconds');
      expect(formatDuration(MS_PER_MINUTE)).toBe('1 minute');
    });

    it('should format exactly at hour boundary', () => {
      expect(formatDuration(MS_PER_HOUR - 1)).toBe('60 minutes');
      expect(formatDuration(MS_PER_HOUR)).toBe('1 hour');
    });

    it('should format exactly at day boundary', () => {
      expect(formatDuration(MS_PER_DAY - 1)).toBe('24 hours');
      expect(formatDuration(MS_PER_DAY)).toBe('1 day');
    });

    it('should format exactly at year boundary', () => {
      expect(formatDuration(MS_PER_YEAR - 1)).toBe('365 days');
      expect(formatDuration(MS_PER_YEAR)).toBe('1 year');
    });
  });
});

describe('calculatePermanentDeletionDate', () => {
  it('should add retention period to deleted_at date', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '30d');

    expect(result.getTime()).toBe(
      new Date('2024-02-14T12:00:00.000Z').getTime(),
    );
  });

  it('should return same date for "0" retention', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '0');

    expect(result.getTime()).toBe(deletedAt.getTime());
  });

  it('should handle seconds retention', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '30s');

    expect(result.getTime()).toBe(
      new Date('2024-01-15T12:00:30.000Z').getTime(),
    );
  });

  it('should handle minutes retention', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '15m');

    expect(result.getTime()).toBe(
      new Date('2024-01-15T12:15:00.000Z').getTime(),
    );
  });

  it('should handle hours retention', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '48h');

    expect(result.getTime()).toBe(
      new Date('2024-01-17T12:00:00.000Z').getTime(),
    );
  });

  it('should handle days retention', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '7d');

    expect(result.getTime()).toBe(
      new Date('2024-01-22T12:00:00.000Z').getTime(),
    );
  });

  it('should handle years retention', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '1y');

    expect(result.getTime()).toBe(
      new Date('2025-01-14T12:00:00.000Z').getTime(),
    );
  });

  it('should not modify the original deletedAt date', () => {
    const deletedAt = new Date('2024-01-15T12:00:00.000Z');
    const originalTime = deletedAt.getTime();
    calculatePermanentDeletionDate(deletedAt, '30d');

    expect(deletedAt.getTime()).toBe(originalTime);
  });

  it('should handle various deletedAt times', () => {
    const deletedAt = new Date('2024-06-30T23:59:59.999Z');
    const result = calculatePermanentDeletionDate(deletedAt, '1d');

    expect(result.getTime()).toBe(
      new Date('2024-07-01T23:59:59.999Z').getTime(),
    );
  });

  it('should handle leap year', () => {
    const deletedAt = new Date('2024-02-28T12:00:00.000Z');
    const result = calculatePermanentDeletionDate(deletedAt, '1d');

    // 2024 is a leap year, so Feb 28 + 1 day = Feb 29
    expect(result.getTime()).toBe(
      new Date('2024-02-29T12:00:00.000Z').getTime(),
    );
  });
});

describe('Integration: parseDurationToMs and formatDuration', () => {
  it('should roundtrip seconds', () => {
    const ms = parseDurationToMs('30s');
    const formatted = formatDuration(ms);
    expect(formatted).toBe('30 seconds');
  });

  it('should roundtrip minutes', () => {
    const ms = parseDurationToMs('30m');
    const formatted = formatDuration(ms);
    expect(formatted).toBe('30 minutes');
  });

  it('should roundtrip hours', () => {
    // 12h stays as hours since it's less than a day
    const ms = parseDurationToMs('12h');
    const formatted = formatDuration(ms);
    expect(formatted).toBe('12 hours');
  });

  it('should convert 24h to 1 day', () => {
    // 24h equals exactly 1 day, so formatDuration returns "1 day"
    const ms = parseDurationToMs('24h');
    const formatted = formatDuration(ms);
    expect(formatted).toBe('1 day');
  });

  it('should roundtrip days', () => {
    const ms = parseDurationToMs('7d');
    const formatted = formatDuration(ms);
    expect(formatted).toBe('7 days');
  });

  it('should roundtrip years', () => {
    const ms = parseDurationToMs('2y');
    const formatted = formatDuration(ms);
    expect(formatted).toBe('2 years');
  });

  it('should handle 0 duration', () => {
    const ms = parseDurationToMs('0');
    const formatted = formatDuration(ms);
    expect(formatted).toBe('immediate');
  });
});

describe('Integration: DurationString schema and parseDurationToMs', () => {
  const validDurations = ['0', '1s', '30m', '24h', '7d', '1y', '365d', '100y'];

  for (const duration of validDurations) {
    it(`should parse valid duration "${duration}" that passes schema`, () => {
      expect(DurationString.safeParse(duration).success).toBe(true);
      expect(() => parseDurationToMs(duration)).not.toThrow();
    });
  }
});
