import { describe, expect, test } from 'vitest';
import { getBrowserTestMaxWorkers } from './browser-test-policy.js';

describe('browser test policy', () => {
  test('serializes files per browser when validating multiple browsers', () => {
    expect(getBrowserTestMaxWorkers(false, false)).toBe(1);
  });

  test('keeps the default worker count for single-browser runs', () => {
    expect(getBrowserTestMaxWorkers(false, true)).toBeUndefined();
    expect(getBrowserTestMaxWorkers(true, false)).toBeUndefined();
  });
});
