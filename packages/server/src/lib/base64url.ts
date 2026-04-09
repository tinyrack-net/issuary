/**
 * Runtime-agnostic base64url encoding/decoding utilities.
 *
 * Uses only Web-standard APIs (Uint8Array, TextEncoder/TextDecoder)
 * so the code runs on Node.js, Cloudflare Workers, Deno, and browsers.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Standard base64 alphabet → base64url replacements
function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBase64(b64url: string): string {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (s.length % 4)) % 4;
  s += '='.repeat(pad);
  return s;
}

/** Encode a Uint8Array to a base64url string (no padding). */
export function toBase64Url(bytes: Uint8Array): string {
  // Build a binary string from the byte array, then use btoa().
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return base64ToBase64Url(btoa(binary));
}

/** Decode a base64url string to a Uint8Array. */
export function fromBase64Url(b64url: string): Uint8Array {
  const binary = atob(base64UrlToBase64(b64url));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encode a UTF-8 string to a Uint8Array. */
export function stringToBytes(str: string): Uint8Array {
  return encoder.encode(str);
}

/** Decode a Uint8Array to a UTF-8 string. */
export function bytesToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Convert a hex string to a Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Convert a Uint8Array to a hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Concatenate multiple Uint8Arrays into a single Uint8Array. */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.byteLength;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
}

/** Generate cryptographically secure random bytes. */
export function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Extract a proper ArrayBuffer from a Uint8Array.
 *
 * In strict TypeScript, `Uint8Array.buffer` is typed as
 * `ArrayBufferLike` (which includes `SharedArrayBuffer`),
 * making it incompatible with Web Crypto APIs that require
 * `BufferSource`.  This helper copies into a fresh ArrayBuffer
 * to satisfy the type constraint.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}
