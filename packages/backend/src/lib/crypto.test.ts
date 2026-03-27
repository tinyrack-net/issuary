import { describe, expect, it, test } from 'vitest';
import {
  bytesToHex,
  fromBase64Url,
  getRandomBytes,
  stringToBytes,
  toBase64Url,
} from './base64url.ts';
import {
  decrypt,
  derivePbkdf2Bytes,
  derivePurposeKeyBytes,
  encrypt,
  formatOpaqueHash,
  formatPbkdf2Hash,
  normalizeSecret,
  parsePbkdf2Hash,
  signOpaqueValue,
  timingSafeEqualBytes,
} from './crypto.ts';

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

// ---------------------------------------------------------------------------
// timingSafeEqualBytes
// ---------------------------------------------------------------------------

describe('timingSafeEqualBytes', () => {
  test('returns true for identical arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(timingSafeEqualBytes(a, b)).toBe(true);
  });

  test('returns false for different-length arrays', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(timingSafeEqualBytes(a, b)).toBe(false);
  });

  test('returns false for same-length different-content arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(timingSafeEqualBytes(a, b)).toBe(false);
  });

  test('returns true for empty arrays', () => {
    const a = new Uint8Array([]);
    const b = new Uint8Array([]);
    expect(timingSafeEqualBytes(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Secret hashing (PBKDF2 / HMAC)
// ---------------------------------------------------------------------------

const TEST_MASTER_SECRET = fromBase64Url(
  'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
);

const PBKDF2_ALGORITHM = 'pbkdf2-sha256';
const HMAC_ALGORITHM = 'hmac-sha256';
const HKDF_CONTEXT = 'tinyauth-hash-master-v1';
const DERIVED_KEY_BYTES = 32;

describe('normalizeSecret', () => {
  test('NFC normalization produces consistent bytes for equivalent inputs', () => {
    const precomposed = normalizeSecret('caf\u00e9');
    const decomposed = normalizeSecret('cafe\u0301');

    expect(precomposed).toEqual(decomposed);
  });

  test('returns UTF-8 encoded bytes', () => {
    const result = normalizeSecret('abc');
    expect(result).toEqual(stringToBytes('abc'));
  });
});

describe('parsePbkdf2Hash / formatPbkdf2Hash', () => {
  test('round-trips correctly', () => {
    const salt = new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    const digest = new Uint8Array(32).fill(42);
    const formatted = formatPbkdf2Hash({
      algorithm: PBKDF2_ALGORITHM,
      version: 1,
      iterations: 100000,
      salt,
      digest,
    });
    const parsed = parsePbkdf2Hash(formatted, PBKDF2_ALGORITHM);

    expect(parsed).toBeDefined();
    expect(parsed?.iterations).toBe(100000);
    expect(parsed?.version).toBe(1);
    expect(parsed?.salt).toEqual(salt);
    expect(parsed?.digest).toEqual(digest);
  });

  test('rejects empty string', () => {
    expect(parsePbkdf2Hash('', PBKDF2_ALGORITHM)).toBeUndefined();
  });

  test('rejects wrong algorithm prefix', () => {
    expect(
      parsePbkdf2Hash('argon2id$v=1$i=1000$s=abc$h=def', PBKDF2_ALGORITHM),
    ).toBeUndefined();
  });

  test('rejects missing segments', () => {
    expect(
      parsePbkdf2Hash('pbkdf2-sha256$v=1', PBKDF2_ALGORITHM),
    ).toBeUndefined();
  });

  test('rejects invalid base64url in salt or digest', () => {
    expect(
      parsePbkdf2Hash(
        'pbkdf2-sha256$v=1$i=1000$s=!!!invalid$h=!!!invalid',
        PBKDF2_ALGORITHM,
      ),
    ).toBeUndefined();
  });
});

describe('formatOpaqueHash', () => {
  test('produces the expected format', () => {
    const digest = new Uint8Array(32).fill(7);
    const result = formatOpaqueHash({
      algorithm: HMAC_ALGORITHM,
      version: 1,
      digest,
    });

    expect(result).toMatch(/^hmac-sha256\$v=1\$h=/);
  });
});

describe('derivePurposeKeyBytes', () => {
  test('same inputs produce same output', async () => {
    const key1 = await derivePurposeKeyBytes(
      crypto,
      TEST_MASTER_SECRET,
      HKDF_CONTEXT,
      'password-v1',
      DERIVED_KEY_BYTES,
    );
    const key2 = await derivePurposeKeyBytes(
      crypto,
      TEST_MASTER_SECRET,
      HKDF_CONTEXT,
      'password-v1',
      DERIVED_KEY_BYTES,
    );

    expect(key1).toEqual(key2);
  });

  test('different info strings produce different keys', async () => {
    const passwordKey = await derivePurposeKeyBytes(
      crypto,
      TEST_MASTER_SECRET,
      HKDF_CONTEXT,
      'password-v1',
      DERIVED_KEY_BYTES,
    );
    const clientSecretKey = await derivePurposeKeyBytes(
      crypto,
      TEST_MASTER_SECRET,
      HKDF_CONTEXT,
      'client-secret-v1',
      DERIVED_KEY_BYTES,
    );

    expect(passwordKey).not.toEqual(clientSecretKey);
  });
});

describe('derivePbkdf2Bytes', () => {
  test('deterministic with same inputs', async () => {
    const purposeKey = await derivePurposeKeyBytes(
      crypto,
      TEST_MASTER_SECRET,
      HKDF_CONTEXT,
      'password-v1',
      DERIVED_KEY_BYTES,
    );
    const salt = new Uint8Array(16).fill(1);

    const result1 = await derivePbkdf2Bytes(
      crypto,
      purposeKey,
      'test-secret',
      salt,
      1000,
      DERIVED_KEY_BYTES,
    );
    const result2 = await derivePbkdf2Bytes(
      crypto,
      purposeKey,
      'test-secret',
      salt,
      1000,
      DERIVED_KEY_BYTES,
    );

    expect(result1).toEqual(result2);
  });
});

describe('signOpaqueValue', () => {
  test('deterministic with same inputs', async () => {
    const purposeKey = await derivePurposeKeyBytes(
      crypto,
      TEST_MASTER_SECRET,
      HKDF_CONTEXT,
      'oauth-code-v1',
      DERIVED_KEY_BYTES,
    );

    const sig1 = await signOpaqueValue(crypto, purposeKey, 'some-token');
    const sig2 = await signOpaqueValue(crypto, purposeKey, 'some-token');

    expect(sig1).toEqual(sig2);
  });
});
