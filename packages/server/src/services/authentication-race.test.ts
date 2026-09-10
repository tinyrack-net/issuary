import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { BrowserSessionEntitySchema } from '../entities/browser-session.entity.js';
import { UserOAuthEntitySchema } from '../entities/user-oauth.entity.js';
import { google } from '../entrypoints/identity-providers/google.js';
import { withMikroContext } from '../test-utils/helpers.js';
import { securityProcessConfig } from '../test-utils/security-process-config.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';
import { createStoredSessionCookie } from '../test-utils/stored-session.js';
import { invalidateUserAuthentication } from './authentication-epoch.js';
import { BrowserSessionService } from './browser-session.service.js';
import { withUserSecurity } from './user-security.service.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
const password = 'known-password-123';
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    database: process.env['SECURITY_POSTGRES_PORT']
      ? securityProcessConfig(
          `/tmp/auth-race-${crypto.randomUUID()}/test.sqlite`,
        ).database
      : MINIMAL_TEST_CONFIG.database,
    auth: {
      account_selection: { enabled: true, mode: 'smart' },
      password: { totp: { enabled: true } },
    },
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        client_id: 'test',
        client_secret: 'test',
        email_conflict_strategy: 'require_link',
      }),
    ],
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await server.cleanup();
  vi.useRealTimers();
});
function pair(response: Response) {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith('session='))
      ?.split(';')[0] ?? ''
  );
}
function post(path: string, body: unknown, cookie = '') {
  return server.app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
}
function protectedRequest(cookie: string) {
  return server.app.request('/api/user/oauth-accounts', {
    headers: { Cookie: cookie },
  });
}
async function createUser() {
  return withMikroContext(server.services, () =>
    server.services.passwordAuthService.createDatabaseUser({
      email: `${crypto.randomUUID()}@review.test`,
      password,
    }),
  );
}
async function session(data: unknown) {
  return `session=${await createStoredSessionCookie(server.services, JSON.stringify(data), server.services.config.security.session_secret)}`;
}
function subject(sub: string) {
  return { sub, authenticated_at: Math.floor(Date.now() / 1000) };
}

test.each(['role', 'email', 'password', 'other-account'])(
  'MFA login after %s revocation cannot inherit old authentication',
  async (change) => {
    const user = await createUser();
    const other = await createUser();
    const secret = server.services.totpService.generateSecret();
    await withMikroContext(server.services, async () => {
      const totp = server.services.mikro.userTotp.create({
        user: user.sub,
        secret,
        verified: true,
        recovery_confirmed: true,
      });
      await server.services.mikro.em.persist(totp).flush();
    });
    const cookie = await session({
      user: subject(change === 'other-account' ? other.sub : user.sub),
      accounts: [user, other].map((value) => ({
        ...subject(value.sub),
        last_used_at: Math.floor(Date.now() / 1000),
      })),
      accountSelection: {
        id: 'selection',
        client_id: 'client',
        request_fingerprint: 'request',
        allow_add_account: true,
        allowed_subs: [user.sub, other.sub],
        created_at: Math.floor(Date.now() / 1000),
      },
      reauthentication: subject(user.sub),
    });
    const email = change === 'email' ? `new-${user.email}` : user.email;
    const nextPassword =
      change === 'password' ? 'replacement-password-123' : password;
    const original =
      server.services.passwordAuthService.authenticateByEmailAndPassword.bind(
        server.services.passwordAuthService,
      );
    const pause = vi
      .spyOn(
        server.services.passwordAuthService,
        'authenticateByEmailAndPassword',
      )
      .mockImplementationOnce(async (params) => {
        await withMikroContext(server.services, () =>
          withUserSecurity(server.services.mikro, user.sub, async (fresh) => {
            if (change === 'password') {
              await server.services.passwordAuthService.replacePassword(
                fresh,
                nextPassword,
              );
            } else {
              if (change === 'email') fresh.email = email;
              else fresh.role = 'admin';
              await invalidateUserAuthentication(
                server.services.mikro.em,
                fresh,
              );
              await server.services.mikro.em.flush();
            }
          }),
        );
        return original(params);
      });
    const login = await post(
      '/api/auth/login',
      { email, password: nextPassword },
      cookie,
    );
    pause.mockRestore();
    expect(login.status).toBe(200);
    const pendingCookie = pair(login);
    expect((await protectedRequest(pendingCookie)).status).toBe(
      change === 'other-account' ? 200 : 401,
    );
    const stored = await server.services.mikro.em
      .fork()
      .findOneOrFail(BrowserSessionEntitySchema, {
        data: { pending2FAUser: { sub: user.sub } },
      });
    expect(stored.data.user?.sub).toBe(
      change === 'other-account' ? other.sub : undefined,
    );
    expect(stored.data.accounts?.map((value) => value.sub)).toEqual([
      other.sub,
    ]);
    expect(stored.data.accountSelection?.allowed_subs).toEqual([other.sub]);
    expect(stored.data.reauthentication).toBeUndefined();
    expect(stored.data.security?.grants[user.sub]).not.toBe(user.token_epoch);
    const verified = await post(
      '/api/auth/totp/verify',
      { code: server.services.totpService.generateToken(secret) },
      pendingCookie,
    );
    expect(verified.status).toBe(200);
    expect((await protectedRequest(pair(verified))).status).toBe(200);
  },
);

async function oauthFixture() {
  const user = await createUser();
  const providerId = crypto.randomUUID();
  await withMikroContext(server.services, () =>
    server.services.mikro.userOAuth.linkAccount({
      userSub: user.sub,
      providerName: 'google',
      providerUserId: providerId,
      accessToken: 'old',
      refreshToken: '',
      expiresAt: null,
    }),
  );
  const ownerCookie = await session({ user: subject(user.sub) });
  const state = crypto.randomUUID();
  const callbackCookie = await session({
    oauth: {
      state,
      codeVerifier: 'fixture',
      providerId: 'google',
      mode: 'login',
    },
    security: { grants: {}, oauthExpiresAt: Date.now() + 60000 },
  });
  vi.spyOn(
    server.services.oauthConnectService,
    'exchangeCodeForTokens',
  ).mockResolvedValue({ access_token: 'new', token_type: 'Bearer' });
  vi.spyOn(
    server.services.oauthConnectService,
    'fetchUserInfo',
  ).mockResolvedValue({
    id: providerId,
    email: user.email,
    email_verified: true,
  });
  function callback(method: string) {
    return method === 'GET'
      ? server.app.request(
          `/api/oauth/google/callback?code=fixture&state=${state}`,
          { headers: { Cookie: callbackCookie } },
        )
      : server.app.request('/api/oauth/google/callback', {
          method: 'POST',
          headers: {
            Cookie: callbackCookie,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ code: 'fixture', state }),
        });
  }
  return { user, providerId, ownerCookie, callbackCookie, state, callback };
}

test.each(
  ['GET', 'POST'].flatMap((method) =>
    ['unlink', 'reset', 'both'].map((change) => ({ method, change })),
  ),
)(
  '$method OAuth callback rejects $change committed after proof lookup',
  async ({ method, change }) => {
    const fixture = await oauthFixture();
    const original =
      server.services.oauthConnectService.prepareExistingAuthentication.bind(
        server.services.oauthConnectService,
      );
    const pause = vi
      .spyOn(
        server.services.oauthConnectService,
        'prepareExistingAuthentication',
      )
      .mockImplementationOnce(async (...args) => {
        const proof = await original(...args);
        if (change !== 'reset') {
          expect(
            (
              await server.app.request('/api/oauth/google', {
                method: 'DELETE',
                headers: { Cookie: fixture.ownerCookie },
              })
            ).status,
          ).toBe(200);
        }
        if (change !== 'unlink')
          await withMikroContext(server.services, () =>
            server.services.passwordAuthService.replacePassword(
              fixture.user,
              'replacement-password-123',
            ),
          );
        return proof;
      });
    const response = await fixture.callback(method);
    pause.mockRestore();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'OAUTH_SESSION_EXPIRED',
    });
    expect(
      (await protectedRequest(pair(response) || fixture.callbackCookie)).status,
    ).toBe(401);
    const links = await server.services.mikro.em
      .fork()
      .getRepository(UserOAuthEntitySchema)
      .find({ user: fixture.user.sub });
    expect(links).toHaveLength(change === 'reset' ? 1 : 0);
    if (change === 'reset') expect(links[0]?.access_token).toBe('old');
    vi.restoreAllMocks();
  },
);

test.each(['GET', 'POST'])(
  '%s OAuth login rolls back token updates and state consumption if session save fails',
  async (method) => {
    const fixture = await oauthFixture();
    const save = vi
      .spyOn(BrowserSessionService.prototype, 'save')
      .mockResolvedValueOnce(false);
    const response = await fixture.callback(method);
    save.mockRestore();
    expect(response.status).toBe(401);
    const state = await server.services.mikro.em
      .fork()
      .findOneOrFail(BrowserSessionEntitySchema, {
        data: { oauth: { state: fixture.state } },
      });
    expect(state.data.user).toBeUndefined();
    const link = await withMikroContext(server.services, () =>
      server.services.mikro.userOAuth.findByProviderUserId(
        'google',
        fixture.providerId,
      ),
    );
    expect(link?.access_token).toBe('old');
    expect((await protectedRequest(fixture.callbackCookie)).status).toBe(401);
    // The original state is still valid after the failed transaction.
    const completed = await fixture.callback(method);
    expect(completed.status).toBe(302);
    expect((await protectedRequest(pair(completed))).status).toBe(200);
    expect((await fixture.callback(method)).status).toBe(400);
    vi.restoreAllMocks();
  },
);
