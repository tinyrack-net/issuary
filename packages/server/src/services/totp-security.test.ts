import { afterAll, beforeAll, expect, test } from 'vitest';
import { postgres } from '../entrypoints/database/postgres/postgres.js';
import { withMikroContext } from '../test-utils/helpers.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    ...(process.env['ISSUARY_SECURITY_TEST_PG_PORT']
      ? {
          database: postgres({
            host: '127.0.0.1',
            port: Number(process.env['ISSUARY_SECURITY_TEST_PG_PORT']),
            user: 'security_test',
            password: '',
            name: 'issuary_totp_security_test',
            driverOptions: { ssl: false },
          }),
        }
      : {}),
  });
});
afterAll(async () => {
  await server.cleanup();
});

async function fixture() {
  return withMikroContext(server.services, async () => {
    const user = server.services.mikro.user.create({
      email: `${crypto.randomUUID()}@example.test`,
    });
    const secret = server.services.totpService.generateSecret();
    const totp = server.services.mikro.userTotp.create({
      user,
      secret,
      verified: true,
      recovery_confirmed: true,
    });
    await server.services.mikro.em.persist([user, totp]).flush();
    const codes = await server.services.totpService.generateRecoveryCodes(user);
    const code = codes[0];
    if (!code) throw new Error('Missing fixture recovery code');
    return { sub: user.sub, secret, code };
  });
}

test('an accepted TOTP cannot authenticate a second session in the same time step', async () => {
  const { sub, secret } = await fixture();
  const token = server.services.totpService.generateToken(secret);
  await withMikroContext(server.services, () =>
    server.services.totpService.verifyForAuth(sub, token),
  );
  await expect(
    withMikroContext(server.services, () =>
      server.services.totpService.verifyForAuth(sub, token),
    ),
  ).rejects.toThrow();
});

test('only one concurrent request can consume a recovery code', async () => {
  const { sub, code } = await fixture();
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      withMikroContext(server.services, () =>
        server.services.totpService.verifyRecoveryCode(sub, code),
      ),
    ),
  );
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
});

test('only one concurrent request can consume a TOTP', async () => {
  const { sub, secret } = await fixture();
  const token = server.services.totpService.generateToken(secret);
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      withMikroContext(server.services, () =>
        server.services.totpService.verifyForAuth(sub, token),
      ),
    ),
  );
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
});
