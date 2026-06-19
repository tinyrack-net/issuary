import {
  bytesToString,
  concatBytes,
  fromBase64Url,
  getRandomBytes,
  hexToBytes,
  stringToBytes,
  toArrayBuffer,
  toBase64Url,
} from './base64url.ts';

export { getRandomBytes } from './base64url.ts';

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Import a hex-encoded key for AES-GCM operations
 * using the Web Crypto API.
 *
 * @throws {Error} if the key is not valid hex or decodes to an
 *   unsupported AES key length (must be 16, 24, or 32 bytes).
 */
async function importAesKey(
  keyHex: string,
  usage: 'encrypt' | 'decrypt',
): Promise<CryptoKey> {
  if (!/^[0-9a-fA-F]*$/.test(keyHex) || keyHex.length % 2 !== 0) {
    throw new Error(
      'session_secret must be a valid hex string with an even number of characters',
    );
  }
  const keyBytes = hexToBytes(keyHex);
  if (![16, 24, 32].includes(keyBytes.byteLength)) {
    throw new Error(
      `session_secret must decode to 16, 24, or 32 bytes for AES-128/192/256, got ${keyBytes.byteLength} bytes (${keyHex.length} hex characters)`,
    );
  }
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: ALGORITHM },
    false,
    [usage],
  );
}

export async function encrypt(data: string, keyHex: string): Promise<string> {
  const key = await importAesKey(keyHex, 'encrypt');
  const iv = getRandomBytes(IV_LENGTH);
  const plaintext = stringToBytes(data);

  // Web Crypto AES-GCM appends the auth tag to the ciphertext
  const cipherWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: toArrayBuffer(iv),
        tagLength: AUTH_TAG_LENGTH * 8,
      },
      key,
      toArrayBuffer(plaintext),
    ),
  );

  // Split into ciphertext and auth tag to keep the same wire format:
  // base64url(iv + authTag + encrypted)
  const encrypted = cipherWithTag.slice(
    0,
    cipherWithTag.byteLength - AUTH_TAG_LENGTH,
  );
  const authTag = cipherWithTag.slice(
    cipherWithTag.byteLength - AUTH_TAG_LENGTH,
  );

  const combined = concatBytes(iv, authTag, encrypted);
  return toBase64Url(combined);
}

export async function decrypt(
  encoded: string,
  keyHex: string,
): Promise<string | null> {
  try {
    const key = await importAesKey(keyHex, 'decrypt');
    const combined = fromBase64Url(encoded);
    if (combined.byteLength < IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }
    const iv = combined.slice(0, IV_LENGTH);
    const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    // Web Crypto expects ciphertext + authTag concatenated
    const cipherWithTag = concatBytes(encrypted, authTag);

    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv: toArrayBuffer(iv),
          tagLength: AUTH_TAG_LENGTH * 8,
        },
        key,
        toArrayBuffer(cipherWithTag),
      ),
    );
    return bytesToString(plaintext);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Timing-safe comparison
// ---------------------------------------------------------------------------

/**
 * Compares two byte arrays in constant time to prevent timing side-channel attacks.
 *
 * Returns `false` immediately if the arrays differ in length, but the byte-level
 * comparison always processes every element to avoid leaking positional information.
 *
 * @param left - The first byte array.
 * @param right - The second byte array.
 * @returns `true` if both arrays contain identical bytes, `false` otherwise.
 */
export function timingSafeEqualBytes(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftByte = left[index];
    const rightByte = right[index];

    if (leftByte === undefined || rightByte === undefined) {
      return false;
    }

    diff |= leftByte ^ rightByte;
  }

  return diff === 0;
}

// ---------------------------------------------------------------------------
// Secret hashing (PBKDF2 / HMAC)
// ---------------------------------------------------------------------------

/**
 * Parses an integer key=value segment from the self-describing hash format.
 *
 * @example parseIntegerSegment('v=1', 'v') // => 1
 */
function parseIntegerSegment(segment: string, key: string): number | undefined {
  if (!segment.startsWith(`${key}=`)) {
    return undefined;
  }

  const value = Number(segment.slice(key.length + 1));
  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }

  return value;
}

/**
 * Parses a string key=value segment from the self-describing hash format.
 *
 * @example parseStringSegment('s=Zm9v', 's') // => 'Zm9v'
 */
function parseStringSegment(segment: string, key: string): string | undefined {
  if (!segment.startsWith(`${key}=`)) {
    return undefined;
  }

  return segment.slice(key.length + 1);
}

/**
 * Parses a persisted PBKDF2 hash string into its constituent parameters.
 *
 * The expected format is: `<algorithm>$v=<version>$i=<iterations>$s=<salt>$h=<digest>`
 * where salt and digest are base64url-encoded.
 *
 * @param hash - The stored hash string to parse.
 * @param expectedAlgorithm - The algorithm identifier to match (e.g. `'pbkdf2-sha256'`).
 * @returns The parsed components, or `undefined` if the string is malformed.
 */
export function parsePbkdf2Hash(
  hash: string,
  expectedAlgorithm: string,
):
  | {
      version: number;
      iterations: number;
      salt: Uint8Array;
      digest: Uint8Array;
    }
  | undefined {
  const [
    algorithm = '',
    version = '',
    iterations = '',
    salt = '',
    digest = '',
  ] = hash.split('$');

  if (algorithm !== expectedAlgorithm) {
    return undefined;
  }

  const parsedVersion = parseIntegerSegment(version, 'v');
  const parsedIterations = parseIntegerSegment(iterations, 'i');
  const parsedSalt = parseStringSegment(salt, 's');
  const parsedDigest = parseStringSegment(digest, 'h');

  if (
    parsedVersion === undefined ||
    parsedIterations === undefined ||
    parsedSalt === undefined ||
    parsedDigest === undefined
  ) {
    return undefined;
  }

  try {
    return {
      version: parsedVersion,
      iterations: parsedIterations,
      salt: fromBase64Url(parsedSalt),
      digest: fromBase64Url(parsedDigest),
    };
  } catch {
    return undefined;
  }
}

/**
 * Encodes PBKDF2 hash parameters into a self-describing string for storage.
 *
 * @param params - The PBKDF2 parameters to encode.
 * @returns A string in the format `<algorithm>$v=<version>$i=<iterations>$s=<salt>$h=<digest>`.
 */
export function formatPbkdf2Hash(params: {
  algorithm: string;
  version: number;
  iterations: number;
  salt: Uint8Array;
  digest: Uint8Array;
}): string {
  return [
    params.algorithm,
    `v=${params.version}`,
    `i=${params.iterations}`,
    `s=${toBase64Url(params.salt)}`,
    `h=${toBase64Url(params.digest)}`,
  ].join('$');
}

/**
 * Encodes an HMAC digest into a self-describing string for opaque token storage.
 *
 * @param params - The HMAC digest to encode.
 * @returns A string in the format `<algorithm>$v=<version>$h=<digest>`.
 */
export function formatOpaqueHash(params: {
  algorithm: string;
  version: number;
  digest: Uint8Array;
}): string {
  return [
    params.algorithm,
    `v=${params.version}`,
    `h=${toBase64Url(params.digest)}`,
  ].join('$');
}

/**
 * Normalizes a secret string to Unicode NFC form and encodes it as UTF-8 bytes.
 * This ensures visually equivalent strings (e.g. `café` vs `cafe\u0301`) produce
 * identical byte sequences across all runtimes.
 *
 * @param secret - The raw secret string.
 * @returns The NFC-normalized, UTF-8-encoded byte representation.
 */
export function normalizeSecret(secret: string): Uint8Array {
  return stringToBytes(secret.normalize('NFC'));
}

/**
 * Derives a purpose-specific subkey from a master secret using HKDF-SHA-256.
 *
 * Each purpose produces a cryptographically isolated key, so compromising
 * one purpose key does not affect others.
 *
 * @param crypto - The Web Crypto API instance.
 * @param masterSecret - The 32-byte master secret.
 * @param hkdfSalt - The salt string for HKDF (e.g. application context identifier).
 * @param hkdfInfo - The info string for HKDF (e.g. purpose label).
 * @param derivedKeyBytes - The number of bytes to derive.
 * @returns A derived purpose key of the specified length.
 */
export async function derivePurposeKeyBytes(
  crypto: Crypto,
  masterSecret: Uint8Array,
  hkdfSalt: string,
  hkdfInfo: string,
  derivedKeyBytes: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(masterSecret),
    'HKDF',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(stringToBytes(hkdfSalt)),
      info: toArrayBuffer(stringToBytes(hkdfInfo)),
    },
    baseKey,
    derivedKeyBytes * 8,
  );

  return new Uint8Array(bits);
}

/**
 * Derives a PBKDF2-SHA-256 digest from a low-entropy secret (e.g. a password).
 *
 * The secret is first NFC-normalized and concatenated with the purpose key before
 * being fed into PBKDF2, binding the derivation to a specific purpose.
 *
 * @param crypto - The Web Crypto API instance.
 * @param purposeKey - The pre-derived purpose-specific key from {@link derivePurposeKeyBytes}.
 * @param secret - The raw secret string (password, client secret, etc.).
 * @param salt - A random salt (typically 16 bytes).
 * @param iterations - The PBKDF2 iteration count.
 * @param derivedKeyBytes - The number of bytes to derive.
 * @returns A derived key of the specified length.
 */
export async function derivePbkdf2Bytes(
  crypto: Crypto,
  purposeKey: Uint8Array,
  secret: string,
  salt: Uint8Array,
  iterations: number,
  derivedKeyBytes: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(concatBytes(normalizeSecret(secret), purposeKey)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: toArrayBuffer(salt),
    },
    keyMaterial,
    derivedKeyBytes * 8,
  );

  return new Uint8Array(derived);
}

/**
 * Computes an HMAC-SHA-256 signature over a high-entropy opaque value.
 *
 * Unlike PBKDF2, this is intended for values that are already cryptographically
 * random (e.g. authorization codes, recovery tokens), where deterministic hashing
 * enables efficient database lookups.
 *
 * @param crypto - The Web Crypto API instance.
 * @param purposeKey - The pre-derived purpose-specific key from {@link derivePurposeKeyBytes}.
 * @param value - The opaque value to sign.
 * @returns A 32-byte HMAC signature.
 */
export async function signOpaqueValue(
  crypto: Crypto,
  purposeKey: Uint8Array,
  value: string,
): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(purposeKey),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    toArrayBuffer(normalizeSecret(value)),
  );

  return new Uint8Array(signature);
}
