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
const LEGACY_HASH_FORMAT_VERSION = 1;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_DERIVED_KEY_BYTES = 32;

type Pbkdf2Purpose = 'password' | 'client-secret';
export type OpaquePurpose =
  | 'oauth-code'
  | 'oauth-device-code'
  | 'oauth-device-user-code'
  | 'totp-recovery';
type Purpose = Pbkdf2Purpose | OpaquePurpose;

type HashPolicyId = 'v2' | 'tinyauth-v1' | 'issuary-v1';

export interface SecretVerificationResult {
  valid: boolean;
  needsRehash: boolean;
}

const HASH_POLICIES: Record<
  HashPolicyId,
  {
    formatVersion: number;
    context: string;
    purposeLabels: Record<Purpose, string>;
  }
> = {
  'tinyauth-v1': {
    // Kept only while persisted v1 hashes still exist. Remove with v1 support.
    formatVersion: LEGACY_HASH_FORMAT_VERSION,
    context: 'tinyauth-hash-master-v1',
    purposeLabels: {
      password: 'password-v1',
      'client-secret': 'client-secret-v1',
      'oauth-code': 'oauth-code-v1',
      'oauth-device-code': 'oauth-device-code-v1',
      'oauth-device-user-code': 'oauth-device-user-code-v1',
      'totp-recovery': 'totp-recovery-v1',
    },
  },
  'issuary-v1': {
    // Issuary 0.21.0 wrote this ambiguous v1 variant after the rebrand.
    formatVersion: LEGACY_HASH_FORMAT_VERSION,
    context: 'issuary-hash-master-v1',
    purposeLabels: {
      password: 'password-v1',
      'client-secret': 'client-secret-v1',
      'oauth-code': 'oauth-code-v1',
      'oauth-device-code': 'oauth-device-code-v1',
      'oauth-device-user-code': 'oauth-device-user-code-v1',
      'totp-recovery': 'totp-recovery-v1',
    },
  },
  v2: {
    formatVersion: CURRENT_HASH_FORMAT_VERSION,
    context: 'auth-hash-master-v2',
    purposeLabels: {
      password: 'password-v2',
      'client-secret': 'client-secret-v2',
      'oauth-code': 'oauth-code-v2',
      'oauth-device-code': 'oauth-device-code-v2',
      'oauth-device-user-code': 'oauth-device-user-code-v2',
      'totp-recovery': 'totp-recovery-v2',
    },
  },
};
const CURRENT_HASH_POLICY: HashPolicyId = 'v2';
const LEGACY_HASH_POLICIES: HashPolicyId[] = ['tinyauth-v1', 'issuary-v1'];

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

  private async resolvePurposeKey(
    purpose: Purpose,
    policyId: HashPolicyId,
  ): Promise<Uint8Array> {
    const cacheKey = `${policyId}:${purpose}`;
    const cached = this.purposeKeyCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const policy = HASH_POLICIES[policyId];
    const derivation = derivePurposeKeyBytes(
      globalThis.crypto,
      this.hashMasterSecret,
      policy.context,
      policy.purposeLabels[purpose],
      PBKDF2_DERIVED_KEY_BYTES,
    );
    this.purposeKeyCache.set(cacheKey, derivation);
    return derivation;
  }

  private async hashPbkdf2Secret(
    purpose: Pbkdf2Purpose,
    secret: string,
  ): Promise<string> {
    const crypto = globalThis.crypto;
    const purposeKey = await this.resolvePurposeKey(
      purpose,
      CURRENT_HASH_POLICY,
    );
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
  ): Promise<SecretVerificationResult> {
    const parsed = parsePbkdf2Hash(hash, PBKDF2_ALGORITHM);

    if (
      !parsed ||
      (parsed.version !== CURRENT_HASH_FORMAT_VERSION &&
        parsed.version !== LEGACY_HASH_FORMAT_VERSION)
    ) {
      return { valid: false, needsRehash: false };
    }

    const crypto = globalThis.crypto;
    const policyIds =
      parsed.version === CURRENT_HASH_FORMAT_VERSION
        ? [CURRENT_HASH_POLICY]
        : LEGACY_HASH_POLICIES;

    for (const policyId of policyIds) {
      const purposeKey = await this.resolvePurposeKey(purpose, policyId);
      const derived = await derivePbkdf2Bytes(
        crypto,
        purposeKey,
        secret,
        parsed.salt,
        parsed.iterations,
        PBKDF2_DERIVED_KEY_BYTES,
      );

      if (timingSafeEqualBytes(derived, parsed.digest)) {
        return {
          valid: true,
          needsRehash: parsed.version !== CURRENT_HASH_FORMAT_VERSION,
        };
      }
    }

    return { valid: false, needsRehash: false };
  }

  public async hashPassword(password: string): Promise<string> {
    return this.hashPbkdf2Secret('password', password);
  }

  public async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    return (await this.verifyPasswordAndCheckRehash(hash, password)).valid;
  }

  public async verifyPasswordAndCheckRehash(
    hash: string,
    password: string,
  ): Promise<SecretVerificationResult> {
    return this.verifyPbkdf2Secret('password', hash, password);
  }

  public async hashClientSecret(clientSecret: string): Promise<string> {
    return this.hashPbkdf2Secret('client-secret', clientSecret);
  }

  public async verifyClientSecret(
    hash: string,
    clientSecret: string,
  ): Promise<boolean> {
    return (await this.verifyClientSecretAndCheckRehash(hash, clientSecret))
      .valid;
  }

  public async verifyClientSecretAndCheckRehash(
    hash: string,
    clientSecret: string,
  ): Promise<SecretVerificationResult> {
    return this.verifyPbkdf2Secret('client-secret', hash, clientSecret);
  }

  public async hashOpaqueToken(
    purpose: OpaquePurpose,
    value: string,
  ): Promise<string> {
    return this.hashOpaqueTokenForPolicy(purpose, value, CURRENT_HASH_POLICY);
  }

  public async hashOpaqueTokenCandidates(
    purpose: OpaquePurpose,
    value: string,
  ): Promise<string[]> {
    return Promise.all(
      [CURRENT_HASH_POLICY, ...LEGACY_HASH_POLICIES].map((policyId) =>
        this.hashOpaqueTokenForPolicy(purpose, value, policyId),
      ),
    );
  }

  private async hashOpaqueTokenForPolicy(
    purpose: OpaquePurpose,
    value: string,
    policyId: HashPolicyId,
  ): Promise<string> {
    const crypto = globalThis.crypto;
    const policy = HASH_POLICIES[policyId];
    const purposeKey = await this.resolvePurposeKey(purpose, policyId);
    const digest = await signOpaqueValue(crypto, purposeKey, value);
    return formatOpaqueHash({
      algorithm: HMAC_ALGORITHM,
      version: policy.formatVersion,
      digest,
    });
  }
}
