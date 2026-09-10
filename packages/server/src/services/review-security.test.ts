import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { BrowserSessionEntitySchema } from '../entities/browser-session.entity.js';
import { google } from '../entrypoints/identity-providers/google.js';
import { TEST_TERMS_CONFIG } from '../test-utils/fixtures.js';
import { withMikroContext } from '../test-utils/helpers.js';
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
          `/tmp/epoch-review-${crypto.randomUUID()}/test.sqlite`,
        ).database
      : MINIMAL_TEST_CONFIG.database,
    registration: { enabled: true, allowed_email_patterns: ['*'] },
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
async function user() {
  return withMikroContext(server.services, () =>
    server.services.passwordAuthService.createDatabaseUser({
      email: `${crypto.randomUUID()}@review.test`,
      password: 'before-reset-password',
    }),
  );
}
function post(path: string, body: unknown) {
  return server.app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function reset(sub: string) {
  const token = await withMikroContext(server.services, async () => {
    const result = await server.services.passwordResetService.generateToken({
      userSub: sub,
    });
    await server.services.mikro.em.flush();
    return result.token;
  });
  expect(
    (
      await post('/api/auth/password/reset', {
        token,
        password: 'after-reset-password',
      })
    ).status,
  ).toBe(200);
}
test(' password reset revokes a session issued by a clock-ahead instance', async () => {
  const entity = await user();
  const cookie = await createStoredSessionCookie(
    server.services,
    JSON.stringify({
      user: {
        sub: entity.sub,
        authenticated_at: Math.floor(Date.now() / 1000),
      },
    }),
    server.services.config.security.session_secret,
  );
  const em = server.services.mikro.em.fork();
  const session = await em.findOneOrFail(BrowserSessionEntitySchema, {
    data: { user: { sub: entity.sub } },
  });
  if (session.data.user)
    session.data.user.authenticated_at = Math.floor(
      (Date.now() + 30_000) / 1000,
    );
  await em.flush();
  await reset(entity.sub);
  const response = await server.app.request('/api/user/oauth-accounts', {
    headers: { Cookie: `session=${cookie}` },
  });
  expect(response.status).toBe(401);
});
test(' an OAuth link paused before password reset must not persist afterward', async () => {
  const entity = await user();
  const state = crypto.randomUUID();
  const cookie = await createStoredSessionCookie(
    server.services,
    JSON.stringify({
      user: {
        sub: entity.sub,
        authenticated_at: Math.floor(Date.now() / 1000),
      },
      oauth: {
        state,
        codeVerifier: 'fixture',
        providerId: 'google',
        mode: 'link',
        linkSubject: entity.sub,
        linkEpoch: entity.token_epoch,
      },
      security: { grants: {}, oauthExpiresAt: Date.now() + 60_000 },
    }),
    server.services.config.security.session_secret,
  );
  const started = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const exchange = vi
    .spyOn(server.services.oauthConnectService, 'exchangeCodeForTokens')
    .mockResolvedValue({
      access_token: 'mock-provider-token',
      token_type: 'Bearer',
    });
  const info = vi
    .spyOn(server.services.oauthConnectService, 'fetchUserInfo')
    .mockImplementation(async () => {
      started.resolve();
      await resume.promise;
      return {
        id: 'attacker-provider-id',
        email: 'attacker@review.test',
        email_verified: true,
      };
    });
  const pending = server.app.request(
    `/api/oauth/google/callback?code=fixture&state=${state}`,
    { headers: { Cookie: `session=${cookie}` } },
  );
  await started.promise;
  await reset(entity.sub);
  resume.resolve();
  const response = await pending;
  expect(response.status).toBe(401);
  const linked = await withMikroContext(server.services, () =>
    server.services.mikro.userOAuth.count({
      user: entity.sub,
      provider_user_id: 'attacker-provider-id',
    }),
  );
  const loginState = crypto.randomUUID();
  const loginCookie = await createStoredSessionCookie(
    server.services,
    JSON.stringify({
      oauth: {
        state: loginState,
        codeVerifier: 'fixture',
        providerId: 'google',
        mode: 'login',
      },
      security: { grants: {}, oauthExpiresAt: Date.now() + 60_000 },
    }),
    server.services.config.security.session_secret,
  );
  const login = await server.app.request(
    `/api/oauth/google/callback?code=fixture&state=${loginState}`,
    { headers: { Cookie: `session=${loginCookie}` } },
  );
  exchange.mockRestore();
  info.mockRestore();
  const authenticatedCookie =
    login.headers.get('set-cookie')?.split(';')[0] ?? '';
  const regainedAccess = await server.app.request('/api/user/oauth-accounts', {
    headers: { Cookie: authenticatedCookie },
  });
  expect(regainedAccess.status).toBe(401);
  expect(linked).toBe(0);
});
test(' unused email verification cannot recreate login after password reset', async () => {
  const entity = await user();
  const token = await withMikroContext(server.services, async () => {
    const result = await server.services.emailService.generateToken({
      userSub: entity.sub,
    });
    await server.services.mikro.em.flush();
    return result.token;
  });
  await reset(entity.sub);
  const response = await post('/api/auth/email/verify', { token });
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  const protectedResponse = await server.app.request(
    '/api/user/oauth-accounts',
    { headers: { Cookie: cookie } },
  );
  expect(protectedResponse.status).toBe(401);
});
test(' pending OAuth registration is consumed before a second browser can use it', async () => {
  const email = `${crypto.randomUUID()}@review.test`;
  const registrationToken = await withMikroContext(
    server.services,
    async () => {
      return server.services.mikro.pendingOAuthRegistration.createPendingRegistration(
        {
          providerId: 'google',
          accessToken: 'fixture',
          tokenType: 'Bearer',
          userInfo: {
            id: 'registration-user',
            email,
            email_verified: true,
          },
          expiresAt: new Date(Date.now() + 60_000),
        },
      );
    },
  );
  const consents = TEST_TERMS_CONFIG.map((term) => ({
    termsId: term.id,
    agreed: true,
  }));
  const [firstResponse, secondResponse] = await Promise.all([
    post('/api/terms/consent', { registrationToken, consents }),
    post('/api/terms/consent', { registrationToken, consents }),
  ]);
  expect([firstResponse.status, secondResponse.status].sort()).toEqual([
    200, 400,
  ]);
  for (const response of [firstResponse, secondResponse]) {
    const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect(
      (
        await server.app.request('/api/user/oauth-accounts', {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(response.status === 200 ? 200 : 401);
  }
});

test.each(['logout', 'reset'])(
  'passkey registration rolls back when %s finishes during verification',
  async (revocation) => {
    const entity = await user();
    server.services.config.auth.passkey.enabled = true;
    const cookie = await createStoredSessionCookie(
      server.services,
      JSON.stringify({
        user: {
          sub: entity.sub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
        passkey_challenge: 'test-challenge',
        security: { grants: {}, challengeExpiresAt: Date.now() + 60000 },
      }),
      server.services.config.security.session_secret,
    );
    const started = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const credentialId = crypto.randomUUID();
    const prepare = vi
      .spyOn(server.services.passkeyService, 'prepareRegistration')
      .mockImplementation(async () => {
        started.resolve();
        await resume.promise;
        return {
          verified: true,
          registrationInfo: {
            fmt: 'none',
            aaguid: '',
            credential: {
              id: credentialId,
              publicKey: new Uint8Array([1, 2, 3]),
              counter: 0,
            },
            credentialType: 'public-key',
            attestationObject: new Uint8Array(),
            userVerified: true,
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            origin: 'http://localhost:8080',
            rpID: 'localhost',
          },
        };
      });
    try {
      const pending = server.app.request('/api/user/passkeys/register/verify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `session=${cookie}`,
        },
        body: JSON.stringify({
          response: {
            id: credentialId,
            rawId: credentialId,
            response: { clientDataJSON: 'e30', attestationObject: 'e30' },
            type: 'public-key',
            clientExtensionResults: {},
          },
        }),
      });
      await Promise.race([
        started.promise,
        Promise.resolve(pending).then((response) => {
          throw new Error(
            `Request ended before verification: ${response.status}`,
          );
        }),
      ]);
      if (revocation === 'reset') await reset(entity.sub);
      else
        expect(
          (
            await server.app.request('/api/auth/logout', {
              method: 'POST',
              headers: { cookie: `session=${cookie}` },
            })
          ).status,
        ).toBe(200);
      resume.resolve();
      expect((await pending).status).toBe(401);
      expect(
        await withMikroContext(server.services, () =>
          server.services.mikro.userPasskey.count({ user: entity.sub }),
        ),
      ).toBe(0);
    } finally {
      resume.resolve();
      prepare.mockRestore();
    }
  },
);

test.each(['password', 'restore'])(
  'email links from before %s changes are rejected and a new link still logs in',
  async (change) => {
    const entity = await user();
    const old = await withMikroContext(server.services, async () => {
      const token = await server.services.emailService.generateToken({
        userSub: entity.sub,
      });
      await server.services.mikro.em.flush();
      return token.token;
    });
    await withMikroContext(server.services, async () => {
      if (change === 'password')
        await server.services.passwordAuthService.changePassword(
          entity,
          'before-reset-password',
          'changed-password-123',
        );
      else {
        await server.services.userService.requestDeletion(entity.sub);
        await server.services.userService.restoreAdminUser(entity.sub);
      }
    });
    expect((await post('/api/auth/email/verify', { token: old })).status).toBe(
      400,
    );
    const fresh = await withMikroContext(server.services, async () => {
      const token = await server.services.emailService.generateToken({
        userSub: entity.sub,
      });
      await server.services.mikro.em.flush();
      return token.token;
    });
    const response = await post('/api/auth/email/verify', { token: fresh });
    expect(response.status).toBe(200);
    expect(
      (
        await server.app.request('/api/user/oauth-accounts', {
          headers: {
            cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
          },
        })
      ).status,
    ).toBe(200);
  },
);

test.each(['link', 'consent'])(
  'registration %s failure rolls back the claim, created user, OAuth link and consents',
  async (stage) => {
    const email = `${crypto.randomUUID()}@review.test`;
    const registrationToken = await withMikroContext(server.services, () =>
      server.services.mikro.pendingOAuthRegistration.createPendingRegistration({
        providerId: 'google',
        accessToken: 'private-provider-token',
        tokenType: 'Bearer',
        userInfo: { id: email, email, email_verified: true },
        expiresAt: new Date(Date.now() + 60000),
      }),
    );
    const consents = TEST_TERMS_CONFIG.map((term) => ({
      termsId: term.id,
      agreed: true,
    }));
    const record =
      stage === 'consent'
        ? vi
            .spyOn(server.services.termsService, 'recordConsents')
            .mockRejectedValueOnce(
              new Error('injected consent storage failure'),
            )
        : vi
            .spyOn(server.services.mikro.userOAuth, 'linkAccount')
            .mockRejectedValueOnce(
              new Error('injected user/link storage failure'),
            );
    try {
      expect(
        (await post('/api/terms/consent', { registrationToken, consents }))
          .status,
      ).toBe(500);
    } finally {
      record.mockRestore();
    }
    await withMikroContext(server.services, async () => {
      expect(await server.services.mikro.user.count({ email })).toBe(0);
      expect(
        await server.services.mikro.userOAuth.count({
          provider_user_id: email,
        }),
      ).toBe(0);
      expect(
        await server.services.mikro.pendingOAuthRegistration.findValidByToken(
          registrationToken,
        ),
      ).not.toBeNull();
    });
    expect(
      (await post('/api/terms/consent', { registrationToken, consents }))
        .status,
    ).toBe(200);
    expect(
      (await post('/api/terms/consent', { registrationToken, consents }))
        .status,
    ).toBe(400);
  },
);

test('email verification and token consumption roll back when session storage fails', async () => {
  const entity = await user();
  const token = await withMikroContext(server.services, async () => {
    const result = await server.services.emailService.generateToken({
      userSub: entity.sub,
    });
    await server.services.mikro.em.flush();
    return result.token;
  });
  const save = vi
    .spyOn(BrowserSessionService.prototype, 'save')
    .mockRejectedValueOnce(new Error('injected session storage failure'));
  try {
    expect((await post('/api/auth/email/verify', { token })).status).toBe(500);
  } finally {
    save.mockRestore();
  }
  await withMikroContext(server.services, async () => {
    expect(
      (await server.services.mikro.user.findOneOrFail({ sub: entity.sub }))
        .email_verified,
    ).toBe(false);
    expect(
      (await server.services.mikro.emailVerification.findOneOrFail({ token }))
        .verified,
    ).toBe(false);
  });
  expect((await post('/api/auth/email/verify', { token })).status).toBe(200);
});

test('pending registration remains usable after final session storage fails', async () => {
  const email = `${crypto.randomUUID()}@review.test`;
  const registrationToken = await withMikroContext(server.services, () =>
    server.services.mikro.pendingOAuthRegistration.createPendingRegistration({
      providerId: 'google',
      accessToken: 'private-provider-token',
      tokenType: 'Bearer',
      userInfo: { id: email, email, email_verified: true },
      expiresAt: new Date(Date.now() + 60000),
    }),
  );
  const consents = TEST_TERMS_CONFIG.map((term) => ({
    termsId: term.id,
    agreed: true,
  }));
  const save = vi
    .spyOn(BrowserSessionService.prototype, 'save')
    .mockRejectedValueOnce(new Error('injected session storage failure'));
  try {
    expect(
      (await post('/api/terms/consent', { registrationToken, consents }))
        .status,
    ).toBe(500);
  } finally {
    save.mockRestore();
  }
  await withMikroContext(server.services, async () => {
    expect(await server.services.mikro.user.count({ email })).toBe(0);
    expect(
      await server.services.mikro.userOAuth.count({ provider_user_id: email }),
    ).toBe(0);
    expect(
      await server.services.mikro.pendingOAuthRegistration.findValidByToken(
        registrationToken,
      ),
    ).not.toBeNull();
  });
  expect(
    (await post('/api/terms/consent', { registrationToken, consents })).status,
  ).toBe(200);
});
