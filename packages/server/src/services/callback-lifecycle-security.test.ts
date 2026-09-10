import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { BrowserSessionEntitySchema } from '../entities/browser-session.entity.js';
import { google } from '../entrypoints/identity-providers/google.js';
import {
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../test-utils/fixtures.js';
import {
  createAuthenticatedSession,
  withMikroContext,
} from '../test-utils/helpers.js';
import {
  exchangeCodeForTokens,
  getAuthorizationCode,
} from '../test-utils/oauth.js';
import { securityProcessConfig } from '../test-utils/security-process-config.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';
import { createStoredSessionCookie } from '../test-utils/stored-session.js';
import { BrowserSessionService } from './browser-session.service.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    database: process.env['SECURITY_POSTGRES_PORT']
      ? securityProcessConfig(
          `/tmp/callback-lifecycle-${crypto.randomUUID()}/test.sqlite`,
        ).database
      : MINIMAL_TEST_CONFIG.database,
    users: [TEST_USER_CONFIG],
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        grant_types: [
          'authorization_code',
          'refresh_token',
          'urn:ietf:params:oauth:grant-type:device_code',
        ],
      },
    ],
    registration: { enabled: true, email_verification_required: false },
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        client_id: 'mock',
        client_secret: 'mock',
        email_conflict_strategy: 'auto_link',
      }),
    ],
    email: { createTransport: async () => ({ sendMail: async () => {} }) },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await server.cleanup();
  vi.useRealTimers();
});
async function user() {
  return withMikroContext(server.services, () =>
    server.services.passwordAuthService.createDatabaseUser({
      email: `${crypto.randomUUID()}@deep.test`,
      password: 'current-password-123',
    }),
  );
}
function post(path: string, body: unknown, cookie = '') {
  return server.app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
}

test.each(['email', 'reset'])(
  'a replacement %s token must invalidate the old token on a clock-behind process',
  async (kind) => {
    const entity = await user();
    const generate = () =>
      withMikroContext(server.services, async () =>
        kind === 'email'
          ? server.services.emailService.generateToken({ userSub: entity.sub })
          : server.services.passwordResetService.generateToken({
              userSub: entity.sub,
            }),
      );
    const first = await generate();
    const actualNow = Date.now;
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(actualNow() + 30000));
    const replacement = await generate();
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const response =
      kind === 'email'
        ? await post('/api/auth/email/verify', { token: first.token })
        : await post('/api/auth/password/reset', {
            token: first.token,
            password: 'replacement-password-123',
          });
    expect(response.status).toBe(400);
    const fresh =
      kind === 'email'
        ? await post('/api/auth/email/verify', { token: replacement.token })
        : await post('/api/auth/password/reset', {
            token: replacement.token,
            password: 'replacement-password-123',
          });
    expect(fresh.status).toBe(200);
  },
);

test('auto-link must roll back when its browser session cannot be saved', async () => {
  const entity = await user();
  const state = crypto.randomUUID();
  const cookie = await createStoredSessionCookie(
    server.services,
    JSON.stringify({
      oauth: {
        state,
        codeVerifier: 'mock',
        providerId: 'google',
        mode: 'login',
      },
      security: { grants: {}, oauthExpiresAt: Date.now() + 60000 },
    }),
    server.services.config.security.session_secret,
  );
  const exchange = vi
    .spyOn(server.services.oauthConnectService, 'exchangeCodeForTokens')
    .mockResolvedValue({ access_token: 'new', token_type: 'Bearer' });
  const info = vi
    .spyOn(server.services.oauthConnectService, 'fetchUserInfo')
    .mockResolvedValue({
      id: crypto.randomUUID(),
      email: entity.email,
      email_verified: true,
    });
  const save = vi
    .spyOn(BrowserSessionService.prototype, 'save')
    .mockResolvedValueOnce(false);
  const response = await server.app.request(
    `/api/oauth/google/callback?code=mock&state=${state}`,
    { headers: { Cookie: `session=${cookie}` } },
  );
  save.mockRestore();
  info.mockRestore();
  exchange.mockRestore();
  expect(response.status).toBe(401);
  const count = await withMikroContext(server.services, () =>
    server.services.mikro.userOAuth.count({ user: entity.sub }),
  );
  expect(count).toBe(0);
});

test('an authorization code must not survive client deletion and restoration', async () => {
  const cookie = await createAuthenticatedSession(server.app);
  const code = await getAuthorizationCode(server.app, {
    sessionCookie: cookie,
  });
  await withMikroContext(server.services, async () => {
    await server.services.mikro.oauthClient.nativeUpdate(
      { id: TEST_OAUTH_CLIENT_CONFIG.id },
      { managed_by: 'database' },
    );
    await server.services.adminConsoleService.deleteClient(
      TEST_OAUTH_CLIENT_CONFIG.id,
    );
    await server.services.adminConsoleService.restoreClient(
      TEST_OAUTH_CLIENT_CONFIG.id,
    );
  });
  const response = await exchangeCodeForTokens(server.app, {
    code: code.code,
    codeVerifier: TEST_PKCE.codeVerifier,
  });
  expect(response.status).toBe(400);
});

async function callbackFixture(email: string, method = 'GET') {
  const state = crypto.randomUUID();
  const providerUserId = crypto.randomUUID();
  const cookie = await createStoredSessionCookie(
    server.services,
    JSON.stringify({
      oauth: {
        state,
        codeVerifier: 'mock',
        providerId: 'google',
        mode: 'login',
      },
      security: { grants: {}, oauthExpiresAt: Date.now() + 60000 },
    }),
    server.services.config.security.session_secret,
  );
  vi.spyOn(
    server.services.oauthConnectService,
    'exchangeCodeForTokens',
  ).mockResolvedValue({
    access_token: 'private-provider-token',
    token_type: 'Bearer',
  });
  vi.spyOn(
    server.services.oauthConnectService,
    'fetchUserInfo',
  ).mockResolvedValue({ id: providerUserId, email, email_verified: true });
  return {
    state,
    providerUserId,
    cookie,
    request: () =>
      server.app.request(
        `/api/oauth/google/callback${method === 'GET' ? `?code=mock&state=${state}` : ''}`,
        {
          method,
          headers: {
            Cookie: `session=${cookie}`,
            ...(method === 'POST'
              ? { 'Content-Type': 'application/x-www-form-urlencoded' }
              : {}),
          },
          ...(method === 'POST'
            ? { body: new URLSearchParams({ code: 'mock', state }) }
            : {}),
        },
      ),
  };
}

function sessionCookie(response: Response) {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith('session='))
      ?.split(';')[0] ?? ''
  );
}

test.each(['GET', 'POST'])(
  'new OAuth registration rolls back its user, link, consent and state on %s session failure',
  async (method) => {
    const termId = crypto.randomUUID();
    await withMikroContext(server.services, async () => {
      const term = server.services.mikro.terms.create({
        id: termId,
        version: '1',
        consentMode: 'implicit',
        required: true,
      });
      await server.services.mikro.em.persist(term).flush();
    });
    try {
      const email = `${crypto.randomUUID()}@new.test`;
      const flow = await callbackFixture(email, method);
      vi.spyOn(BrowserSessionService.prototype, 'save').mockResolvedValueOnce(
        false,
      );
      const response = await flow.request();
      expect(response.status).toBe(401);
      expect(sessionCookie(response)).toBe('');
      await withMikroContext(server.services, async () => {
        expect(await server.services.mikro.user.count({ email })).toBe(0);
        expect(
          await server.services.mikro.userTermsConsent.count({ terms: termId }),
        ).toBe(0);
        expect(
          await server.services.mikro.userOAuth.count({
            provider_user_id: flow.providerUserId,
          }),
        ).toBe(0);
        expect(
          await server.services.mikro.em.count(BrowserSessionEntitySchema, {
            data: { oauth: { state: flow.state } },
          }),
        ).toBe(1);
      });
      const retry = await flow.request();
      expect(retry.status).toBe(302);
      expect(
        (
          await server.app.request('/api/user/oauth-accounts', {
            headers: { Cookie: sessionCookie(retry) },
          })
        ).status,
      ).toBe(200);
      await withMikroContext(server.services, async () => {
        expect(
          await server.services.mikro.userTermsConsent.count({ terms: termId }),
        ).toBe(1);
      });
    } finally {
      await withMikroContext(server.services, () =>
        server.services.mikro.terms.nativeDelete({ id: termId }),
      );
    }
  },
);

test('pending terms registration and OAuth state roll back together', async () => {
  const termId = crypto.randomUUID();
  await withMikroContext(server.services, async () => {
    const term = server.services.mikro.terms.create({
      id: termId,
      version: '1',
      consentMode: 'explicit',
      required: true,
    });
    await server.services.mikro.em.persist(term).flush();
  });
  try {
    const flow = await callbackFixture(`${crypto.randomUUID()}@terms.test`);
    vi.spyOn(BrowserSessionService.prototype, 'remove').mockRejectedValueOnce(
      new Error('injected session delete failure'),
    );
    expect((await flow.request()).status).toBe(500);
    await withMikroContext(server.services, async () => {
      expect(
        await server.services.mikro.pendingOAuthRegistration.count({
          userInfo: { id: flow.providerUserId },
        }),
      ).toBe(0);
      expect(
        await server.services.mikro.em.count(BrowserSessionEntitySchema, {
          data: { oauth: { state: flow.state } },
        }),
      ).toBe(1);
    });
    const success = await flow.request();
    expect(success.status).toBe(302);
    expect(success.headers.get('location')).toContain('registration_token=');
    expect((await flow.request()).status).toBe(400);
  } finally {
    await withMikroContext(server.services, () =>
      server.services.mikro.terms.nativeDelete({ id: termId }),
    );
  }
});

test.each(['logout', 'reset', 'email'])(
  'auto-link proof cannot survive %s after its lookup',
  async (change) => {
    const entity = await user();
    const flow = await callbackFixture(entity.email);
    const original =
      server.services.oauthConnectService.prepareAuthentication.bind(
        server.services.oauthConnectService,
      );
    vi.spyOn(
      server.services.oauthConnectService,
      'prepareAuthentication',
    ).mockImplementationOnce(async (...args) => {
      const proof = await original(...args);
      if (change === 'logout') {
        expect(
          (await post('/api/auth/logout', {}, `session=${flow.cookie}`)).status,
        ).toBe(200);
      } else if (change === 'reset') {
        const token = await withMikroContext(server.services, () =>
          server.services.passwordResetService.generateToken({
            userSub: entity.sub,
          }),
        );
        expect(
          (
            await post('/api/auth/password/reset', {
              token: token.token,
              password: 'reset-password-456',
            })
          ).status,
        ).toBe(200);
      } else {
        await withMikroContext(server.services, () =>
          server.services.userService.updateAdminUser({
            sub: entity.sub,
            actorSub: TEST_USER_CONFIG.sub,
            email: `${crypto.randomUUID()}@changed.test`,
          }),
        );
      }
      return proof;
    });
    const response = await flow.request();
    expect(response.status).toBe(change === 'logout' ? 401 : 400);
    await withMikroContext(server.services, async () => {
      expect(
        await server.services.mikro.userOAuth.count({ user: entity.sub }),
      ).toBe(0);
      expect(
        await server.services.mikro.em.count(BrowserSessionEntitySchema, {
          data: { user: { sub: entity.sub } },
        }),
      ).toBe(0);
    });
  },
);

test.each(['email', 'reset'])(
  'failed %s reissuance leaves the previous token usable',
  async (kind) => {
    const entity = await user();
    const generate = () =>
      withMikroContext(server.services, async () =>
        kind === 'email'
          ? server.services.emailService.generateToken({ userSub: entity.sub })
          : server.services.passwordResetService.generateToken({
              userSub: entity.sub,
            }),
      );
    const first = await generate();
    const repository =
      kind === 'email'
        ? server.services.mikro.emailVerification
        : server.services.mikro.passwordReset;
    const create = vi.spyOn(repository, 'create').mockImplementationOnce(() => {
      throw new Error('injected insert failure');
    });
    await expect(generate()).rejects.toThrow('injected insert failure');
    create.mockRestore();
    const response =
      kind === 'email'
        ? await post('/api/auth/email/verify', { token: first.token })
        : await post('/api/auth/password/reset', {
            token: first.token,
            password: 'after-failed-issue-123',
          });
    expect(response.status).toBe(200);
  },
);

async function cycleClient() {
  await withMikroContext(server.services, async () => {
    await server.services.mikro.oauthClient.nativeUpdate(
      { id: TEST_OAUTH_CLIENT_CONFIG.id },
      { managed_by: 'database' },
    );
    await server.services.adminConsoleService.deleteClient(
      TEST_OAUTH_CLIENT_CONFIG.id,
    );
    await server.services.adminConsoleService.restoreClient(
      TEST_OAUTH_CLIENT_CONFIG.id,
    );
  });
}

test.each(['pending', 'approved'])(
  'a %s device authorization cannot survive client deletion and restoration',
  async (state) => {
    const rawCode = crypto.randomUUID();
    const userCodeHash = crypto.randomUUID();
    await withMikroContext(server.services, async () => {
      await server.services.mikro.oauthDeviceCode.createDeviceAuthorization({
        clientId: TEST_OAUTH_CLIENT_CONFIG.id,
        userCodeHash,
        deviceCodeHash: await server.services.securityService.hashOpaqueToken(
          'oauth-device-code',
          rawCode,
        ),
        scope: ['openid'],
      });
      if (state === 'approved')
        expect(
          await server.services.mikro.oauthDeviceCode.approvePendingByUserCodeHash(
            {
              userCodeHash,
              userSub: TEST_USER_CONFIG.sub,
              approvedAt: new Date(),
            },
          ),
        ).not.toBeNull();
    });
    await cycleClient();
    await withMikroContext(server.services, async () => {
      expect(
        await server.services.mikro.oauthDeviceCode.findPendingByUserCodeHash(
          userCodeHash,
        ),
      ).toBeNull();
      expect(
        await server.services.mikro.oauthDeviceCode.approvePendingByUserCodeHash(
          {
            userCodeHash,
            userSub: TEST_USER_CONFIG.sub,
            approvedAt: new Date(),
          },
        ),
      ).toBeNull();
      expect(
        await server.services.mikro.oauthDeviceCode.denyPendingByUserCodeHash({
          userCodeHash,
          deniedAt: new Date(),
        }),
      ).toBeNull();
      await expect(
        server.services.oauthTokenService.exchangeDeviceCode({
          authentication:
            await server.services.oauthClientService.validateClientSecretIfRequired(
              TEST_OAUTH_CLIENT_CONFIG.client_id,
              TEST_OAUTH_CLIENT_CONFIG.client_secret,
            ),
          clientId: TEST_OAUTH_CLIENT_CONFIG.client_id,
          deviceCode: rawCode,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
  },
);

test('a restored client can complete a newly issued authorization code', async () => {
  await cycleClient();
  const cookie = await createAuthenticatedSession(server.app);
  const code = await getAuthorizationCode(server.app, {
    sessionCookie: cookie,
  });
  const response = await exchangeCodeForTokens(server.app, {
    code: code.code,
    codeVerifier: TEST_PKCE.codeVerifier,
  });
  expect(response.status).toBe(200);
});
