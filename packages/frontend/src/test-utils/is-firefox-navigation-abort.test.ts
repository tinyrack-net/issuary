import { describe, expect, test } from 'vitest';
import { isFirefoxNavigationAbort } from './is-firefox-navigation-abort.js';

describe('isFirefoxNavigationAbort', () => {
  test.each([
    'page.goto: NS_BINDING_ABORTED',
    'page.goto: NS_ERROR_FAILURE',
    'page.goto: Navigation is interrupted by another navigation',
  ])('recognizes a recoverable Firefox navigation error: %s', (message) => {
    expect(isFirefoxNavigationAbort(new Error(message))).toBe(true);
  });

  test('rejects an unrelated navigation error', () => {
    expect(isFirefoxNavigationAbort(new Error('page.goto: Timeout'))).toBe(
      false,
    );
  });
});
