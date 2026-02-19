import {
  bytesToString,
  concatBytes,
  fromBase64Url,
  getRandomBytes,
  hexToBytes,
  stringToBytes,
  toArrayBuffer,
  toBase64Url,
} from './base64url.js';

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Import a hex-encoded key for AES-GCM operations
 * using the Web Crypto API.
 */
async function importAesKey(
  keyHex: string,
  usage: 'encrypt' | 'decrypt',
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(hexToBytes(keyHex)),
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
