import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  fromBase64Url,
  getRandomBytes,
  toBase64Url,
} from './base64url.js';
import { decrypt, encrypt } from './crypto.js';

// A valid 256-bit key (64 hex chars)
const TEST_KEY = bytesToHex(getRandomBytes(32));

describe('encrypt', () => {
  it('should return a base64url-encoded string', async () => {
    const result = await encrypt('hello', TEST_KEY);
    // base64url uses only [A-Za-z0-9_-] characters
    expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should produce different ciphertext for the same input (random IV)', async () => {
    const a = await encrypt('same data', TEST_KEY);
    const b = await encrypt('same data', TEST_KEY);
    expect(a).not.toBe(b);
  });
});

describe('decrypt', () => {
  it('should return null for empty string input', async () => {
    expect(await decrypt('', TEST_KEY)).toBeNull();
  });

  it('should return null for invalid base64 input', async () => {
    expect(await decrypt('!!!invalid!!!', TEST_KEY)).toBeNull();
  });

  it('should return null for data shorter than IV + auth tag', async () => {
    // IV_LENGTH(12) + AUTH_TAG_LENGTH(16) = 28 bytes minimum
    const tooShort = toBase64Url(new Uint8Array(20));
    expect(await decrypt(tooShort, TEST_KEY)).toBeNull();
  });

  it('should return null when ciphertext is tampered', async () => {
    const encrypted = await encrypt('secret', TEST_KEY);
    const buf = fromBase64Url(encrypted);
    // Flip a byte in the encrypted portion (after IV + auth tag = 28 bytes)
    if (buf.length > 28) {
      buf[28] = (buf[28] ?? 0) ^ 0xff;
    }
    const tampered = toBase64Url(buf);
    expect(await decrypt(tampered, TEST_KEY)).toBeNull();
  });

  it('should return null when auth tag is tampered', async () => {
    const encrypted = await encrypt('secret', TEST_KEY);
    const buf = fromBase64Url(encrypted);
    // Flip a byte in the auth tag region (bytes 12-27)
    buf[12] = (buf[12] ?? 0) ^ 0xff;
    const tampered = toBase64Url(buf);
    expect(await decrypt(tampered, TEST_KEY)).toBeNull();
  });

  it('should return null for a wrong key', async () => {
    const encrypted = await encrypt('secret', TEST_KEY);
    const wrongKey = bytesToHex(getRandomBytes(32));
    expect(await decrypt(encrypted, wrongKey)).toBeNull();
  });
});

describe('encrypt and decrypt roundtrip', () => {
  it('should roundtrip a simple string', async () => {
    const plaintext = 'hello world';
    const encrypted = await encrypt(plaintext, TEST_KEY);
    expect(await decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('should roundtrip an empty string', async () => {
    const encrypted = await encrypt('', TEST_KEY);
    expect(await decrypt(encrypted, TEST_KEY)).toBe('');
  });

  it('should roundtrip unicode / multi-byte characters', async () => {
    const plaintext = 'こんにちは 🌍 émojis';
    const encrypted = await encrypt(plaintext, TEST_KEY);
    expect(await decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('should roundtrip a large payload', async () => {
    const plaintext = 'x'.repeat(100_000);
    const encrypted = await encrypt(plaintext, TEST_KEY);
    expect(await decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('should roundtrip JSON session data', async () => {
    const sessionData = JSON.stringify({
      user: { id: 'usr_123', authenticated_at: 1700000000 },
      oauth: {
        state: 'abc',
        codeVerifier: 'def',
        providerId: 'google',
        mode: 'login',
      },
    });
    const encrypted = await encrypt(sessionData, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(sessionData);
    expect(JSON.parse(decrypted ?? '{}')).toEqual(JSON.parse(sessionData));
  });

  it('should roundtrip with special characters', async () => {
    const plaintext = 'key=value&foo=bar<script>alert(1)</script>';
    const encrypted = await encrypt(plaintext, TEST_KEY);
    expect(await decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });
});
