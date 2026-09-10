import { type ChildProcess, fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';
import { BackgroundJobEntitySchema } from '../../entities/background-job.entity.js';
import { BrowserSessionEntitySchema } from '../../entities/browser-session.entity.js';
import {
  TEST_OAUTH_CLIENT,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../test-utils/fixtures.js';
import {
  createAuthenticatedSession,
  grantConsent,
  withMikroContext,
} from '../../test-utils/helpers.js';
import { getAuthorizationCode } from '../../test-utils/oauth.js';
import { securityProcessConfig } from '../../test-utils/security-process-config.js';
import { createTestApp } from '../../test-utils/setup.js';
import { createStoredSessionCookie } from '../../test-utils/stored-session.js';

const Message = z.object({
  event: z.string(),
  port: z.number().optional(),
  jobId: z.string().optional(),
  token: z.string().optional(),
});
const Tokens = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});
let app: Awaited<ReturnType<typeof createTestApp>>;
let directory: string;
let deliveredMail = 0;
const children: Array<{ child: ChildProcess; origin: string }> = [];
function message(child: ChildProcess, event: string) {
  return new Promise<z.infer<typeof Message>>((resolve, reject) => {
    const receive = (data: unknown) => {
      const parsed = Message.safeParse(data);
      if (parsed.success && parsed.data.event === event) {
        child.off('message', receive);
        child.off('exit', failed);
        resolve(parsed.data);
      }
    };
    const failed = () => {
      child.off('message', receive);
      reject(new Error('Security fixture exited before barrier'));
    };
    child.on('message', receive);
    child.once('exit', failed);
  });
}
async function startProcess(path: string) {
  const child = fork(
    new URL('../../test-utils/security-process.ts', import.meta.url),
    [],
    {
      execArgv: ['--conditions=@issuary/source', '--import', 'tsx'],
      env: { ...process.env, SECURITY_SQLITE_PATH: path },
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    },
  );
  const ready = await message(child, 'ready');
  return { child, origin: `http://127.0.0.1:${ready.port}` };
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'issuary-security-'));
  const path = join(directory, 'shared.sqlite');
  app = await createTestApp({
    ...securityProcessConfig(path),
    email: {
      createTransport: async () => ({
        sendMail: async () => {
          deliveredMail++;
        },
      }),
    },
  });
  await app.services.mailQueue.stop();
  for (let index = 0; index < 2; index++) {
    children.push(await startProcess(path));
  }
}, 30000);
afterAll(async () => {
  await Promise.all(
    children.map(async ({ child }) => {
      const stopped = once(child, 'exit');
      child.send('stop');
      await stopped;
    }),
  );
  await app?.cleanup();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function race(form: Record<string, string>) {
  const gates = children.map(({ child }) => message(child, 'arrived'));
  const responses = children.map(({ origin }) =>
    fetch(`${origin}/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-test-barrier': '1',
      },
      body: new URLSearchParams({
        ...form,
        client_id: TEST_OAUTH_CLIENT.clientId,
        client_secret: TEST_OAUTH_CLIENT.clientSecret,
      }),
    }),
  );
  await Promise.all(gates);
  for (const { child } of children) child.send('go');
  return Promise.all(responses);
}
async function code() {
  const sessionCookie = await createAuthenticatedSession(app.app);
  return (
    await getAuthorizationCode(app.app, {
      sessionCookie,
      scope: 'openid profile email offline_access',
    })
  ).code;
}
function codeForm(value: string) {
  return {
    grant_type: 'authorization_code',
    code: value,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    code_verifier: TEST_PKCE.codeVerifier,
  };
}
async function assertRevoked(access: string) {
  for (const { origin } of children)
    expect(
      (
        await fetch(`${origin}/oauth/userinfo`, {
          headers: { authorization: `Bearer ${access}` },
        })
      ).status,
    ).toBe(401);
}
test('two server processes consume one code once and persist replay revocation', async () => {
  const responses = await race(codeForm(await code()));
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 400,
  ]);
  const success = responses.find((response) => response.status === 200);
  if (!success) throw new Error('No successful exchange');
  const tokens = Tokens.parse(await success.json());
  await assertRevoked(tokens.access_token);
});
test('two server processes rotate one refresh token once and revoke descendants', async () => {
  const response = await app.app.request('/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({
      ...codeForm(await code()),
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  const tokens = Tokens.parse(await response.json());
  const responses = await race({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  });
  expect(responses.map((result) => result.status).sort()).toEqual([200, 400]);
  const success = responses.find((result) => result.status === 200);
  if (!success) throw new Error('No successful refresh');
  const descendant = Tokens.parse(await success.json());
  await assertRevoked(descendant.access_token);
});
test('two server processes consume an approved device code once', async () => {
  const deviceCode = crypto.randomUUID();
  await withMikroContext(app.services, async () => {
    const client = await app.services.mikro.oauthClient.findOneOrFail({
      clientId: TEST_OAUTH_CLIENT.clientId,
    });
    const code =
      await app.services.mikro.oauthDeviceCode.createDeviceAuthorization({
        clientId: client.id,
        deviceCodeHash: await app.services.securityService.hashOpaqueToken(
          'oauth-device-code',
          deviceCode,
        ),
        userCodeHash: crypto.randomUUID(),
        scope: ['openid', 'offline_access'],
      });
    code.authorizedUser = await app.services.mikro.user.findOneOrFail({
      sub: TEST_USER_CONFIG.sub,
    });
    code.user_epoch = code.authorizedUser.token_epoch;
    code.authorizedAt = new Date();
    await app.services.mikro.em.flush();
  });
  const responses = await race({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
  });
  expect(responses.map((result) => result.status).sort()).toEqual([200, 400]);
});

test.each([
  ['password', 'passkey'],
  ['password', 'oauth'],
  ['passkey', 'oauth'],
])('independent servers cannot remove both %s and %s', async (left, right) => {
  const methods = [left, right];
  const fixture = await withMikroContext(app.services, async () => {
    const user = app.services.mikro.user.create({
      email: `${crypto.randomUUID()}@example.test`,
      email_verified: true,
      password_hash: methods.includes('password')
        ? await app.services.securityService.hashPassword(
            'security-password-123',
          )
        : null,
    });
    const passkey = methods.includes('passkey')
      ? app.services.mikro.userPasskey.create({
          user,
          credential_id: crypto.randomUUID(),
          public_key: 'fixture',
          counter: 0,
          device_type: 'singleDevice',
          backed_up: false,
          transports: ['usb'],
        })
      : undefined;
    app.services.mikro.em.persist(user);
    if (passkey) app.services.mikro.em.persist(passkey);
    if (methods.includes('oauth'))
      app.services.mikro.em.persist(
        app.services.mikro.userOAuth.create({
          user,
          provider_name: 'google',
          provider_user_id: crypto.randomUUID(),
          access_token: 'fixture',
          refresh_token: '',
        }),
      );
    await app.services.mikro.em.flush();
    return { sub: user.sub, passkeyId: passkey?.id };
  });
  const user = await withMikroContext(app.services, () =>
    app.services.userService.getSessionUserBySub(fixture.sub),
  );
  const cookie = await createStoredSessionCookie(
    app.services,
    JSON.stringify({
      user: { ...user, authenticated_at: Math.floor(Date.now() / 1000) },
    }),
    app.services.config.security.session_secret,
  );
  const gates = children.map(({ child }) => message(child, 'arrived'));
  const responses = children.map(({ origin }, index) =>
    fetch(
      `${origin}${methods[index] === 'password' ? '/api/user/password' : methods[index] === 'oauth' ? '/api/oauth/google' : `/api/user/passkeys/${fixture.passkeyId}`}`,
      {
        method: 'DELETE',
        headers: {
          'x-test-barrier': '1',
          origin: app.services.config.server.public_origin,
          'content-type': 'application/json',
          cookie: `session=${cookie}`,
        },
        body: JSON.stringify(
          methods[index] === 'password'
            ? { current_password: 'security-password-123' }
            : {},
        ),
      },
    ),
  );
  await Promise.all(gates);
  for (const { child } of children) child.send('go');
  const results = await Promise.all(responses);
  expect(results.filter((response) => response.status === 200)).toHaveLength(1);
  expect(results.every((response) => response.status < 500)).toBe(true);
  await withMikroContext(app.services, async () => {
    const current = await app.services.mikro.user.findOneOrFail(
      { sub: fixture.sub },
      { populate: ['password_hash'] },
    );
    const passkeys = await app.services.mikro.userPasskey.countByUserSub(
      fixture.sub,
    );
    const oauth = await app.services.mikro.userOAuth.count({
      user: fixture.sub,
    });
    expect(Number(current.hasPassword()) + passkeys + oauth).toBe(1);
  });
});

test('HTTP adapter rejects oversized URL and header blocks before routing', async () => {
  for (const { origin } of children) {
    expect(
      (await fetch(`${origin}/health?value=${'x'.repeat(20000)}`)).status,
    ).toBe(431);
    expect(
      (
        await fetch(`${origin}/health`, {
          headers: { 'x-large': 'x'.repeat(20000) },
        })
      ).status,
    ).toBe(431);
  }
});

test('simultaneous configuration initializers preserve authentication when unchanged', async () => {
  const before = await withMikroContext(app.services, () =>
    app.services.mikro.user.findOneOrFail({ sub: TEST_USER_CONFIG.sub }),
  );
  const epoch = before.token_epoch;
  const gates = children.map(({ child }) => message(child, 'arrived'));
  const finished = children.map(({ child }) => message(child, 'seeded'));
  for (const { child } of children) child.send('seed');
  await Promise.all(gates);
  for (const { child } of children) child.send('go');
  await Promise.all(finished);
  const after = await withMikroContext(app.services, () =>
    app.services.mikro.user.findOneOrFail({ sub: TEST_USER_CONFIG.sub }),
  );
  expect(after.token_epoch).toBe(epoch);
});

test('device approval and denial are mutually exclusive across server processes', async () => {
  const userCode = crypto.randomUUID().toUpperCase();
  const id = await withMikroContext(app.services, async () => {
    const client = await app.services.mikro.oauthClient.findOneOrFail({
      clientId: TEST_OAUTH_CLIENT.clientId,
    });
    const code =
      await app.services.mikro.oauthDeviceCode.createDeviceAuthorization({
        clientId: client.id,
        deviceCodeHash: crypto.randomUUID(),
        userCodeHash: await app.services.securityService.hashOpaqueToken(
          'oauth-device-user-code',
          userCode,
        ),
        scope: ['openid'],
      });
    return code.id;
  });
  const cookie = await createAuthenticatedSession(app.app);
  const secondCookie = await createAuthenticatedSession(app.app);
  const gates = children.map(({ child }) => message(child, 'arrived'));
  const responses = children.map(({ origin }, index) =>
    fetch(`${origin}/oauth/device`, {
      method: 'POST',
      headers: {
        'x-test-barrier': '1',
        origin: app.services.config.server.public_origin,
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `session=${index === 0 ? cookie : secondCookie}`,
      },
      body: new URLSearchParams({
        user_code: userCode,
        decision: index === 0 ? 'approve' : 'deny',
      }),
    }),
  );
  await Promise.all(gates);
  for (const { child } of children) child.send('go');
  expect(
    (await Promise.all(responses)).map((response) => response.status).sort(),
  ).toEqual([200, 400]);
  await withMikroContext(app.services, async () => {
    const code = await app.services.mikro.oauthDeviceCode.findOneOrFail({ id });
    expect(
      Number(code.authorizedAt !== null) + Number(code.deniedAt !== null),
    ).toBe(1);
    expect(code.consumedAt).toBeNull();
  });
});

test('concurrent TOTP recovery-code regeneration consumes one OTP and keeps one set', async () => {
  const fixture = await withMikroContext(app.services, async () => {
    const user = app.services.mikro.user.create({
      email: `${crypto.randomUUID()}@example.test`,
      email_verified: true,
      password_hash: 'fixture',
    });
    const secret = app.services.totpService.generateSecret();
    const totp = app.services.mikro.userTotp.create({
      user,
      secret,
      verified: true,
      recovery_confirmed: true,
    });
    await app.services.mikro.em.persist([user, totp]).flush();
    return {
      sub: user.sub,
      token: app.services.totpService.generateToken(secret),
    };
  });
  const cookie = await createStoredSessionCookie(
    app.services,
    JSON.stringify({
      user: {
        sub: fixture.sub,
        authenticated_at: Math.floor(Date.now() / 1000),
      },
    }),
    app.services.config.security.session_secret,
  );
  const secondCookie = await createStoredSessionCookie(
    app.services,
    JSON.stringify({
      user: {
        sub: fixture.sub,
        authenticated_at: Math.floor(Date.now() / 1000),
      },
    }),
    app.services.config.security.session_secret,
  );
  const gates = children.map(({ child }) => message(child, 'arrived'));
  const responses = children.map(({ origin }, index) =>
    fetch(`${origin}/api/user/totp/recovery/regenerate`, {
      method: 'POST',
      headers: {
        'x-test-barrier': '1',
        origin: app.services.config.server.public_origin,
        'content-type': 'application/json',
        cookie: `session=${index === 0 ? cookie : secondCookie}`,
      },
      body: JSON.stringify({ code: fixture.token }),
    }),
  );
  await Promise.all(gates);
  for (const { child } of children) child.send('go');
  const results = await Promise.all(responses);
  expect(results.map((response) => response.status).sort()).toEqual([200, 400]);
  await withMikroContext(app.services, async () => {
    expect(
      await app.services.mikro.userTotpRecoveryCode.count({
        user: fixture.sub,
      }),
    ).toBe(8);
  });
});

test('required MFA retains one registered factor during TOTP and passkey removal', async () => {
  const configured = children.map(({ child }) => message(child, 'configured'));
  for (const { child } of children) child.send('require-mfa');
  await Promise.all(configured);
  app.services.config.auth.password.two_factor.enrollment_required = true;
  const fixture = await withMikroContext(app.services, async () => {
    const user = app.services.mikro.user.create({
      email: `${crypto.randomUUID()}@example.test`,
      email_verified: true,
      password_hash: 'fixture',
    });
    const secret = app.services.totpService.generateSecret();
    const totp = app.services.mikro.userTotp.create({
      user,
      secret,
      verified: true,
      recovery_confirmed: true,
    });
    const passkey = app.services.mikro.userPasskey.create({
      user,
      credential_id: crypto.randomUUID(),
      public_key: 'fixture',
      counter: 0,
      device_type: 'singleDevice',
      backed_up: false,
      transports: ['usb'],
    });
    await app.services.mikro.em.persist([user, totp, passkey]).flush();
    return {
      sub: user.sub,
      passkeyId: passkey.id,
      token: app.services.totpService.generateToken(secret),
    };
  });
  const cookie = await createStoredSessionCookie(
    app.services,
    JSON.stringify({
      user: {
        sub: fixture.sub,
        authenticated_at: Math.floor(Date.now() / 1000),
      },
    }),
    app.services.config.security.session_secret,
  );
  const secondCookie = await createStoredSessionCookie(
    app.services,
    JSON.stringify({
      user: {
        sub: fixture.sub,
        authenticated_at: Math.floor(Date.now() / 1000),
      },
    }),
    app.services.config.security.session_secret,
  );
  const gates = children.map(({ child }) => message(child, 'arrived'));
  const responses = children.map(({ origin }, index) =>
    fetch(
      `${origin}${index === 0 ? '/api/user/totp' : `/api/user/passkeys/${fixture.passkeyId}`}`,
      {
        method: 'DELETE',
        headers: {
          'x-test-barrier': '1',
          origin: app.services.config.server.public_origin,
          'content-type': 'application/json',
          cookie: `session=${index === 0 ? cookie : secondCookie}`,
        },
        body: JSON.stringify(index === 0 ? { code: fixture.token } : {}),
      },
    ),
  );
  await Promise.all(gates);
  for (const { child } of children) child.send('go');
  expect(
    (await Promise.all(responses)).map((response) => response.status).sort(),
  ).toEqual([200, 400]);
  await withMikroContext(app.services, async () => {
    const totp = Number(
      await app.services.mikro.userTotp.isRegistered(fixture.sub),
    );
    const passkeys = await app.services.mikro.userPasskey.countByUserSub(
      fixture.sub,
    );
    expect(totp + passkeys).toBe(1);
  });
});

test('registration token has exactly one winner across independent browsers and processes', async () => {
  const registrationToken = await withMikroContext(app.services, async () => {
    const term = app.services.mikro.terms.create({
      id: 'distributed-terms',
      version: '1',
      required: false,
    });
    await app.services.mikro.em.persist(term).flush();
    const providerId = crypto.randomUUID();
    const email = `${providerId}@registration.test`;
    return app.services.mikro.pendingOAuthRegistration.createPendingRegistration(
      {
        providerId: 'google',
        accessToken: 'private-token',
        tokenType: 'Bearer',
        userInfo: { id: providerId, email, email_verified: true },
        expiresAt: new Date(Date.now() + 60000),
      },
    );
  });
  try {
    const gates = children.map(({ child }) => message(child, 'arrived'));
    const pending = children.map(({ origin }) =>
      fetch(`${origin}/api/terms/consent`, {
        method: 'POST',
        headers: {
          'x-test-barrier': '1',
          origin: app.services.config.server.public_origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          registrationToken,
          consents: [{ termsId: 'distributed-terms', agreed: true }],
        }),
      }),
    );
    await Promise.all(gates);
    for (const { child } of children) child.send('go');
    const responses = await Promise.all(pending);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    expect(
      responses.filter((response) => response.headers.has('set-cookie')),
    ).toHaveLength(1);
  } finally {
    await withMikroContext(app.services, () =>
      app.services.mikro.terms.nativeDelete({ id: 'distributed-terms' }),
    );
  }
});

test.each(['clock-ahead', 'clock-behind'])(
  'authentication epochs reject stale cookies and codes with a %s issuer',
  async (clock) => {
    const configuredMfa = children.map(({ child }) =>
      message(child, 'configured'),
    );
    for (const { child } of children) child.send('optional-mfa');
    await Promise.all(configuredMfa);
    app.services.config.auth.password.two_factor.enrollment_required = false;
    const issuer = children[0];
    if (!issuer) throw new Error('Missing issuer');
    const configured = message(issuer.child, 'clock-set');
    issuer.child.send(clock);
    await configured;
    try {
      const user = await withMikroContext(app.services, () =>
        app.services.passwordAuthService.createDatabaseUser({
          email: `${crypto.randomUUID()}@clock.test`,
          password: 'clock-password-123',
        }),
      );
      const login = await fetch(`${issuer.origin}/api/auth/login`, {
        method: 'POST',
        headers: {
          origin: app.services.config.server.public_origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: 'clock-password-123',
        }),
      });
      expect(login.status).toBe(200);
      const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
      await grantConsent(app.app, cookie.replace(/^session=/, ''), {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid',
      });
      const query = new URLSearchParams({
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        response_type: 'code',
        scope: 'openid',
        prompt: 'none',
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: 'S256',
      });
      const authorization = await fetch(
        `${issuer.origin}/oauth/authorize?${query}`,
        { headers: { cookie }, redirect: 'manual' },
      );
      const location = authorization.headers.get('location');
      if (!location) throw new Error('Missing authorization redirect');
      const value = new URL(location, issuer.origin).searchParams.get('code');
      if (!value) throw new Error(`Expected authorization code: ${location}`);
      const deviceToken = crypto.randomUUID();
      const userCode = crypto.randomUUID().toUpperCase();
      await withMikroContext(app.services, async () => {
        const client = await app.services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        await app.services.mikro.oauthDeviceCode.createDeviceAuthorization({
          clientId: client.id,
          deviceCodeHash: await app.services.securityService.hashOpaqueToken(
            'oauth-device-code',
            deviceToken,
          ),
          userCodeHash: await app.services.securityService.hashOpaqueToken(
            'oauth-device-user-code',
            userCode,
          ),
          scope: ['openid'],
        });
        const totp = app.services.mikro.userTotp.create({
          user: user.sub,
          secret: app.services.totpService.generateSecret(),
          verified: true,
          recovery_confirmed: true,
        });
        await app.services.mikro.em.persist(totp).flush();
      });
      expect(
        (
          await fetch(`${issuer.origin}/oauth/device`, {
            method: 'POST',
            headers: {
              cookie,
              origin: app.services.config.server.public_origin,
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              user_code: userCode,
              decision: 'approve',
            }),
          })
        ).status,
      ).toBe(200);
      const pendingLogin = await fetch(`${issuer.origin}/api/auth/login`, {
        method: 'POST',
        headers: {
          origin: app.services.config.server.public_origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: 'clock-password-123',
        }),
      });
      const pendingCookie =
        pendingLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
      expect(
        (
          await fetch(`${issuer.origin}/api/auth/2fa/methods`, {
            headers: { cookie: pendingCookie },
          })
        ).status,
      ).toBe(200);
      await withMikroContext(app.services, () =>
        app.services.passwordAuthService.changePassword(
          user,
          'clock-password-123',
          'clock-new-password-123',
        ),
      );
      for (const { origin } of children) {
        expect(
          (
            await fetch(`${origin}/api/user/oauth-accounts`, {
              headers: { cookie },
            })
          ).status,
        ).toBe(401);
        expect(
          (
            await fetch(`${origin}/api/auth/2fa/methods`, {
              headers: { cookie: pendingCookie },
            })
          ).status,
        ).toBe(401);
        expect(
          await (
            await fetch(`${origin}/api/auth/accounts`, { headers: { cookie } })
          ).json(),
        ).toMatchObject({ active_sub: null, accounts: [] });
        const deviceExchange = await fetch(`${origin}/oauth/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceToken,
            client_id: TEST_OAUTH_CLIENT.clientId,
            client_secret: TEST_OAUTH_CLIENT.clientSecret,
          }),
        });
        expect(deviceExchange.status).toBe(400);
        expect(await deviceExchange.json()).toMatchObject({
          error: 'invalid_grant',
        });
        const exchange = await fetch(`${origin}/oauth/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            ...codeForm(value),
            client_id: TEST_OAUTH_CLIENT.clientId,
            client_secret: TEST_OAUTH_CLIENT.clientSecret,
          }),
        });
        expect(exchange.status).toBe(400);
        expect(await exchange.json()).toMatchObject({ error: 'invalid_grant' });
      }
    } finally {
      const restored = message(issuer.child, 'clock-set');
      issuer.child.send('clock-reset');
      await restored;
    }
  },
);

test.each([
  ['oauth', 'logout'],
  ['oauth', 'reset'],
  ['passkey', 'logout'],
  ['passkey', 'reset'],
])(
  'a paused %s change leaves no credential after %s commits in another process',
  async (kind, revocation) => {
    const issuer = children[0];
    const revoker = children[1];
    if (!issuer || !revoker) throw new Error('Expected two processes');
    const user = await withMikroContext(app.services, () =>
      app.services.passwordAuthService.createDatabaseUser({
        email: `${crypto.randomUUID()}@race.test`,
        password: 'race-password-123',
      }),
    );
    const state = crypto.randomUUID();
    const cookie = await createStoredSessionCookie(
      app.services,
      JSON.stringify({
        user: {
          sub: user.sub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
        ...(kind === 'oauth'
          ? {
              oauth: {
                state,
                codeVerifier: 'fixture',
                providerId: 'google',
                mode: 'link',
                linkSubject: user.sub,
                linkEpoch: user.token_epoch,
              },
            }
          : { passkey_challenge: 'fixture' }),
        security: {
          grants: {},
          oauthExpiresAt: Date.now() + 60000,
          challengeExpiresAt: Date.now() + 60000,
        },
      }),
      app.services.config.security.session_secret,
    );
    const configured = message(issuer.child, 'configured');
    issuer.child.send(`pause-${kind}`);
    await configured;
    const arrived = message(issuer.child, 'arrived');
    const pending =
      kind === 'oauth'
        ? fetch(
            `${issuer.origin}/api/oauth/google/callback?code=fixture&state=${state}`,
            { headers: { cookie: `session=${cookie}` }, redirect: 'manual' },
          )
        : fetch(`${issuer.origin}/api/user/passkeys/register/verify`, {
            method: 'POST',
            headers: {
              cookie: `session=${cookie}`,
              origin: app.services.config.server.public_origin,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              response: {
                id: 'paused-credential',
                rawId: 'paused-credential',
                response: { clientDataJSON: 'e30', attestationObject: 'e30' },
                type: 'public-key',
                clientExtensionResults: {},
              },
            }),
          });
    await Promise.race([
      arrived,
      pending.then((response) => {
        throw new Error(`Request ended before barrier: ${response.status}`);
      }),
    ]);
    try {
      if (revocation === 'logout')
        expect(
          (
            await fetch(`${revoker.origin}/api/auth/logout`, {
              method: 'POST',
              headers: {
                cookie: `session=${cookie}`,
                origin: app.services.config.server.public_origin,
              },
            })
          ).status,
        ).toBe(200);
      else {
        const token = await withMikroContext(app.services, async () => {
          const result = await app.services.passwordResetService.generateToken({
            userSub: user.sub,
          });
          await app.services.mikro.em.flush();
          return result.token;
        });
        expect(
          (
            await fetch(`${revoker.origin}/api/auth/password/reset`, {
              method: 'POST',
              headers: {
                origin: app.services.config.server.public_origin,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                token,
                password: 'after-race-password-123',
              }),
            })
          ).status,
        ).toBe(200);
      }
    } finally {
      issuer.child.send('go');
    }
    expect((await pending).status).toBe(401);
    await withMikroContext(app.services, async () => {
      expect(await app.services.mikro.userOAuth.count({ user: user.sub })).toBe(
        0,
      );
      expect(
        await app.services.mikro.userPasskey.count({ user: user.sub }),
      ).toBe(0);
    });
  },
);

async function loginRaceUser() {
  return withMikroContext(app.services, () =>
    app.services.passwordAuthService.createDatabaseUser({
      email: `${crypto.randomUUID()}@login-race.test`,
      password: 'original-password-123',
    }),
  );
}
async function raceSession(data: unknown) {
  return `session=${await createStoredSessionCookie(app.services, JSON.stringify(data), app.services.config.security.session_secret)}`;
}
async function resetOnProcess(origin: string, sub: string) {
  const token = await withMikroContext(app.services, () =>
    app.services.passwordResetService.generateToken({ userSub: sub }),
  );
  const response = await fetch(`${origin}/api/auth/password/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: app.services.config.server.public_origin,
    },
    body: JSON.stringify({
      token: token.token,
      password: 'replacement-password-123',
    }),
  });
  expect(response.status).toBe(200);
}

test('two processes cannot renew an old MFA-completed session during password reset', async () => {
  const issuer = children[0];
  const revoker = children[1];
  if (!issuer || !revoker) throw new Error('Missing processes');
  const user = await loginRaceUser();
  const secret = app.services.totpService.generateSecret();
  await withMikroContext(app.services, async () => {
    const factor = app.services.mikro.userTotp.create({
      user: user.sub,
      secret,
      verified: true,
      recovery_confirmed: true,
    });
    await app.services.mikro.em.persist(factor).flush();
  });
  const cookie = await raceSession({
    user: { sub: user.sub, authenticated_at: Math.floor(Date.now() / 1000) },
    accounts: [
      {
        sub: user.sub,
        authenticated_at: Math.floor(Date.now() / 1000),
        last_used_at: Math.floor(Date.now() / 1000),
      },
    ],
  });
  const configured = message(issuer.child, 'configured');
  issuer.child.send({ command: 'pause-password-login' });
  await configured;
  const arrived = message(issuer.child, 'arrived');
  const pending = fetch(`${issuer.origin}/api/auth/login`, {
    method: 'POST',
    headers: {
      cookie,
      origin: app.services.config.server.public_origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: 'replacement-password-123',
    }),
  });
  await arrived;
  try {
    await resetOnProcess(revoker.origin, user.sub);
  } finally {
    issuer.child.send('go');
  }
  const response = await pending;
  expect(response.status).toBe(200);
  const freshCookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  for (const { origin } of children) {
    expect(
      (
        await fetch(`${origin}/api/user/oauth-accounts`, {
          headers: { cookie: freshCookie },
        })
      ).status,
    ).toBe(401);
    expect(
      await (
        await fetch(`${origin}/api/auth/accounts`, {
          headers: { cookie: freshCookie },
        })
      ).json(),
    ).toMatchObject({ active_sub: null, accounts: [] });
  }
  const verified = await fetch(`${revoker.origin}/api/auth/totp/verify`, {
    method: 'POST',
    headers: {
      cookie: freshCookie,
      origin: app.services.config.server.public_origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: app.services.totpService.generateToken(secret),
    }),
  });
  expect(verified.status).toBe(200);
  const fullCookie = verified.headers.get('set-cookie')?.split(';')[0] ?? '';
  expect(
    (
      await fetch(`${issuer.origin}/api/user/oauth-accounts`, {
        headers: { cookie: fullCookie },
      })
    ).status,
  ).toBe(200);
});

test.each(
  ['GET', 'POST'].flatMap((method) =>
    ['unlink', 'reset', 'both'].map((change) => ({ method, change })),
  ),
)(
  'two processes reject $method OAuth login after $change commits',
  async ({ method, change }) => {
    const issuer = children[0];
    const revoker = children[1];
    if (!issuer || !revoker) throw new Error('Missing processes');
    const user = await loginRaceUser();
    const providerId = crypto.randomUUID();
    await withMikroContext(app.services, () =>
      app.services.mikro.userOAuth.linkAccount({
        userSub: user.sub,
        providerName: 'google',
        providerUserId: providerId,
        accessToken: 'original',
        refreshToken: '',
        expiresAt: null,
      }),
    );
    const ownerCookie = await raceSession({
      user: { sub: user.sub, authenticated_at: Math.floor(Date.now() / 1000) },
    });
    const state = crypto.randomUUID();
    const cookie = await raceSession({
      oauth: {
        state,
        codeVerifier: 'fixture',
        providerId: 'google',
        mode: 'login',
      },
      security: { grants: {}, oauthExpiresAt: Date.now() + 60000 },
    });
    const configured = message(issuer.child, 'configured');
    issuer.child.send({
      command: 'pause-login-proof',
      providerId,
      email: user.email,
    });
    await configured;
    const arrived = message(issuer.child, 'arrived');
    const params = new URLSearchParams({ state, code: 'fixture' });
    const pending = fetch(
      `${issuer.origin}/api/oauth/google/callback${method === 'GET' ? `?${params}` : ''}`,
      {
        method,
        redirect: 'manual',
        headers: {
          cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        ...(method === 'POST' ? { body: params } : {}),
      },
    );
    await arrived;
    try {
      if (change !== 'reset')
        expect(
          (
            await fetch(`${revoker.origin}/api/oauth/google`, {
              method: 'DELETE',
              headers: {
                cookie: ownerCookie,
                origin: app.services.config.server.public_origin,
              },
            })
          ).status,
        ).toBe(200);
      if (change !== 'unlink') await resetOnProcess(revoker.origin, user.sub);
    } finally {
      issuer.child.send('go');
    }
    const response = await pending;
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'OAUTH_SESSION_EXPIRED',
    });
    const finalCookie =
      response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
    for (const { origin } of children)
      expect(
        (
          await fetch(`${origin}/api/user/oauth-accounts`, {
            headers: { cookie: finalCookie },
          })
        ).status,
      ).toBe(401);
    const link = await withMikroContext(app.services, () =>
      app.services.mikro.userOAuth.findByProviderUserId('google', providerId),
    );
    if (change === 'reset') expect(link?.access_token).toBe('original');
    else expect(link).toBeNull();
  },
);

test('a mail job claimed by a terminated process is recovered by the worker', async () => {
  const email = `${crypto.randomUUID()}@example.test`;
  await withMikroContext(app.services, async () => {
    const user = app.services.mikro.user.create({
      email,
      created_at: new Date(0),
      updated_at: new Date(0),
    });
    await app.services.mikro.em.persist(user).flush();
  });
  const id = await withMikroContext(app.services, () =>
    app.services.mailQueue.enqueue('password-reset', email),
  );
  const gates = children.map(({ child }) => message(child, 'arrived'));
  const finished = children.map(({ child }) => message(child, 'claimed'));
  for (const { child } of children) child.send('claim-mail');
  await Promise.all(gates);
  for (const { child } of children) child.send('go');
  const claims = await Promise.all(finished);
  expect(claims.filter((result) => result.jobId === id)).toHaveLength(1);
  const index = claims.findIndex((result) => result.jobId === id);
  const [owner] = children.splice(index, 1);
  if (!owner) throw new Error('Expected claim owner');
  const exited = once(owner.child, 'exit');
  owner.child.kill('SIGKILL');
  await exited;
  // Restore the fixture pool after deliberately terminating its claim owner.
  children.push(await startProcess(join(directory, 'shared.sqlite')));
  await app.services.mikro.em
    .fork()
    .nativeUpdate(
      BackgroundJobEntitySchema,
      { id },
      { lockedUntil: new Date(0) },
    );
  app.services.mailQueue.start();
  await app.services.mailQueue.runPending();
  expect(deliveredMail).toBe(1);
  const complete = await app.services.mikro.em
    .fork()
    .findOneOrFail(BackgroundJobEntitySchema, { id });
  expect(complete.status).toBe('succeeded');
  expect(complete.attemptCount).toBe(2);
  expect(complete.payload).toBe('null');
});

test.each(['email', 'reset'])(
  'a token superseded by a clock-ahead process cannot be consumed by a clock-behind process (%s)',
  async (kind) => {
    const issuer = children[0];
    const consumer = children[1];
    if (!issuer || !consumer) throw new Error('Missing processes');
    const user = await loginRaceUser();
    const issue = async () => {
      const issued = message(issuer.child, 'issued');
      issuer.child.send({ command: 'issue-token', kind, sub: user.sub });
      const result = await issued;
      if (!result.token) throw new Error('Expected token');
      return result.token;
    };
    const old = await issue();
    const configured = message(issuer.child, 'clock-set');
    issuer.child.send('clock-ahead');
    await configured;
    let replacement: string;
    try {
      replacement = await issue();
    } finally {
      const restored = message(issuer.child, 'clock-set');
      issuer.child.send('clock-reset');
      await restored;
    }
    for (const [token, status] of [
      [old, 400],
      [replacement, 200],
    ]) {
      const response = await fetch(
        `${consumer.origin}/api/auth/${kind === 'email' ? 'email/verify' : 'password/reset'}`,
        {
          method: 'POST',
          headers: {
            origin: app.services.config.server.public_origin,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ token, password: 'replacement-password-123' }),
        },
      );
      expect(response.status).toBe(status);
    }
  },
);

test.each(['logout', 'reset'])(
  'an auto-link callback leaves no connection after %s in another process',
  async (change) => {
    const issuer = children[0];
    const revoker = children[1];
    if (!issuer || !revoker) throw new Error('Missing processes');
    const user = await loginRaceUser();
    const state = crypto.randomUUID();
    const cookie = await raceSession({
      oauth: {
        state,
        codeVerifier: 'fixture',
        providerId: 'google',
        mode: 'login',
      },
      security: { grants: {}, oauthExpiresAt: Date.now() + 60000 },
    });
    const configured = message(issuer.child, 'configured');
    issuer.child.send({
      command: 'pause-auto-link-proof',
      providerId: crypto.randomUUID(),
      email: user.email,
    });
    await configured;
    const arrived = message(issuer.child, 'arrived');
    const pending = fetch(
      `${issuer.origin}/api/oauth/google/callback?code=fixture&state=${state}`,
      { headers: { cookie }, redirect: 'manual' },
    );
    await Promise.race([
      arrived,
      pending.then((response) => {
        throw new Error(`Callback ended before barrier: ${response.status}`);
      }),
    ]);
    try {
      if (change === 'logout')
        expect(
          (
            await fetch(`${revoker.origin}/api/auth/logout`, {
              method: 'POST',
              headers: {
                cookie,
                origin: app.services.config.server.public_origin,
              },
            })
          ).status,
        ).toBe(200);
      else await resetOnProcess(revoker.origin, user.sub);
    } finally {
      issuer.child.send('go');
    }
    expect((await pending).status).toBe(change === 'logout' ? 401 : 400);
    await withMikroContext(app.services, async () => {
      expect(await app.services.mikro.userOAuth.count({ user: user.sub })).toBe(
        0,
      );
    });
  },
);

async function cycleClientOnProcess(origin: string, cookie: string) {
  await withMikroContext(app.services, () =>
    app.services.mikro.oauthClient.nativeUpdate(
      { clientId: TEST_OAUTH_CLIENT.clientId },
      { managed_by: 'database' },
    ),
  );
  const headers = { cookie, origin: app.services.config.server.public_origin };
  const path = `${origin}/api/admin/clients/test-config-oauth-client`;
  expect((await fetch(path, { method: 'DELETE', headers })).status).toBe(200);
  expect(
    (await fetch(`${path}/restore`, { method: 'POST', headers })).status,
  ).toBe(200);
}

test.each(['revoke-first', 'exchange-first'])(
  'client deletion and code exchange respect the %s commit order across processes',
  async (order) => {
    const issuer = children[0];
    const revoker = children[1];
    if (!issuer || !revoker) throw new Error('Missing processes');
    const value = await code();
    const adminCookie = `session=${await createAuthenticatedSession(app.app)}`;
    const exchange = () =>
      fetch(`${issuer.origin}/oauth/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          ...(order === 'revoke-first' ? { 'x-test-barrier': '1' } : {}),
        },
        body: new URLSearchParams({
          ...codeForm(value),
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
        }),
      });
    if (order === 'revoke-first') {
      const arrived = message(issuer.child, 'arrived');
      const pending = exchange();
      await arrived;
      try {
        await cycleClientOnProcess(revoker.origin, adminCookie);
      } finally {
        issuer.child.send('go');
      }
      expect((await pending).status).toBe(400);
    } else {
      const response = await exchange();
      expect(response.status).toBe(200);
      const tokens = Tokens.parse(await response.json());
      await cycleClientOnProcess(revoker.origin, adminCookie);
      await assertRevoked(tokens.access_token);
    }
  },
);

test.each(['email', 'reset'])(
  'concurrent %s reissuance leaves exactly one active token across processes',
  async (kind) => {
    const user = await loginRaceUser();
    const arrived = children.map(({ child }) => message(child, 'arrived'));
    const issued = children.map(({ child }) => message(child, 'issued'));
    for (const { child } of children)
      child.send({
        command: 'issue-token',
        kind,
        sub: user.sub,
        barrier: true,
      });
    await Promise.all(arrived);
    for (const { child } of children) child.send('go');
    const tokens = await Promise.all(issued);
    expect(tokens.every((result) => Boolean(result.token))).toBe(true);
    await withMikroContext(app.services, async () => {
      const repository =
        kind === 'email'
          ? app.services.mikro.emailVerification
          : app.services.mikro.passwordReset;
      expect(await repository.count({ user: user.sub, revoked_at: null })).toBe(
        1,
      );
      expect(
        await repository.count({ user: user.sub, revoked_at: { $ne: null } }),
      ).toBe(1);
    });
  },
);

test.each(['pending', 'approved'])(
  'device flow in %s state stays revoked after restoration on another process',
  async (state) => {
    const issuer = children[0];
    const revoker = children[1];
    if (!issuer || !revoker) throw new Error('Missing processes');
    const cookie = `session=${await createAuthenticatedSession(app.app)}`;
    const credentials = {
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    };
    const issue = async () => {
      const response = await fetch(
        `${issuer.origin}/oauth/device_authorization`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ...credentials, scope: 'openid' }),
        },
      );
      expect(response.status).toBe(200);
      return z
        .object({ device_code: z.string(), user_code: z.string() })
        .parse(await response.json());
    };
    const decide = (userCode: string, decision = 'approve') =>
      fetch(`${issuer.origin}/oauth/device`, {
        method: 'POST',
        headers: {
          cookie,
          origin: app.services.config.server.public_origin,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ user_code: userCode, decision }),
      });
    const exchange = (deviceCode: string) =>
      fetch(`${issuer.origin}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          ...credentials,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
        }),
      });
    const old = await issue();
    if (state === 'approved')
      expect((await decide(old.user_code)).status).toBe(200);
    await cycleClientOnProcess(revoker.origin, cookie);
    expect((await decide(old.user_code)).status).toBe(400);
    expect((await decide(old.user_code, 'deny')).status).toBe(400);
    const stale = await exchange(old.device_code);
    expect(stale.status).toBe(400);
    expect(await stale.json()).toMatchObject({ error: 'invalid_grant' });
    const fresh = await issue();
    expect((await decide(fresh.user_code)).status).toBe(200);
    expect((await exchange(fresh.device_code)).status).toBe(200);
  },
);

test.each(['auto_link', 'registration'])(
  'concurrent %s callbacks commit exactly one link and login session',
  async (kind) => {
    const email =
      kind === 'auto_link'
        ? (await loginRaceUser()).email
        : `${crypto.randomUUID()}@registration-race.test`;
    const providerId = crypto.randomUUID();
    const flows = await Promise.all(
      children.map(async ({ child, origin }) => {
        const state = crypto.randomUUID();
        const cookie = await raceSession({
          oauth: {
            state,
            codeVerifier: 'fixture',
            providerId: 'google',
            mode: 'login',
          },
          security: { grants: {}, oauthExpiresAt: Date.now() + 60000 },
        });
        const configured = message(child, 'configured');
        child.send({ command: 'pause-auto-link-proof', providerId, email });
        await configured;
        return { child, origin, state, cookie };
      }),
    );
    const gates = flows.map(({ child }) => message(child, 'arrived'));
    const pending = flows.map(({ origin, state, cookie }) =>
      fetch(`${origin}/api/oauth/google/callback?code=fixture&state=${state}`, {
        headers: { cookie },
        redirect: 'manual',
      }),
    );
    await Promise.all(gates);
    for (const { child } of flows) child.send('go');
    const responses = await Promise.all(pending);
    expect(
      responses.filter((response) => response.status === 302),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => [400, 409].includes(response.status)),
    ).toHaveLength(1);
    await withMikroContext(app.services, async () => {
      const user = await app.services.mikro.user.findOneOrFail({ email });
      expect(
        await app.services.mikro.userOAuth.count({
          user: user.sub,
          provider_user_id: providerId,
        }),
      ).toBe(1);
      expect(
        await app.services.mikro.em.count(BrowserSessionEntitySchema, {
          data: { user: { sub: user.sub } },
        }),
      ).toBe(1);
    });
  },
);

async function configureCompletionPause(command: string) {
  const issuer = children[0];
  const revoker = children[1];
  if (!issuer || !revoker) throw new Error('Missing processes');
  const configured = message(issuer.child, 'configured');
  issuer.child.send(command);
  await configured;
  return { issuer, revoker };
}

test.each(['authorize', 'admin'])(
  '%s completion rejects browser revocation on another process',
  async (kind) => {
    const cookie = `session=${await createAuthenticatedSession(app.app)}`;
    const clientId = `completion-${crypto.randomUUID()}`;
    const { issuer, revoker } = await configureCompletionPause(
      kind === 'authorize' ? 'pause-authorization' : 'pause-admin-check',
    );
    // Consent is established without using the paused server.
    if (kind === 'authorize')
      await grantConsent(app.app, cookie.slice('session='.length), {
        client_id: TEST_OAUTH_CLIENT.clientId,
        redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
        scope: 'openid email',
        code_challenge: TEST_PKCE.codeChallenge,
        code_challenge_method: 'S256',
      });
    const arrived = message(issuer.child, 'arrived');
    const pending =
      kind === 'authorize'
        ? fetch(
            `${issuer.origin}/oauth/authorize?${new URLSearchParams({ client_id: TEST_OAUTH_CLIENT.clientId, redirect_uri: TEST_OAUTH_CLIENT.redirectUri, response_type: 'code', scope: 'openid email', code_challenge: TEST_PKCE.codeChallenge, code_challenge_method: 'S256' })}`,
            { headers: { cookie }, redirect: 'manual' },
          )
        : fetch(`${issuer.origin}/api/admin/clients`, {
            method: 'POST',
            headers: {
              cookie,
              origin: app.services.config.server.public_origin,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              client_id: clientId,
              name: 'Completion',
              type: 'public',
              redirect_uris: ['https://completion.example/cb'],
              grant_types: ['authorization_code'],
              response_types: ['code'],
              scopes: ['openid'],
            }),
          });
    await arrived;
    try {
      expect(
        (
          await fetch(`${revoker.origin}/api/auth/logout`, {
            method: 'POST',
            headers: {
              cookie,
              origin: app.services.config.server.public_origin,
            },
          })
        ).status,
      ).toBe(200);
    } finally {
      issuer.child.send('go');
    }
    const response = await pending;
    expect(response.status).toBe(401);
    expect(response.headers.has('location')).toBe(false);
    expect(await response.text()).not.toContain('access_token');
    expect(
      await withMikroContext(app.services, () =>
        app.services.mikro.oauthClient.count({ clientId }),
      ),
    ).toBe(0);
  },
);

test('client secret rotation on another process rejects an already verified secret', async () => {
  const value = await code();
  const cookie = `session=${await createAuthenticatedSession(app.app)}`;
  await withMikroContext(app.services, () =>
    app.services.mikro.oauthClient.nativeUpdate(
      { clientId: TEST_OAUTH_CLIENT.clientId },
      { managed_by: 'database' },
    ),
  );
  const { issuer, revoker } = await configureCompletionPause(
    'pause-client-authentication',
  );
  const arrived = message(issuer.child, 'arrived');
  const pending = fetch(`${issuer.origin}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...codeForm(value),
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    }),
  });
  await arrived;
  try {
    const rotated = await fetch(
      `${revoker.origin}/api/admin/clients/test-config-oauth-client/rotate-secret`,
      {
        method: 'POST',
        headers: { cookie, origin: app.services.config.server.public_origin },
      },
    );
    expect(rotated.status).toBe(200);
  } finally {
    issuer.child.send('go');
  }
  try {
    expect((await pending).status).toBe(401);
  } finally {
    await withMikroContext(app.services, async () =>
      app.services.mikro.oauthClient.nativeUpdate(
        { clientId: TEST_OAUTH_CLIENT.clientId },
        {
          clientSecretHash: await app.services.securityService.hashClientSecret(
            TEST_OAUTH_CLIENT.clientSecret,
          ),
        },
      ),
    );
  }
});

test.each(['revoke-first', 'refresh-first'])(
  'explicit family revocation respects %s across processes',
  async (order) => {
    const issuer = children[0];
    const revoker = children[1];
    if (!issuer || !revoker) throw new Error('Missing processes');
    const original = await app.app.request('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...codeForm(await code()),
        client_id: TEST_OAUTH_CLIENT.clientId,
        client_secret: TEST_OAUTH_CLIENT.clientSecret,
      }),
    });
    const tokens = Tokens.parse(await original.json());
    const send = (
      origin: string,
      path: string,
      values: Record<string, string>,
    ) =>
      fetch(`${origin}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: TEST_OAUTH_CLIENT.clientId,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          ...values,
        }),
      });
    if (order === 'revoke-first')
      await configureCompletionPause('pause-client-authentication');
    const arrived =
      order === 'revoke-first' ? message(issuer.child, 'arrived') : undefined;
    const pending = send(issuer.origin, '/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    });
    if (arrived) {
      await arrived;
      try {
        expect(
          (
            await send(revoker.origin, '/oauth/revoke', {
              token: tokens.refresh_token,
              token_type_hint: 'refresh_token',
            })
          ).status,
        ).toBe(200);
      } finally {
        issuer.child.send('go');
      }
      expect((await pending).status).toBe(400);
    } else {
      const response = await pending;
      expect(response.status).toBe(200);
      const descendant = Tokens.parse(await response.json());
      expect(
        (
          await send(revoker.origin, '/oauth/revoke', {
            token: tokens.refresh_token,
            token_type_hint: 'refresh_token',
          })
        ).status,
      ).toBe(200);
      await assertRevoked(descendant.access_token);
    }
    await assertRevoked(tokens.access_token);
  },
);
