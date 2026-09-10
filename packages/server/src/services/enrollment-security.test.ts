import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { google } from '../entrypoints/identity-providers/google.js';
import { TEST_TERMS_CONFIG } from '../test-utils/fixtures.js';
import { withMikroContext } from '../test-utils/helpers.js';
import { securityProcessConfig } from '../test-utils/security-process-config.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';
import { createStoredSessionCookie } from '../test-utils/stored-session.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    database: process.env['SECURITY_POSTGRES_PORT']
      ? securityProcessConfig(
          `/tmp/enrollment-${crypto.randomUUID()}/test.sqlite`,
        ).database
      : MINIMAL_TEST_CONFIG.database,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
      email_verification_required: false,
    },
    auth: {
      password: {
        two_factor: { enrollment_required: true },
        totp: { enabled: true },
      },
    },
    terms: TEST_TERMS_CONFIG,
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        client_id: 'test',
        client_secret: 'test',
        email_conflict_strategy: 'require_link',
      }),
    ],
    email: { createTransport: async () => ({ sendMail: async () => {} }) },
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await server.cleanup();
  vi.useRealTimers();
});
function post(path: string, body: unknown, cookie = '') {
  return server.app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
}
function cookie(response: Response) {
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}
async function login(email: string) {
  const response = await post('/api/auth/login', {
    email,
    password: 'before-reset-password',
  });
  expect(response.status).toBe(200);
  return cookie(response);
}

test('unused second OAuth registration token must not log in after password reset', async () => {
  const id = crypto.randomUUID();
  const email = `${id}@review.test`;
  vi.spyOn(
    server.services.oauthConnectService,
    'exchangeCodeForTokens',
  ).mockResolvedValue({ access_token: 'mock', token_type: 'Bearer' });
  vi.spyOn(
    server.services.oauthConnectService,
    'fetchUserInfo',
  ).mockResolvedValue({ id, email, email_verified: true });
  async function pendingToken() {
    const state = crypto.randomUUID();
    const sessionCookie = await createStoredSessionCookie(
      server.services,
      JSON.stringify({
        oauth: {
          state,
          codeVerifier: 'fixture',
          providerId: 'google',
          mode: 'login',
        },
        security: { grants: {}, oauthExpiresAt: Date.now() + 60000 },
      }),
      server.services.config.security.session_secret,
    );
    const response = await server.app.request(
      `/api/oauth/google/callback?code=fixture&state=${state}`,
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    expect(response.status).toBe(302);
    const token = new URL(
      response.headers.get('location') ?? '',
    ).searchParams.get('registration_token');
    expect(token).toBeTruthy();
    return token;
  }
  const first = await pendingToken();
  const second = await pendingToken();
  const consents = TEST_TERMS_CONFIG.map((term) => ({
    termsId: term.id,
    agreed: true,
  }));
  expect(
    (await post('/api/terms/consent', { registrationToken: first, consents }))
      .status,
  ).toBe(200);
  const resetToken = await withMikroContext(server.services, async () => {
    const user = await server.services.mikro.user.findOneOrFail({ email });
    return (
      await server.services.passwordResetService.generateToken({
        userSub: user.sub,
      })
    ).token;
  });
  expect(
    (
      await post('/api/auth/password/reset', {
        token: resetToken,
        password: 'after-reset-password',
      })
    ).status,
  ).toBe(200);
  const replay = await post('/api/terms/consent', {
    registrationToken: second,
    consents,
  });
  const session = await server.app.request('/api/user/oauth-accounts', {
    headers: { Cookie: cookie(replay) },
  });
  expect(session.status).toBe(401);
  expect(replay.status).toBe(400);
});

test('TOTP confirmation must require the same browser that verified the OTP', async () => {
  const user = await withMikroContext(server.services, () =>
    server.services.passwordAuthService.createDatabaseUser({
      email: `${crypto.randomUUID()}@review.test`,
      password: 'before-reset-password',
    }),
  );
  const victimCookie = await login(user.email);
  const attackerCookie = await login(user.email);
  expect(
    (
      await server.app.request('/api/user/oauth-accounts', {
        headers: { Cookie: attackerCookie },
      })
    ).status,
  ).toBe(401);
  const setup = await post('/api/user/totp/setup', {}, victimCookie);
  expect(setup.status).toBe(200);
  const secret = await withMikroContext(
    server.services,
    async () =>
      (await server.services.mikro.userTotp.findByUserSub(user.sub))?.secret,
  );
  if (!secret) throw new Error('missing setup');
  const verify = await post(
    '/api/user/totp/verify',
    { code: server.services.totpService.generateToken(secret) },
    cookie(setup),
  );
  expect(verify.status).toBe(200);
  const confirm = await post('/api/user/totp/confirm', {}, attackerCookie);
  const session = await server.app.request('/api/user/oauth-accounts', {
    headers: { Cookie: cookie(confirm) },
  });
  expect(session.status).toBe(401);
  expect(confirm.status).toBe(401);
  expect(
    (await post('/api/user/totp/confirm', {}, cookie(verify))).status,
  ).toBe(200);
});

test('a stale enrollment session cannot add a passkey after another browser completes TOTP', async () => {
  server.services.config.auth.passkey.enabled = true;
  const user = await withMikroContext(server.services, () =>
    server.services.passwordAuthService.createDatabaseUser({
      email: `${crypto.randomUUID()}@review.test`,
      password: 'before-reset-password',
    }),
  );
  const victimCookie = await login(user.email);
  const attackerCookie = await login(user.email);
  const setup = await post('/api/user/totp/setup', {}, victimCookie);
  expect(setup.status).toBe(200);
  const secret = await withMikroContext(
    server.services,
    async () =>
      (await server.services.mikro.userTotp.findByUserSub(user.sub))?.secret,
  );
  if (!secret) throw new Error('missing setup');
  const verify = await post(
    '/api/user/totp/verify',
    { code: server.services.totpService.generateToken(secret) },
    cookie(setup),
  );
  expect(verify.status).toBe(200);
  expect(
    (await post('/api/user/totp/confirm', {}, cookie(verify))).status,
  ).toBe(200);
  expect(
    await withMikroContext(server.services, () =>
      server.services.mikro.userTotp.isRegistered(user.sub),
    ),
  ).toBe(true);
  const options = await post(
    '/api/user/passkeys/register/options',
    {},
    attackerCookie,
  );
  expect(options.status).toBe(200);
  const id = crypto.randomUUID();
  vi.spyOn(
    server.services.passkeyService,
    'prepareRegistration',
  ).mockResolvedValue({
    verified: true,
    registrationInfo: {
      fmt: 'none',
      aaguid: '',
      credential: { id, publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
      credentialType: 'public-key',
      attestationObject: new Uint8Array(),
      userVerified: true,
      credentialDeviceType: 'singleDevice',
      credentialBackedUp: false,
      origin: 'http://localhost:8080',
      rpID: 'localhost',
    },
  });
  const registered = await post(
    '/api/user/passkeys/register/verify',
    {
      response: {
        id,
        rawId: id,
        response: { clientDataJSON: 'e30', attestationObject: 'e30' },
        type: 'public-key',
        clientExtensionResults: {},
      },
    },
    cookie(options),
  );
  const session = await server.app.request('/api/user/oauth-accounts', {
    headers: { Cookie: cookie(registered) },
  });
  const count = await withMikroContext(server.services, () =>
    server.services.mikro.userPasskey.count({ user: user.sub }),
  );
  expect(session.status).toBe(401);
  expect(count).toBe(0);
  expect(registered.status).toBe(401);
});

test('authentication revocation removes pending proofs for the same provider identity', async () => {
  const user = await withMikroContext(server.services, () =>
    server.services.passwordAuthService.createDatabaseUser({
      email: `${crypto.randomUUID()}@review.test`,
      password: 'before-reset-password',
    }),
  );
  const token = await withMikroContext(server.services, async () => {
    await server.services.oauthConnectService.linkOAuthAccount(
      user.sub,
      'google',
      { access_token: 'mock', token_type: 'Bearer' },
      { id: user.sub, email: user.email, email_verified: true },
    );
    return server.services.mikro.pendingOAuthRegistration.createPendingRegistration(
      {
        providerId: 'google',
        accessToken: 'old-provider-secret',
        tokenType: 'Bearer',
        userInfo: {
          id: user.sub,
          email: 'old-address@review.test',
          email_verified: true,
        },
        expiresAt: new Date(Date.now() + 60000),
      },
    );
  });
  await withMikroContext(server.services, () =>
    server.services.passwordAuthService.replacePassword(
      user,
      'changed-password-123',
    ),
  );
  expect(
    await withMikroContext(server.services, () =>
      server.services.mikro.pendingOAuthRegistration.findOne({ token }),
    ),
  ).toBeNull();
  expect(
    (
      await post('/api/terms/consent', {
        registrationToken: token,
        consents: TEST_TERMS_CONFIG.map((term) => ({
          termsId: term.id,
          agreed: true,
        })),
      })
    ).status,
  ).toBe(400);
});

test('different registration tokens for one identity issue only one session concurrently', async () => {
  const id = crypto.randomUUID();
  const email = `${id}@review.test`;
  const tokens = await withMikroContext(server.services, async () => {
    const tokens: string[] = [];
    for (let i = 0; i < 2; i++)
      tokens.push(
        await server.services.mikro.pendingOAuthRegistration.createPendingRegistration(
          {
            providerId: 'google',
            accessToken: 'mock',
            tokenType: 'Bearer',
            userInfo: { id, email, email_verified: true },
            expiresAt: new Date(Date.now() + 60000),
          },
        ),
      );
    return tokens;
  });
  const responses = await Promise.all(
    tokens.map((registrationToken) =>
      post('/api/terms/consent', {
        registrationToken,
        consents: TEST_TERMS_CONFIG.map((term) => ({
          termsId: term.id,
          agreed: true,
        })),
      }),
    ),
  );
  expect(responses.filter((response) => response.status === 200)).toHaveLength(
    1,
  );
  expect(
    responses.filter(
      (response) => response.status === 400 || response.status === 409,
    ),
  ).toHaveLength(1);
  expect(
    responses.filter((response) => response.headers.has('set-cookie')),
  ).toHaveLength(1);
  expect(
    await withMikroContext(server.services, () =>
      server.services.mikro.user.count({ email }),
    ),
  ).toBe(1);
  expect(
    await withMikroContext(server.services, () =>
      server.services.mikro.pendingOAuthRegistration.count({
        userInfo: { id },
      }),
    ),
  ).toBe(0);
});
