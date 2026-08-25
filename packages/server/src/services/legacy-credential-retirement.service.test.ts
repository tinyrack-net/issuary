import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { IssuaryRuntimeConfigSchema } from '../lib/config/index.ts';
import { createLogger } from '../lib/logger.ts';
import {
  createTestApp,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';
import { LegacyCredentialRetirementService } from './legacy-credential-retirement.service.ts';

const LEGACY_PASSWORD_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=4mV_6YDQh9NV944YrmvTGZdp0EOyT-ZPwJGqSTnkS04';
const LEGACY_CLIENT_SECRET_HASH =
  'pbkdf2-sha256$v=1$i=1000$s=MDEyMzQ1Njc4OWFiY2RlZg$h=GrZeZmD7qg6eQEyybxBo5CbbX3nwcJ_tQKgV8eGFlYE';
const LEGACY_OPAQUE_HASH =
  'hmac-sha256$v=1$h=6NAtbopii9BEIun9Jb5LbKICKIYOEn76OD47-7a_cNs';

describe('LegacyCredentialRetirementService', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp(MINIMAL_TEST_CONFIG);
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('retires every v1 credential category without authenticating the user', async () => {
    const email = generateUniqueEmail('legacy-retirement');
    const { userSub, clientId } = await withMikroContext(services, async () => {
      const user = services.mikro.user.create({
        email,
        password_hash: LEGACY_PASSWORD_HASH,
      });
      user.email_verified = true;
      const client = services.mikro.oauthClient.create({
        clientId: `legacy-${crypto.randomUUID()}`,
        clientSecretHash: LEGACY_CLIENT_SECRET_HASH,
        name: 'Legacy client',
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        scopes: ['openid'],
        redirectUris: ['https://client.example/callback'],
        enabled: true,
        managed_by: 'database',
      });
      const recoveryCode = services.mikro.userTotpRecoveryCode.create({
        user: user.sub,
        code_hash: LEGACY_OPAQUE_HASH,
      });
      const oauthCode = services.mikro.oauthCode.create({
        codeHash: LEGACY_OPAQUE_HASH,
        client,
        user: user.sub,
        redirectUri: 'https://client.example/callback',
        scope: ['openid'],
        nonce: 'nonce',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        expiredAt: new Date(Date.now() + 60_000),
        consumedAt: null,
        authTime: null,
      });
      const deviceCode = services.mikro.oauthDeviceCode.create({
        deviceCodeHash: LEGACY_OPAQUE_HASH,
        userCodeHash: `${LEGACY_OPAQUE_HASH}-user`,
        client,
        scope: ['openid'],
        expiresAt: new Date(Date.now() + 60_000),
        authorizedUser: null,
        authorizedAt: null,
        deniedAt: null,
        lastPolledAt: null,
        pollIntervalSeconds: 5,
        consumedAt: null,
      });
      await services.mikro.em
        .persist([user, client, recoveryCode, oauthCode, deviceCode])
        .flush();
      return { userSub: user.sub, clientId: client.clientId };
    });

    const config = IssuaryRuntimeConfigSchema.parse({
      ...MINIMAL_TEST_CONFIG,
      security: {
        ...MINIMAL_TEST_CONFIG.security,
        retire_legacy_v1_credentials: true,
      },
    });
    const retirement = new LegacyCredentialRetirementService(
      config,
      services.mikro,
      createLogger({ logging: { level: 'silent' } }),
    );

    await expect(retirement.count()).resolves.toEqual({
      passwords: 1,
      clientSecrets: 1,
      recoveryCodes: 1,
      oauthCodes: 1,
      deviceCodes: 1,
    });
    await expect(retirement.retireIfEnabled()).resolves.toEqual({
      passwords: 0,
      clientSecrets: 0,
      recoveryCodes: 0,
      oauthCodes: 0,
      deviceCodes: 0,
    });
    await expect(retirement.countPasswordResetRequired()).resolves.toBe(1);
    await expect(retirement.retireIfEnabled()).resolves.toEqual({
      passwords: 0,
      clientSecrets: 0,
      recoveryCodes: 0,
      oauthCodes: 0,
      deviceCodes: 0,
    });

    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ sub: userSub });
      await services.mikro.em.populate(user, ['password_hash']);
      expect(user.password_hash).toBeNull();
      expect(user.password_reset_required).toBe(true);

      const client = await services.mikro.oauthClient.findOneOrFail({
        clientId,
      });
      await services.mikro.em.populate(client, ['clientSecretHash']);
      expect(client.enabled).toBe(false);
      expect(client.clientSecretHash).toBe('retired-legacy-v1-client-secret');
      expect(await services.mikro.userTotpRecoveryCode.count()).toBe(0);
      expect(await services.mikro.oauthCode.count()).toBe(0);
      expect(await services.mikro.oauthDeviceCode.count()).toBe(0);
    });

    await expect(
      withMikroContext(services, () =>
        services.passwordAuthService.authenticateByEmailAndPassword({
          email,
          password: 'legacy password',
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' });

    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({ sub: userSub });
      user.managed_by = 'config';
      user.password_hash = LEGACY_PASSWORD_HASH;
      await services.mikro.em.flush();
    });
    await expect(retirement.retireIfEnabled()).rejects.toThrow(
      'Config-managed users still have v1 password hashes',
    );
  });
});
