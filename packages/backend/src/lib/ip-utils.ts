/**
 * IP address utilities for validating and matching IP addresses against CIDR ranges.
 * Supports both IPv4 and IPv6 addresses.
 */

/**
 * Parses an IPv4 address string into a 32-bit integer.
 * @param ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns 32-bit integer representation, or null if invalid
 */
export function parseIPv4(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    const num = Number.parseInt(part, 10);
    if (Number.isNaN(num) || num < 0 || num > 255) {
      return null;
    }
    result = (result << 8) | num;
  }

  // Convert to unsigned 32-bit integer
  return result >>> 0;
}

/**
 * Parses an IPv6 address string into a BigInt.
 * Supports full and compressed (::) notation.
 * @param ip - IPv6 address string (e.g., "2001:db8::1")
 * @returns BigInt representation, or null if invalid
 */
export function parseIPv6(ip: string): bigint | null {
  // Handle IPv4-mapped IPv6 addresses (::ffff:192.168.1.1)
  const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch) {
    const ipv4Part = ipv4MappedMatch[1];
    if (ipv4Part === undefined) {
      return null;
    }
    const ipv4 = parseIPv4(ipv4Part);
    if (ipv4 === null) {
      return null;
    }
    return BigInt('0xffff00000000') | BigInt(ipv4);
  }

  // Reject multiple :: (only one :: is allowed)
  const doubleColonCount = (ip.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) {
    return null;
  }

  // Reject ::: (triple colon is invalid)
  if (ip.includes(':::')) {
    return null;
  }

  let parts = ip.split(':');

  // Handle :: compression
  const doubleColonIndex = ip.indexOf('::');
  if (doubleColonIndex !== -1) {
    const left = ip.slice(0, doubleColonIndex).split(':').filter(Boolean);
    const right = ip
      .slice(doubleColonIndex + 2)
      .split(':')
      .filter(Boolean);
    const missing = 8 - left.length - right.length;
    if (missing < 0) {
      return null;
    }
    parts = [...left, ...Array<string>(missing).fill('0'), ...right];
  }

  if (parts.length !== 8) {
    return null;
  }

  let result = BigInt(0);
  for (const part of parts) {
    const num = Number.parseInt(part, 16);
    if (Number.isNaN(num) || num < 0 || num > 0xffff) {
      return null;
    }
    result = (result << BigInt(16)) | BigInt(num);
  }

  return result;
}

/**
 * Checks if an IP address is an IPv4 address.
 * @param ip - IP address string
 * @returns true if the address is IPv4
 */
export function isIPv4(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/**
 * Checks if an IP address is an IPv6 address.
 * @param ip - IP address string
 * @returns true if the address is IPv6
 */
export function isIPv6(ip: string): boolean {
  return ip.includes(':');
}

/**
 * Checks if an IPv4 address is within a CIDR range.
 * @param ip - IPv4 address to check
 * @param cidr - CIDR notation (e.g., "10.0.0.0/8")
 * @returns true if the IP is within the range
 */
export function isIPv4InCIDR(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  if (network === undefined) {
    return false;
  }
  const prefix = prefixStr !== undefined ? Number.parseInt(prefixStr, 10) : 32;

  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipNum = parseIPv4(ip);
  const networkNum = parseIPv4(network);

  if (ipNum === null || networkNum === null) {
    return false;
  }

  // Create mask: all 1s for prefix length, then 0s
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Checks if an IPv6 address is within a CIDR range.
 * @param ip - IPv6 address to check
 * @param cidr - CIDR notation (e.g., "2001:db8::/32")
 * @returns true if the IP is within the range
 */
export function isIPv6InCIDR(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/');
  if (network === undefined) {
    return false;
  }
  const prefix = prefixStr !== undefined ? Number.parseInt(prefixStr, 10) : 128;

  if (Number.isNaN(prefix) || prefix < 0 || prefix > 128) {
    return false;
  }

  const ipNum = parseIPv6(ip);
  const networkNum = parseIPv6(network);

  if (ipNum === null || networkNum === null) {
    return false;
  }

  // Create mask: all 1s for prefix length, then 0s
  const mask =
    prefix === 0
      ? BigInt(0)
      : (BigInt(1) << BigInt(128)) -
        BigInt(1) -
        ((BigInt(1) << BigInt(128 - prefix)) - BigInt(1));

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Checks if an IP address matches a given pattern.
 * The pattern can be:
 * - A single IP address (e.g., "192.168.1.1")
 * - A CIDR range (e.g., "10.0.0.0/8")
 * @param ip - IP address to check
 * @param pattern - Pattern to match against
 * @returns true if the IP matches the pattern
 */
export function isIPInRange(ip: string, pattern: string): boolean {
  // Normalize IPv4-mapped IPv6 addresses for comparison
  const normalizedIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const normalizedPattern = pattern.startsWith('::ffff:')
    ? pattern.slice(7)
    : pattern;

  const isCIDR = normalizedPattern.includes('/');

  if (isIPv4(normalizedIp)) {
    if (isCIDR) {
      return isIPv4InCIDR(normalizedIp, normalizedPattern);
    }
    return normalizedIp === normalizedPattern;
  }

  if (isIPv6(normalizedIp)) {
    if (isCIDR) {
      return isIPv6InCIDR(normalizedIp, normalizedPattern);
    }
    // For exact match, normalize both addresses
    const ipNum = parseIPv6(normalizedIp);
    const patternNum = parseIPv6(normalizedPattern);
    return ipNum !== null && patternNum !== null && ipNum === patternNum;
  }

  return false;
}

/**
 * Checks if an IP address is trusted based on trust_proxy configuration.
 * @param ip - IP address to check
 * @param trustProxy - Trust proxy configuration value
 * @returns true if the IP should be trusted
 */
export function isTrustedProxy(
  ip: string,
  trustProxy: boolean | string | string[] | number,
): boolean {
  // true = trust all proxies
  if (trustProxy === true) {
    return true;
  }

  // false = trust no proxies (direct connection expected)
  if (trustProxy === false) {
    return true; // Allow all requests in direct connection mode
  }

  // number = hop count mode (not IP-based filtering)
  if (typeof trustProxy === 'number') {
    return true; // Allow all requests in hop count mode
  }

  // string = single IP or CIDR
  if (typeof trustProxy === 'string') {
    return isIPInRange(ip, trustProxy);
  }

  // array = multiple IPs or CIDRs
  if (Array.isArray(trustProxy)) {
    return trustProxy.some((pattern) => isIPInRange(ip, pattern));
  }

  return false;
}
