import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto.js';

// A valid 256-bit key (64 hex chars)
const TEST_KEY = randomBytes(32).toString('hex');

describe('encrypt', () => {
  it('should return a base64url-encoded string', () => {
    const result = encrypt('hello', TEST_KEY);
    // base64url uses only [A-Za-z0-9_-] characters
    expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should produce different ciphertext for the same input (random IV)', () => {
    const a = encrypt('same data', TEST_KEY);
    const b = encrypt('same data', TEST_KEY);
    expect(a).not.toBe(b);
  });
});

describe('decrypt', () => {
  it('should return null for empty string input', () => {
    expect(decrypt('', TEST_KEY)).toBeNull();
  });

  it('should return null for invalid base64 input', () => {
    expect(decrypt('!!!invalid!!!', TEST_KEY)).toBeNull();
  });

  it('should return null for data shorter than IV + auth tag', () => {
    // IV_LENGTH(12) + AUTH_TAG_LENGTH(16) = 28 bytes minimum
    const tooShort = Buffer.alloc(20).toString('base64url');
    expect(decrypt(tooShort, TEST_KEY)).toBeNull();
  });

  it('should return null when ciphertext is tampered', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    const buf = Buffer.from(encrypted, 'base64url');
    // Flip a byte in the encrypted portion (after IV + auth tag = 28 bytes)
    if (buf.length > 28) {
      buf[28] = (buf[28] ?? 0) ^ 0xff;
    }
    const tampered = buf.toString('base64url');
    expect(decrypt(tampered, TEST_KEY)).toBeNull();
  });

  it('should return null when auth tag is tampered', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    const buf = Buffer.from(encrypted, 'base64url');
    // Flip a byte in the auth tag region (bytes 12-27)
    buf[12] = (buf[12] ?? 0) ^ 0xff;
    const tampered = buf.toString('base64url');
    expect(decrypt(tampered, TEST_KEY)).toBeNull();
  });

  it('should return null for a wrong key', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    const wrongKey = randomBytes(32).toString('hex');
    expect(decrypt(encrypted, wrongKey)).toBeNull();
  });
});

describe('encrypt and decrypt roundtrip', () => {
  it('should roundtrip a simple string', () => {
    const plaintext = 'hello world';
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('should roundtrip an empty string', () => {
    const encrypted = encrypt('', TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe('');
  });

  it('should roundtrip unicode / multi-byte characters', () => {
    const plaintext = 'こんにちは 🌍 émojis';
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('should roundtrip a large payload', () => {
    const plaintext = 'x'.repeat(100_000);
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('should roundtrip JSON session data', () => {
    const sessionData = JSON.stringify({
      user: { id: 'usr_123', authenticated_at: 1700000000 },
      oauth: {
        state: 'abc',
        codeVerifier: 'def',
        providerId: 'google',
        mode: 'login',
      },
    });
    const encrypted = encrypt(sessionData, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(sessionData);
    expect(JSON.parse(decrypted ?? '{}')).toEqual(JSON.parse(sessionData));
  });

  it('should roundtrip with special characters', () => {
    const plaintext = 'key=value&foo=bar<script>alert(1)</script>';
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });
});
