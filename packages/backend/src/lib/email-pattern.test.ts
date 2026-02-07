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

  describe('subdomain bypass prevention', () => {
    test('should reject email from subdomain when pattern specifies parent domain', () => {
      expect(isEmailAllowed('user@sub.company.com', ['*@company.com'])).toBe(
        false,
      );
    });

    test('should reject email from deeply nested subdomain', () => {
      expect(
        isEmailAllowed('user@evil.sub.company.com', ['*@company.com']),
      ).toBe(false);
    });

    test('should reject subdomain that embeds the target domain', () => {
      expect(
        isEmailAllowed('user@company.com.evil.com', ['*@company.com']),
      ).toBe(false);
    });
  });

  describe('domain suffix confusion prevention', () => {
    test('should reject email from domain that ends with same string', () => {
      expect(isEmailAllowed('user@notcompany.com', ['*@company.com'])).toBe(
        false,
      );
    });

    test('should reject email from domain with prefix overlap', () => {
      expect(isEmailAllowed('user@mycompany.com', ['*@company.com'])).toBe(
        false,
      );
    });

    test('should reject exact-pattern domain suffix confusion', () => {
      expect(
        isEmailAllowed('admin@fakecompany.com', ['admin@company.com']),
      ).toBe(false);
    });

    test('should reject short domain suffix match', () => {
      expect(isEmailAllowed('user@ba.com', ['*@a.com'])).toBe(false);
    });
  });

  describe('malformed or adversarial inputs', () => {
    test('should reject empty email string with domain pattern', () => {
      expect(isEmailAllowed('', ['*@domain.com'])).toBe(false);
    });

    test('should allow empty email string with wildcard pattern', () => {
      expect(isEmailAllowed('', ['*'])).toBe(true);
    });

    test('should reject email without @ sign', () => {
      expect(isEmailAllowed('notanemail', ['*@domain.com'])).toBe(false);
    });

    test('should handle email with double @ symbol', () => {
      expect(isEmailAllowed('user@@domain.com', ['*@domain.com'])).toBe(true);
    });

    test('should handle email with no local part', () => {
      expect(isEmailAllowed('@domain.com', ['*@domain.com'])).toBe(true);
    });
  });

  describe('multiple patterns — rejection across all patterns', () => {
    const patterns = ['admin@a.com', '*@b.com', '*@c.com'];

    test('should reject email not matching any pattern', () => {
      expect(isEmailAllowed('admin@d.com', patterns)).toBe(false);
    });

    test('should reject email with matching domain but wrong local part for exact pattern', () => {
      expect(isEmailAllowed('user@a.com', patterns)).toBe(false);
    });

    test('should reject email with matching local part but wrong domain', () => {
      expect(isEmailAllowed('admin@b.org', patterns)).toBe(false);
    });

    test('should reject completely unrelated email', () => {
      expect(isEmailAllowed('random@x.com', patterns)).toBe(false);
    });

    test('should reject subdomain of a domain-wildcard pattern', () => {
      expect(isEmailAllowed('user@sub.b.com', patterns)).toBe(false);
    });

    test('should reject domain suffix confusion across all patterns', () => {
      expect(isEmailAllowed('user@xb.com', patterns)).toBe(false);
      expect(isEmailAllowed('user@xc.com', patterns)).toBe(false);
    });
  });

  describe('multiple patterns — wildcard with other patterns', () => {
    test('should allow any email when wildcard is first', () => {
      expect(
        isEmailAllowed('anything@anywhere.com', ['*', '*@b.com', 'a@c.com']),
      ).toBe(true);
    });

    test('should allow any email when wildcard is last', () => {
      expect(
        isEmailAllowed('anything@anywhere.com', ['*@a.com', 'b@c.com', '*']),
      ).toBe(true);
    });

    test('should allow any email when wildcard is in the middle', () => {
      expect(
        isEmailAllowed('anything@anywhere.com', ['a@b.com', '*', '*@c.com']),
      ).toBe(true);
    });
  });

  describe('multiple patterns — mixed pattern types', () => {
    const patterns = ['exact@one.com', '*@two.com', 'exact@three.com'];

    test('should match first exact pattern', () => {
      expect(isEmailAllowed('exact@one.com', patterns)).toBe(true);
    });

    test('should match second exact pattern', () => {
      expect(isEmailAllowed('exact@three.com', patterns)).toBe(true);
    });

    test('should match domain wildcard with any local part', () => {
      expect(isEmailAllowed('any@two.com', patterns)).toBe(true);
    });

    test('should match domain wildcard even when local part matches another exact pattern', () => {
      expect(isEmailAllowed('exact@two.com', patterns)).toBe(true);
    });

    test('should reject different local part on exact-only domain', () => {
      expect(isEmailAllowed('other@one.com', patterns)).toBe(false);
    });

    test('should reject different local part on another exact-only domain', () => {
      expect(isEmailAllowed('other@three.com', patterns)).toBe(false);
    });

    test('should reject email not matching any pattern type', () => {
      expect(isEmailAllowed('user@four.com', patterns)).toBe(false);
    });
  });

  describe('edge-case patterns', () => {
    test('should not match anything with empty string pattern', () => {
      expect(isEmailAllowed('user@a.com', [''])).toBe(false);
    });

    test('should not match with bare @ pattern', () => {
      expect(isEmailAllowed('user@a.com', ['@'])).toBe(false);
    });

    test('should not match with double wildcard pattern', () => {
      expect(isEmailAllowed('user@a.com', ['**'])).toBe(false);
    });

    test('should not match with *@* pattern', () => {
      expect(isEmailAllowed('user@a.com', ['*@*'])).toBe(false);
    });

    test('should not match with *@ (empty domain) pattern', () => {
      expect(isEmailAllowed('user@a.com', ['*@'])).toBe(false);
    });
  });
});
