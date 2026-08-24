import { describe, expect, test } from 'vitest';
import {
  type IssuaryRuntimeConfig,
  IssuaryRuntimeConfigSchema,
} from '../lib/config/index.ts';
import { MINIMAL_TEST_CONFIG } from '../test-utils/setup.ts';
import { SecurityService } from './security.service.ts';

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
  });

  test('does not verify hashes across different instances', async () => {
    const first = createService();
    const second = createService({
      session_secret:
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      hash_secret: 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA',
      pbkdf2_iterations: 1000,
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

    expect(firstHash).toMatch(/^hmac-sha256\$v=1\$h=/);
    expect(firstHash).toBe(repeatedHash);
    expect(firstHash).not.toBe(rotatedHash);
  });
});
