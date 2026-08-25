import { describe, expect, test } from 'vitest';
import {
  type IssuaryRuntimeConfig,
  IssuaryRuntimeConfigSchema,
} from '../lib/config/index.ts';
import { MINIMAL_TEST_CONFIG } from '../test-utils/setup.ts';
import { SecurityService } from './security.service.ts';

const LEGACY_PASSWORD_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=4mV_6YDQh9NV944YrmvTGZdp0EOyT-ZPwJGqSTnkS04';
const LEGACY_CLIENT_SECRET_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=GrZeZmD7qg6eQEyybxBo5CbbX3nwcJ_tQKgV8eGFlYE';
const LEGACY_RECOVERY_CODE_HASH =
  'hmac-sha256$v=1$h=6NAtbopii9BEIun9Jb5LbKICKIYOEn76OD47-7a_cNs';
const REBRAND_V1_PASSWORD_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=QUPCide7e7lSw4HdLzfD2Sf5BIEmuJJu9oDDt4E7Tvw';
const REBRAND_V1_CLIENT_SECRET_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=sTgLsy6rqmcv_YwTpq68TrA6W3PUL-Xdn_wbKp5wzXU';
const REBRAND_V1_RECOVERY_CODE_HASH =
  'hmac-sha256$v=1$h=vHAjguKWT3npnulnlUISG11NXO_BRV3Azr13Mr0aJ4c';

function createService(
  securityOverride?: IssuaryRuntimeConfig['security'],
): SecurityService {
  const config = IssuaryRuntimeConfigSchema.parse({
    ...MINIMAL_TEST_CONFIG,
    ...(securityOverride ? { security: securityOverride } : {}),
  });
  return new SecurityService(config);
}

describe('SecurityService', () => {
  test('hashes and verifies passwords', async () => {
    const service = createService();
    const hash = await service.hashPassword('correct horse battery staple');

    await expect(
      service.verifyPassword(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(service.verifyPassword(hash, 'wrong password')).resolves.toBe(
      false,
    );
    expect(hash).toMatch(/^pbkdf2-sha256\$v=2\$/);
  });

  test('verifies legacy v1 password and client-secret fixtures for rehash', async () => {
    const service = createService();

    await expect(
      service.verifyPasswordAndCheckRehash(
        LEGACY_PASSWORD_HASH,
        'legacy password',
      ),
    ).resolves.toEqual({ valid: true, needsRehash: true });
    await expect(
      service.verifyClientSecretAndCheckRehash(
        LEGACY_CLIENT_SECRET_HASH,
        'legacy client secret',
      ),
    ).resolves.toEqual({ valid: true, needsRehash: true });
    await expect(
      service.verifyPasswordAndCheckRehash(LEGACY_PASSWORD_HASH, 'wrong'),
    ).resolves.toEqual({ valid: false, needsRehash: false });
  });

  test('verifies ambiguous Issuary 0.21.0 v1 fixtures for rehash', async () => {
    const service = createService();

    await expect(
      service.verifyPasswordAndCheckRehash(
        REBRAND_V1_PASSWORD_HASH,
        'rebrand password',
      ),
    ).resolves.toEqual({ valid: true, needsRehash: true });
    await expect(
      service.verifyClientSecretAndCheckRehash(
        REBRAND_V1_CLIENT_SECRET_HASH,
        'rebrand client secret',
      ),
    ).resolves.toEqual({ valid: true, needsRehash: true });
  });

  test('does not verify hashes across different instances', async () => {
    const first = createService();
    const second = createService({
      session_secret:
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      hash_secret: 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA',
      pbkdf2_iterations: 1000,
      retire_legacy_v1_credentials: false,
    });
    const hash = await first.hashPassword('secret password');

    await expect(second.verifyPassword(hash, 'secret password')).resolves.toBe(
      false,
    );
  });

  test('rejects malformed and removed legacy password hash formats', async () => {
    const service = createService();

    await expect(
      service.verifyPassword(
        'pbkdf2-sha256$v=1$i=1000$pv=1$s=Zm9v$h=YmFy',
        'secret password',
      ),
    ).resolves.toBe(false);

    await expect(
      service.verifyPassword(
        'pbkdf2-sha256$v=1$i=1000$s=not-base64$h=still-not-base64',
        'secret password',
      ),
    ).resolves.toBe(false);

    await expect(
      service.verifyPassword(
        'argon2id$v=19$m=65536,t=3,p=4$abc$def',
        'secret password',
      ),
    ).resolves.toBe(false);
  });

  test('same password hashed twice produces different outputs', async () => {
    const service = createService();
    const hash1 = await service.hashPassword('identical password');
    const hash2 = await service.hashPassword('identical password');

    expect(hash1).not.toBe(hash2);
  });

  test('hashClientSecret and verifyClientSecret round-trip', async () => {
    const service = createService();
    const clientSecret = 'my-super-secret-client-value';
    const hash = await service.hashClientSecret(clientSecret);

    await expect(service.verifyClientSecret(hash, clientSecret)).resolves.toBe(
      true,
    );
    await expect(
      service.verifyClientSecret(hash, 'wrong-secret'),
    ).resolves.toBe(false);
  });

  test('same value with different purposes produces different hashes', async () => {
    const service = createService();
    const value = 'shared-value-across-purposes';
    const passwordHash = await service.hashPassword(value);
    const clientSecretHash = await service.hashClientSecret(value);

    expect(passwordHash).not.toBe(clientSecretHash);
  });

  test('unicode NFC normalization (cafe\u0301 vs caf\u00e9)', async () => {
    const service = createService();
    const precomposed = 'caf\u00e9';
    const decomposed = 'cafe\u0301';
    const hash = await service.hashPassword(precomposed);

    await expect(service.verifyPassword(hash, decomposed)).resolves.toBe(true);
  });

  test('malformed hash strings return false without throwing', async () => {
    const service = createService();

    await expect(service.verifyPassword('', 'password')).resolves.toBe(false);
    await expect(
      service.verifyPassword('only-one-segment', 'password'),
    ).resolves.toBe(false);
    await expect(
      service.verifyPassword('random$garbage$that$is$not$valid', 'password'),
    ).resolves.toBe(false);
  });

  test('hashes opaque tokens deterministically for one key and differently across keys', async () => {
    const first = createService();
    const second = createService({
      session_secret:
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      hash_secret: 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA',
      pbkdf2_iterations: 1000,
      retire_legacy_v1_credentials: false,
    });

    const firstHash = await first.hashOpaqueToken(
      'totp-recovery',
      'ABCD-EFGH-JKLM-NPQR',
    );
    const repeatedHash = await first.hashOpaqueToken(
      'totp-recovery',
      'ABCD-EFGH-JKLM-NPQR',
    );
    const rotatedHash = await second.hashOpaqueToken(
      'totp-recovery',
      'ABCD-EFGH-JKLM-NPQR',
    );

    expect(firstHash).toMatch(/^hmac-sha256\$v=2\$h=/);
    expect(firstHash).toBe(repeatedHash);
    expect(firstHash).not.toBe(rotatedHash);
  });

  test('returns current and legacy opaque hash lookup candidates', async () => {
    const service = createService();
    const candidates = await service.hashOpaqueTokenCandidates(
      'totp-recovery',
      'ABCD-EFGH-JKLM-NPQR',
    );

    expect(candidates[0]).toMatch(/^hmac-sha256\$v=2\$h=/);
    expect(candidates).toContain(LEGACY_RECOVERY_CODE_HASH);

    const rebrandCandidates = await service.hashOpaqueTokenCandidates(
      'totp-recovery',
      'WXYZ-2345-6789-ABCD',
    );
    expect(rebrandCandidates).toContain(REBRAND_V1_RECOVERY_CODE_HASH);
  });
});
