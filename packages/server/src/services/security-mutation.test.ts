import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { BootstrapStateEntitySchema } from '../entities/bootstrap-state.entity.js';
import { UserEntity } from '../entities/user.entity.js';
import { IssuaryRuntimeConfigSchema } from '../lib/config/index.js';
import { seedConfigIfNeeded } from '../seeders/config.seeder.js';
import {
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
} from '../test-utils/fixtures.js';
import { withMikroContext } from '../test-utils/helpers.js';
import { securityProcessConfig } from '../test-utils/security-process-config.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';
import { withUserSecurity } from './user-security.service.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    database: process.env['SECURITY_POSTGRES_PORT']
      ? securityProcessConfig(
          `/tmp/security-mutation-${crypto.randomUUID()}/test.sqlite`,
        ).database
      : MINIMAL_TEST_CONFIG.database,
    users: [TEST_USER_CONFIG],
    auth: {
      password: {
        two_factor: { enrollment_required: true },
        totp: { enabled: true },
      },
    },
  });
});
afterAll(async () => {
  await server.cleanup();
});

test('rejecting last-factor removal does not consume its OTP', async () => {
  await withMikroContext(server.services, async () => {
    const user = server.services.mikro.user.create({
      email: 'rollback@example.test',
      password_hash: 'fixture',
    });
    const secret = server.services.totpService.generateSecret();
    const totp = server.services.mikro.userTotp.create({
      user,
      secret,
      verified: true,
      recovery_confirmed: true,
    });
    await server.services.mikro.em.persist([user, totp]).flush();
    const code = server.services.totpService.generateToken(secret);
    await expect(
      server.services.totpService.disable(user.sub, code),
    ).rejects.toThrow();
    await expect(
      server.services.totpService.verifyForAuth(user.sub, code),
    ).resolves.toBeUndefined();
  });
});

test('config role changes invalidate authentication, unchanged synchronization does not', async () => {
  const config = server.services.config;
  const before = await withMikroContext(
    server.services,
    async () =>
      (
        await server.services.mikro.user.findOneOrFail({
          sub: TEST_USER_CONFIG.sub,
        })
      ).token_epoch,
  );
  await seedConfigIfNeeded(
    server.services.mikro.orm.em.fork(),
    { ...config, users: [{ ...TEST_USER_CONFIG, role: 'user' }] },
    server.services.securityService,
    'always',
  );
  const after = await withMikroContext(
    server.services,
    async () =>
      (
        await server.services.mikro.user.findOneOrFail({
          sub: TEST_USER_CONFIG.sub,
        })
      ).token_epoch,
  );
  expect(after).not.toBe(before);
  await seedConfigIfNeeded(
    server.services.mikro.orm.em.fork(),
    { ...config, users: [{ ...TEST_USER_CONFIG, role: 'user' }] },
    server.services.securityService,
    'always',
  );
  await withMikroContext(server.services, async () => {
    expect(
      (
        await server.services.mikro.user.findOneOrFail({
          sub: TEST_USER_CONFIG.sub,
        })
      ).token_epoch,
    ).toBe(after);
  });
});

test('removed and reintroduced config users cannot regain the previous token generation', async () => {
  const config = server.services.config;
  const read = () =>
    withMikroContext(server.services, () =>
      server.services.mikro.user.findOneOrFail(
        { sub: TEST_USER_CONFIG.sub },
        { populate: ['password_hash'] },
      ),
    );
  const before = await read();
  const originalEpoch = before.token_epoch;
  await seedConfigIfNeeded(
    server.services.mikro.orm.em.fork(),
    { ...config, users: [] },
    server.services.securityService,
    'always',
  );
  const deleted = await read();
  expect(deleted.deleted_at).not.toBeNull();
  expect(deleted.token_epoch).not.toBe(originalEpoch);
  const deletedEpoch = deleted.token_epoch;
  await seedConfigIfNeeded(
    server.services.mikro.orm.em.fork(),
    config,
    server.services.securityService,
    'always',
  );
  const restored = await read();
  expect(restored.deleted_at).toBeNull();
  expect(restored.token_epoch).not.toBe(deletedEpoch);
  expect(restored.token_epoch).not.toBe(originalEpoch);
  const unchangedHash = restored.password_hash;
  await seedConfigIfNeeded(
    server.services.mikro.orm.em.fork(),
    config,
    server.services.securityService,
    'always',
  );
  expect((await read()).password_hash).toBe(unchangedHash);
});
test('failed security mutation rolls back both the revision and authentication state', async () => {
  await withMikroContext(server.services, async () => {
    const user = server.services.mikro.user.create({
      email: `${crypto.randomUUID()}@example.test`,
      password_hash: 'old-hash',
    });
    await server.services.mikro.em.persist(user).flush();
    await expect(
      withUserSecurity(server.services.mikro, user.sub, async (fresh) => {
        fresh.password_hash = 'new-hash';
        await server.services.mikro.em.flush();
        throw new Error('injected transaction failure');
      }),
    ).rejects.toThrow('injected transaction failure');
    const current = await server.services.mikro.em
      .fork()
      .findOneOrFail(
        UserEntity,
        { sub: user.sub },
        { populate: ['password_hash'] },
      );
    expect(current.password_hash).toBe('old-hash');
    expect(current.security_revision).toBe(0);
  });
});

test.each([
  { email: 'changed-config@example.test' },
  { password: 'changed-config-password-123' },
])('config identity change %j advances token generation', async (change) => {
  const config = server.services.config;
  const read = () =>
    withMikroContext(server.services, () =>
      server.services.mikro.user.findOneOrFail({ sub: TEST_USER_CONFIG.sub }),
    );
  const epoch = (await read()).token_epoch;
  await seedConfigIfNeeded(
    server.services.mikro.orm.em.fork(),
    { ...config, users: [{ ...TEST_USER_CONFIG, ...change }] },
    server.services.securityService,
  );
  expect((await read()).token_epoch).not.toBe(epoch);
  await seedConfigIfNeeded(
    server.services.mikro.orm.em.fork(),
    config,
    server.services.securityService,
  );
});

test('restarting partial TOTP setup removes recovery codes for the superseded secret', async () => {
  await withMikroContext(server.services, async () => {
    const user = server.services.mikro.user.create({
      email: `${crypto.randomUUID()}@example.test`,
    });
    const totp = server.services.mikro.userTotp.create({
      user,
      secret: server.services.totpService.generateSecret(),
      verified: true,
      recovery_confirmed: false,
    });
    await server.services.mikro.em.persist([user, totp]).flush();
    await server.services.totpService.generateRecoveryCodes(user);
    expect(
      await server.services.mikro.userTotpRecoveryCode.count({
        user: user.sub,
      }),
    ).toBeGreaterThan(0);
    await server.services.totpService.startSetup(user);
    expect(
      await server.services.mikro.userTotpRecoveryCode.count({
        user: user.sub,
      }),
    ).toBe(0);
  });
});

test('failed configuration synchronization rolls back user changes and completion fingerprint', async () => {
  const em = server.services.mikro.em.fork();
  const user = await em.findOneOrFail(UserEntity, {
    sub: TEST_USER_CONFIG.sub,
  });
  const state = await em.findOneOrFail(BootstrapStateEntitySchema, {
    id: 'config-seed',
  });
  const epoch = user.token_epoch;
  const fingerprint = state.value;
  const config = IssuaryRuntimeConfigSchema.parse({
    ...server.services.config,
    users: [{ ...TEST_USER_CONFIG, role: 'user' }],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });
  const failure = vi
    .spyOn(server.services.securityService, 'hashClientSecret')
    .mockRejectedValueOnce(new Error('injected synchronization failure'));
  try {
    await expect(
      seedConfigIfNeeded(em, config, server.services.securityService),
    ).rejects.toThrow('injected synchronization failure');
  } finally {
    failure.mockRestore();
  }
  const fresh = server.services.mikro.em.fork();
  expect(
    (await fresh.findOneOrFail(UserEntity, { sub: user.sub })).token_epoch,
  ).toBe(epoch);
  expect(
    (await fresh.findOneOrFail(BootstrapStateEntitySchema, { id: state.id }))
      .value,
  ).toBe(fingerprint);
});
