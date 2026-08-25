import { fromBase64Url } from '../lib/base64url.ts';
import type { IssuaryRuntimeConfig } from '../lib/config/index.ts';
import {
  derivePbkdf2Bytes,
  derivePurposeKeyBytes,
  formatOpaqueHash,
  formatPbkdf2Hash,
  getRandomBytes,
  parsePbkdf2Hash,
  signOpaqueValue,
  timingSafeEqualBytes,
} from '../lib/crypto.ts';

const PBKDF2_ALGORITHM = 'pbkdf2-sha256';
const HMAC_ALGORITHM = 'hmac-sha256';
const CURRENT_HASH_FORMAT_VERSION = 2;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_DERIVED_KEY_BYTES = 32;

type Pbkdf2Purpose = 'password' | 'client-secret';
export type OpaquePurpose =
  | 'oauth-code'
  | 'oauth-device-code'
  | 'oauth-device-user-code'
  | 'totp-recovery';
type Purpose = Pbkdf2Purpose | OpaquePurpose;

const HASH_POLICY = {
  context: 'auth-hash-master-v2',
  purposeLabels: {
    password: 'password-v2',
    'client-secret': 'client-secret-v2',
    'oauth-code': 'oauth-code-v2',
    'oauth-device-code': 'oauth-device-code-v2',
    'oauth-device-user-code': 'oauth-device-user-code-v2',
    'totp-recovery': 'totp-recovery-v2',
  } satisfies Record<Purpose, string>,
};

export class SecurityService {
  private readonly hashMasterSecret: Uint8Array;
  private readonly pbkdf2Iterations: number;
  private readonly purposeKeyCache = new Map<string, Promise<Uint8Array>>();

  public constructor(config: IssuaryRuntimeConfig) {
    const decodedSecret = fromBase64Url(config.security.hash_secret);
    if (decodedSecret.length !== 32) {
      throw new Error('security.hash_secret must decode to 32 bytes.');
    }

    this.hashMasterSecret = decodedSecret;
    this.pbkdf2Iterations = config.security.pbkdf2_iterations;
  }

  private async resolvePurposeKey(purpose: Purpose): Promise<Uint8Array> {
    const cached = this.purposeKeyCache.get(purpose);
    if (cached) {
      return cached;
    }

    const derivation = derivePurposeKeyBytes(
      globalThis.crypto,
      this.hashMasterSecret,
      HASH_POLICY.context,
      HASH_POLICY.purposeLabels[purpose],
      PBKDF2_DERIVED_KEY_BYTES,
    );
    this.purposeKeyCache.set(purpose, derivation);
    return derivation;
  }

  private async hashPbkdf2Secret(
    purpose: Pbkdf2Purpose,
    secret: string,
  ): Promise<string> {
    const crypto = globalThis.crypto;
    const purposeKey = await this.resolvePurposeKey(purpose);
    const salt = getRandomBytes(PBKDF2_SALT_BYTES);
    const digest = await derivePbkdf2Bytes(
      crypto,
      purposeKey,
      secret,
      salt,
      this.pbkdf2Iterations,
      PBKDF2_DERIVED_KEY_BYTES,
    );

    return formatPbkdf2Hash({
      algorithm: PBKDF2_ALGORITHM,
      version: CURRENT_HASH_FORMAT_VERSION,
      iterations: this.pbkdf2Iterations,
      salt,
      digest,
    });
  }

  private async verifyPbkdf2Secret(
    purpose: Pbkdf2Purpose,
    hash: string,
    secret: string,
  ): Promise<boolean> {
    const parsed = parsePbkdf2Hash(hash, PBKDF2_ALGORITHM);

    if (!parsed || parsed.version !== CURRENT_HASH_FORMAT_VERSION) {
      return false;
    }

    const crypto = globalThis.crypto;
    const purposeKey = await this.resolvePurposeKey(purpose);
    const derived = await derivePbkdf2Bytes(
      crypto,
      purposeKey,
      secret,
      parsed.salt,
      parsed.iterations,
      PBKDF2_DERIVED_KEY_BYTES,
    );

    return timingSafeEqualBytes(derived, parsed.digest);
  }

  public async hashPassword(password: string): Promise<string> {
    return this.hashPbkdf2Secret('password', password);
  }

  public async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    return this.verifyPbkdf2Secret('password', hash, password);
  }

  public async hashClientSecret(clientSecret: string): Promise<string> {
    return this.hashPbkdf2Secret('client-secret', clientSecret);
  }

  public async verifyClientSecret(
    hash: string,
    clientSecret: string,
  ): Promise<boolean> {
    return this.verifyPbkdf2Secret('client-secret', hash, clientSecret);
  }

  public async hashOpaqueToken(
    purpose: OpaquePurpose,
    value: string,
  ): Promise<string> {
    const crypto = globalThis.crypto;
    const purposeKey = await this.resolvePurposeKey(purpose);
    const digest = await signOpaqueValue(crypto, purposeKey, value);
    return formatOpaqueHash({
      algorithm: HMAC_ALGORITHM,
      version: CURRENT_HASH_FORMAT_VERSION,
      digest,
    });
  }
}
