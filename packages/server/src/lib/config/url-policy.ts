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

/**
 * Schemes that are never a native app's private-use scheme: web and transport
 * schemes, schemes that execute or embed content in the browser, and schemes
 * that hand the response to another app or the operating system.
 */
const NON_PRIVATE_USE_SCHEMES = new Set([
  'about',
  'blob',
  'chrome',
  'chrome-extension',
  'content',
  'data',
  'file',
  'filesystem',
  'ftp',
  'http',
  'https',
  'intent',
  'javascript',
  'mailto',
  'moz-extension',
  'resource',
  'sms',
  'tel',
  'vbscript',
  'view-source',
  'ws',
  'wss',
]);

const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;

/**
 * A native app redirect URI that uses a private-use URI scheme, such as
 * `com.example.app:/callback` or `exampleapp://callback`
 * (RFC 8252 section 7.1).
 */
export function isPrivateUseSchemeRedirectUri(value: string): boolean {
  const url = parseUrl(value);

  if (!url || value.includes('*') || url.hash !== '') {
    return false;
  }

  if (url.username !== '' || url.password !== '') {
    return false;
  }

  const scheme = url.protocol.slice(0, -1);
  return (
    URI_SCHEME_PATTERN.test(scheme) &&
    value.toLowerCase().startsWith(`${scheme}:`) &&
    !NON_PRIVATE_USE_SCHEMES.has(scheme)
  );
}

/**
 * Redirect URIs a client may register: HTTPS, local HTTP, or a native app's
 * private-use scheme. Private-use redirects are restricted further at the
 * authorization endpoint (code flow with S256 PKCE only).
 */
export function isRegistrableRedirectUri(value: string): boolean {
  return isSecureRedirectUri(value) || isPrivateUseSchemeRedirectUri(value);
}
