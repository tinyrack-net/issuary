import { describe, expect, test } from 'vitest';
import { isEmailAllowed } from './email-pattern.js';

describe('isEmailAllowed', () => {
  describe('empty patterns (signup disabled)', () => {
    test('should reject any email when patterns array is empty', () => {
      expect(isEmailAllowed('user@example.com', [])).toBe(false);
    });
  });

  describe('wildcard pattern (*)', () => {
    test('should allow any email with wildcard pattern', () => {
      expect(isEmailAllowed('user@example.com', ['*'])).toBe(true);
      expect(isEmailAllowed('admin@company.org', ['*'])).toBe(true);
    });
  });

  describe('exact email match', () => {
    test('should allow exact email match', () => {
      expect(isEmailAllowed('me@winetree94.com', ['me@winetree94.com'])).toBe(
        true,
      );
    });

    test('should reject non-matching email', () => {
      expect(
        isEmailAllowed('other@winetree94.com', ['me@winetree94.com']),
      ).toBe(false);
    });

    test('should match case-insensitively', () => {
      expect(isEmailAllowed('Me@Winetree94.COM', ['me@winetree94.com'])).toBe(
        true,
      );
      expect(isEmailAllowed('me@winetree94.com', ['ME@WINETREE94.COM'])).toBe(
        true,
      );
    });
  });

  describe('domain wildcard pattern (*@domain.com)', () => {
    test('should allow any email at the specified domain', () => {
      expect(isEmailAllowed('user@winetree94.com', ['*@winetree94.com'])).toBe(
        true,
      );
      expect(isEmailAllowed('admin@winetree94.com', ['*@winetree94.com'])).toBe(
        true,
      );
    });

    test('should reject email from different domain', () => {
      expect(isEmailAllowed('user@example.com', ['*@winetree94.com'])).toBe(
        false,
      );
    });

    test('should match domain case-insensitively', () => {
      expect(isEmailAllowed('user@WINETREE94.COM', ['*@winetree94.com'])).toBe(
        true,
      );
    });
  });

  describe('multiple patterns', () => {
    const patterns = [
      'admin@company.com',
      '*@winetree94.com',
      '*@vivident.xyz',
    ];

    test('should allow email matching any pattern', () => {
      expect(isEmailAllowed('admin@company.com', patterns)).toBe(true);
      expect(isEmailAllowed('user@winetree94.com', patterns)).toBe(true);
      expect(isEmailAllowed('test@vivident.xyz', patterns)).toBe(true);
    });

    test('should reject email matching no patterns', () => {
      expect(isEmailAllowed('user@other.com', patterns)).toBe(false);
      expect(isEmailAllowed('user@company.com', patterns)).toBe(false);
    });
  });

  describe('pattern with whitespace trimming', () => {
    test('should trim whitespace from patterns', () => {
      expect(isEmailAllowed('user@example.com', [' *@example.com '])).toBe(
        true,
      );
      expect(isEmailAllowed('user@example.com', [' user@example.com '])).toBe(
        true,
      );
    });
  });
});
