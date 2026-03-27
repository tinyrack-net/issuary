import { describe, expect, it } from 'vitest';
import {
  isIPInRange,
  isIPv4,
  isIPv4InCIDR,
  isIPv6,
  isIPv6InCIDR,
  isTrustedProxy,
  parseIPv4,
  parseIPv6,
} from './ip-utils.ts';

describe('ip-utils', () => {
  describe('parseIPv4', () => {
    it('should parse valid IPv4 addresses', () => {
      expect(parseIPv4('0.0.0.0')).toBe(0);
      expect(parseIPv4('255.255.255.255')).toBe(0xffffffff);
      expect(parseIPv4('192.168.1.1')).toBe(0xc0a80101);
      expect(parseIPv4('10.0.0.1')).toBe(0x0a000001);
      expect(parseIPv4('127.0.0.1')).toBe(0x7f000001);
    });

    it('should return null for invalid IPv4 addresses', () => {
      expect(parseIPv4('')).toBeNull();
      expect(parseIPv4('192.168.1')).toBeNull();
      expect(parseIPv4('192.168.1.1.1')).toBeNull();
      expect(parseIPv4('256.0.0.1')).toBeNull();
      expect(parseIPv4('192.168.1.a')).toBeNull();
      expect(parseIPv4('-1.0.0.1')).toBeNull();
    });
  });

  describe('parseIPv6', () => {
    it('should parse valid IPv6 addresses', () => {
      expect(parseIPv6('0:0:0:0:0:0:0:0')).toBe(BigInt(0));
      expect(parseIPv6('::1')).toBe(BigInt(1));
      expect(parseIPv6('2001:db8::1')).toBe(
        BigInt('0x20010db8000000000000000000000001'),
      );
      expect(parseIPv6('fe80:0000:0000:0000:0000:0000:0000:0001')).toBe(
        BigInt('0xfe800000000000000000000000000001'),
      );
    });

    it('should parse IPv4-mapped IPv6 addresses', () => {
      expect(parseIPv6('::ffff:192.168.1.1')).toBe(BigInt('0xffffc0a80101'));
    });

    it('should handle :: compression', () => {
      expect(parseIPv6('::')).toBe(BigInt(0));
      expect(parseIPv6('::1')).toBe(BigInt(1));
      expect(parseIPv6('fe80::')).toBe(
        BigInt('0xfe800000000000000000000000000000'),
      );
    });

    it('should return null for invalid IPv6 addresses', () => {
      expect(parseIPv6('')).toBeNull();
      expect(parseIPv6(':::1')).toBeNull();
      expect(parseIPv6('2001:db8::1::2')).toBeNull();
    });
  });

  describe('isIPv4', () => {
    it('should identify IPv4 addresses', () => {
      expect(isIPv4('192.168.1.1')).toBe(true);
      expect(isIPv4('10.0.0.1')).toBe(true);
      expect(isIPv4('127.0.0.1')).toBe(true);
    });

    it('should reject non-IPv4 addresses', () => {
      expect(isIPv4('::1')).toBe(false);
      expect(isIPv4('2001:db8::1')).toBe(false);
      expect(isIPv4('not-an-ip')).toBe(false);
    });
  });

  describe('isIPv6', () => {
    it('should identify IPv6 addresses', () => {
      expect(isIPv6('::1')).toBe(true);
      expect(isIPv6('2001:db8::1')).toBe(true);
      expect(isIPv6('fe80::1')).toBe(true);
    });

    it('should reject non-IPv6 addresses', () => {
      expect(isIPv6('192.168.1.1')).toBe(false);
      expect(isIPv6('not-an-ip')).toBe(false);
    });
  });

  describe('isIPv4InCIDR', () => {
    it('should match IPs within CIDR range', () => {
      expect(isIPv4InCIDR('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(isIPv4InCIDR('10.255.255.255', '10.0.0.0/8')).toBe(true);
      expect(isIPv4InCIDR('192.168.1.100', '192.168.1.0/24')).toBe(true);
      expect(isIPv4InCIDR('172.16.5.10', '172.16.0.0/12')).toBe(true);
    });

    it('should reject IPs outside CIDR range', () => {
      expect(isIPv4InCIDR('11.0.0.1', '10.0.0.0/8')).toBe(false);
      expect(isIPv4InCIDR('192.168.2.1', '192.168.1.0/24')).toBe(false);
      expect(isIPv4InCIDR('192.168.0.1', '192.168.1.0/24')).toBe(false);
    });

    it('should handle /32 (exact match)', () => {
      expect(isIPv4InCIDR('192.168.1.1', '192.168.1.1/32')).toBe(true);
      expect(isIPv4InCIDR('192.168.1.2', '192.168.1.1/32')).toBe(false);
    });

    it('should handle /0 (match all)', () => {
      expect(isIPv4InCIDR('1.2.3.4', '0.0.0.0/0')).toBe(true);
      expect(isIPv4InCIDR('255.255.255.255', '0.0.0.0/0')).toBe(true);
    });

    it('should handle CIDR without prefix (default /32)', () => {
      expect(isIPv4InCIDR('192.168.1.1', '192.168.1.1')).toBe(true);
      expect(isIPv4InCIDR('192.168.1.2', '192.168.1.1')).toBe(false);
    });
  });

  describe('isIPv6InCIDR', () => {
    it('should match IPs within CIDR range', () => {
      expect(isIPv6InCIDR('2001:db8::1', '2001:db8::/32')).toBe(true);
      expect(
        isIPv6InCIDR('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff', '2001:db8::/32'),
      ).toBe(true);
      expect(isIPv6InCIDR('fe80::1', 'fe80::/10')).toBe(true);
    });

    it('should reject IPs outside CIDR range', () => {
      expect(isIPv6InCIDR('2001:db9::1', '2001:db8::/32')).toBe(false);
      expect(isIPv6InCIDR('fe81::1', 'fe80::/16')).toBe(false);
    });

    it('should handle /128 (exact match)', () => {
      expect(isIPv6InCIDR('::1', '::1/128')).toBe(true);
      expect(isIPv6InCIDR('::2', '::1/128')).toBe(false);
    });
  });

  describe('isIPInRange', () => {
    it('should match IPv4 addresses', () => {
      expect(isIPInRange('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(isIPInRange('192.168.1.1', '192.168.1.1')).toBe(true);
      expect(isIPInRange('11.0.0.1', '10.0.0.0/8')).toBe(false);
    });

    it('should match IPv6 addresses', () => {
      expect(isIPInRange('2001:db8::1', '2001:db8::/32')).toBe(true);
      expect(isIPInRange('::1', '::1')).toBe(true);
      expect(isIPInRange('2001:db9::1', '2001:db8::/32')).toBe(false);
    });

    it('should handle IPv4-mapped IPv6 addresses', () => {
      expect(isIPInRange('::ffff:10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(isIPInRange('::ffff:192.168.1.1', '192.168.1.1')).toBe(true);
    });
  });

  describe('isTrustedProxy', () => {
    it('should allow all when trust_proxy is true', () => {
      expect(isTrustedProxy('1.2.3.4', true)).toBe(true);
      expect(isTrustedProxy('192.168.1.1', true)).toBe(true);
    });

    it('should allow all when trust_proxy is false (direct connection)', () => {
      expect(isTrustedProxy('1.2.3.4', false)).toBe(true);
      expect(isTrustedProxy('192.168.1.1', false)).toBe(true);
    });

    it('should allow all when trust_proxy is a number (hop count)', () => {
      expect(isTrustedProxy('1.2.3.4', 2)).toBe(true);
      expect(isTrustedProxy('192.168.1.1', 1)).toBe(true);
    });

    it('should check against single IP string', () => {
      expect(isTrustedProxy('127.0.0.1', '127.0.0.1')).toBe(true);
      expect(isTrustedProxy('127.0.0.2', '127.0.0.1')).toBe(false);
    });

    it('should check against CIDR string', () => {
      expect(isTrustedProxy('10.0.0.1', '10.0.0.0/8')).toBe(true);
      expect(isTrustedProxy('10.255.255.255', '10.0.0.0/8')).toBe(true);
      expect(isTrustedProxy('11.0.0.1', '10.0.0.0/8')).toBe(false);
    });

    it('should check against array of IPs/CIDRs', () => {
      const trustProxy = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

      expect(isTrustedProxy('10.0.0.1', trustProxy)).toBe(true);
      expect(isTrustedProxy('172.16.1.1', trustProxy)).toBe(true);
      expect(isTrustedProxy('192.168.1.1', trustProxy)).toBe(true);
      expect(isTrustedProxy('8.8.8.8', trustProxy)).toBe(false);
    });

    it('should handle mixed array with exact IPs and CIDRs', () => {
      const trustProxy = ['127.0.0.1', '10.0.0.0/8'];

      expect(isTrustedProxy('127.0.0.1', trustProxy)).toBe(true);
      expect(isTrustedProxy('10.0.0.1', trustProxy)).toBe(true);
      expect(isTrustedProxy('127.0.0.2', trustProxy)).toBe(false);
    });
  });
});
