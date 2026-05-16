import { parseIPv4 } from '../ip-utils.js';

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isIPv4Loopback(hostname: string): boolean {
  const ipv4 = parseIPv4(hostname);
  return ipv4 !== null && (ipv4 & 0xff000000) === 0x7f000000;
}

export function isLocalHttpHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isIPv4Loopback(hostname) ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

export function isHttpsOrLocalHttpUrl(value: string): boolean {
  const url = parseUrl(value);

  if (!url) {
    return false;
  }

  if (url.protocol === 'https:') {
    return true;
  }

  return url.protocol === 'http:' && isLocalHttpHostname(url.hostname);
}

export function isSecureRedirectUri(value: string): boolean {
  const url = parseUrl(value);

  if (!url) {
    return false;
  }

  return (
    !value.includes('*') && url.hash === '' && isHttpsOrLocalHttpUrl(value)
  );
}
