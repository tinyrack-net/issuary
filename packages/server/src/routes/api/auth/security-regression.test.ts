import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';
import { BrowserSessionEntitySchema } from '../../../entities/browser-session.entity.js';
import { postgres } from '../../../entrypoints/database/postgres/postgres.js';
import { decrypt, encrypt } from '../../../lib/crypto.js';
import { consumeAuthBudget } from '../../../services/auth-budget.service.js';
import { BrowserSessionService } from '../../../services/browser-session.service.js';
import { createTestOAuthClient } from '../../../test-utils/cli.js';
import {
  createDbUserWithSession,
  extractCookie,
  withMikroContext,
} from '../../../test-utils/helpers.js';
import {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/setup.js';

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
            name: 'issuary_security_test',
            driverOptions: { ssl: false },
          }),
        }
      : {}),
    auth: { password: { totp: { enabled: true } } },
    email: await createTestEmailConfig(),
  });
});
afterAll(async () => {
  await server.cleanup();
});

async function createUser() {
  return createDbUserWithSession(
    server.app,
    server.services,
    `${crypto.randomUUID()}@example.test`,
    'OldPassword123!',
  );
}

function sessionRequest(cookie: string) {
  return server.app.request('/api/user/oauth-accounts', {
    headers: { Cookie: `session=${cookie}` },
  });
}

test.each(['/api/auth/logout', '/oauth/end_session'])(
  '%s invalidates a copied cookie on the server',
  async (path) => {
    const { sessionCookie } = await createUser();
    expect((await sessionRequest(sessionCookie)).status).toBe(200);
    await server.app.request(path, {
      method: path === '/api/auth/logout' ? 'POST' : 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    });
    expect((await sessionRequest(sessionCookie)).status).toBe(401);
  },
);

test('password reset invalidates existing sessions', async () => {
  const { sessionCookie, userSub } = await createUser();
  const token = await withMikroContext(server.services, async () => {
    const reset = await server.services.passwordResetService.generateToken({
      userSub,
    });
    await server.services.mikro.em.flush();
    return reset.token;
  });
  const reset = await server.app.request('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: 'NewPassword123!' }),
  });
  expect(reset.status).toBe(200);
  expect((await sessionRequest(sessionCookie)).status).toBe(401);
});

test('invalid replacement password does not consume a reset token', async () => {
  const { userSub } = await createUser();
  const token = await withMikroContext(server.services, async () => {
    const reset = await server.services.passwordResetService.generateToken({
      userSub,
    });
    await server.services.mikro.em.flush();
    return reset.token;
  });
  await withMikroContext(server.services, async () => {
    await expect(
      server.services.passwordResetService.resetPassword({
        token,
        password: '',
      }),
    ).rejects.toThrow();
  });
  await withMikroContext(server.services, async () => {
    await expect(
      server.services.passwordResetService.resetPassword({
        token,
        password: 'NewPassword123!',
      }),
    ).resolves.toBeDefined();
  });
});

test('legacy self-contained encrypted cookies cannot authenticate', async () => {
  const { userSub } = await createUser();
  const cookie = await encrypt(
    JSON.stringify({
      user: { sub: userSub, authenticated_at: Math.floor(Date.now() / 1000) },
    }),
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
  expect((await sessionRequest(cookie)).status).toBe(401);
});

test('a deleted and restored user cannot reactivate an old session', async () => {
  const { sessionCookie, userSub } = await createUser();
  await withMikroContext(server.services, async () => {
    await server.services.userService.deleteAdminUser({
      sub: userSub,
      actorSub: 'test-administrator',
    });
    await server.services.userService.restoreAdminUser(userSub);
  });
  expect((await sessionRequest(sessionCookie)).status).toBe(401);
});

test('server-side session expiry is enforced even if the browser retains its cookie', async () => {
  const { sessionCookie } = await createUser();
  const plaintext = await decrypt(
    sessionCookie,
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
  const { sid } = z
    .object({ sid: z.uuid() })
    .parse(JSON.parse(plaintext ?? '{}'));
  await withMikroContext(server.services, () =>
    server.services.mikro.em.nativeUpdate(BrowserSessionEntitySchema, sid, {
      expires_at: new Date(0),
    }),
  );
  expect((await sessionRequest(sessionCookie)).status).toBe(401);
});

test('a concurrent stale save cannot resurrect a logged-out session', async () => {
  const { sessionCookie } = await createUser();
  const plaintext = await decrypt(
    sessionCookie,
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
  const { sid } = z
    .object({ sid: z.uuid() })
    .parse(JSON.parse(plaintext ?? '{}'));
  const session = await withMikroContext(server.services, () =>
    new BrowserSessionService(server.services.mikro.em).load(sid),
  );
  if (!session) throw new Error('Missing fixture session');
  await server.app.request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: `session=${sessionCookie}` },
  });
  const saved = await withMikroContext(server.services, () =>
    new BrowserSessionService(server.services.mikro.em).save(session, false),
  );
  expect(saved).toBe(false);
  expect((await sessionRequest(sessionCookie)).status).toBe(401);
});

test.each(['reset', 'email'])(
  'only one concurrent request consumes an %s token',
  async (kind) => {
    const { userSub } = await createUser();
    const token = await withMikroContext(server.services, async () => {
      const record =
        kind === 'reset'
          ? await server.services.passwordResetService.generateToken({
              userSub,
            })
          : await server.services.emailService.generateToken({ userSub });
      await server.services.mikro.em.flush();
      return record.token;
    });
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        withMikroContext(server.services, async () =>
          Boolean(
            await (kind === 'reset'
              ? server.services.mikro.passwordReset.verifyToken(token)
              : server.services.mikro.emailVerification.verifyToken(token)),
          ),
        ),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  },
);

test('authentication budgets enforce the limit across independent database contexts', async () => {
  const key = crypto.randomUUID();
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      withMikroContext(server.services, () =>
        consumeAuthBudget(
          server.services.mikro,
          server.services.securityService,
          key,
          2,
          600,
        ),
      ),
    ),
  );
  expect(results.filter((result) => result === null)).toHaveLength(2);
  expect(results.filter((result) => result !== null)).toHaveLength(3);
});

test('mail requests are limited without revealing whether the address exists', async () => {
  const email = `${crypto.randomUUID()}@example.test`;
  const request = () =>
    server.app.request('/api/auth/email/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  for (let i = 0; i < 3; i++) expect((await request()).status).toBe(200);
  const limited = await request();
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
});

test('oversized streamed request bodies are rejected before JSON processing', async () => {
  const response = await server.app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'x'.repeat(1_048_577),
  });
  expect(response.status).toBe(413);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});

test('email verification cannot bypass an already registered second factor', async () => {
  const { userSub } = await createUser();
  const token = await withMikroContext(server.services, async () => {
    const totp = server.services.mikro.userTotp.create({
      user: userSub,
      secret: server.services.totpService.generateSecret(),
      verified: true,
      recovery_confirmed: true,
    });
    server.services.mikro.em.persist(totp);
    const verification = await server.services.emailService.generateToken({
      userSub,
    });
    await server.services.mikro.em.flush();
    return verification.token;
  });
  const response = await server.app.request('/api/auth/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  expect(response.status).toBe(200);
  const cookie = extractCookie(response, 'session');
  expect((await sessionRequest(cookie)).status).toBe(401);
  const state = await server.app.request('/api/auth/2fa/methods', {
    headers: { Cookie: `session=${cookie}` },
  });
  expect(state.status).toBe(200);
});

test('password reset revokes access and refresh tokens and permits new authenticated grants', async () => {
  const { userSub } = await createUser();
  const clientId = crypto.randomUUID();
  await createTestOAuthClient(server.services, { clientId });
  const tokens = await withMikroContext(server.services, async () => ({
    access: await server.services.jwtService.signAccessToken({
      typ: 'access_token',
      sub: userSub,
      user_epoch: (
        await server.services.mikro.user.findOneOrFail({ sub: userSub })
      ).token_epoch,
      client_id: clientId,
      scope: 'openid',
    }),
    refresh: await server.services.jwtService.signRefreshToken({
      typ: 'refresh_token',
      sub: userSub,
      user_epoch: (
        await server.services.mikro.user.findOneOrFail({ sub: userSub })
      ).token_epoch,
      client_id: clientId,
      scope: 'openid',
    }),
    reset: await server.services.passwordResetService.generateToken({
      userSub,
    }),
  }));
  await withMikroContext(server.services, async () => {
    await expect(
      server.services.jwtService.verifyAccessToken(tokens.access),
    ).resolves.toMatchObject({ sub: userSub });
    await expect(
      server.services.jwtService.verifyRefreshToken(tokens.refresh),
    ).resolves.toMatchObject({ sub: userSub });
  });
  await withMikroContext(server.services, async () => {
    await server.services.mikro.em.persist(tokens.reset).flush();
  });
  const result = await server.app.request('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: tokens.reset.token,
      password: 'NewPassword123!',
    }),
  });
  expect(result.status).toBe(200);
  await withMikroContext(server.services, async () => {
    await expect(
      server.services.jwtService.verifyAccessToken(tokens.access),
    ).rejects.toThrow();
    await expect(
      server.services.jwtService.verifyRefreshToken(tokens.refresh),
    ).rejects.toThrow();
    const user = await server.services.mikro.user.findOneOrFail({
      sub: userSub,
    });
    const replacement = await server.services.jwtService.signAccessToken({
      typ: 'access_token',
      sub: userSub,
      client_id: clientId,
      scope: 'openid',
      user_epoch: user.token_epoch ?? undefined,
    });
    await expect(
      server.services.jwtService.verifyAccessToken(replacement),
    ).resolves.toMatchObject({ sub: userSub });
  });
});

test('expired pending MFA and WebAuthn state cannot be used with a retained cookie', async () => {
  const { sessionCookie, userSub } = await createUser();
  const decoded = await decrypt(
    sessionCookie,
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
  const { sid } = z
    .object({ sid: z.string() })
    .parse(JSON.parse(decoded ?? '{}'));
  await withMikroContext(server.services, async () => {
    const row = await server.services.mikro.em.findOneOrFail(
      BrowserSessionEntitySchema,
      { id: sid },
    );
    delete row.data.user;
    row.data.pending2FAUser = {
      sub: userSub,
      authenticated_at: Math.floor(Date.now() / 1000),
    };
    row.data.passkey_challenge = 'expired-challenge';
    row.data.security = {
      grants: {
        [userSub]: (
          await server.services.mikro.user.findOneOrFail({ sub: userSub })
        ).token_epoch,
      },
      pendingExpiresAt: Date.now() - 1,
      challengeExpiresAt: Date.now() - 1,
    };
    await server.services.mikro.em.flush();
  });
  const methods = await server.app.request('/api/auth/2fa/methods', {
    headers: { Cookie: `session=${sessionCookie}` },
  });
  expect(methods.status).toBe(401);
  expect((await sessionRequest(sessionCookie)).status).toBe(401);
});
