import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
import {
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
} from '../test-utils/fixtures.js';
import {
  createAuthenticatedSession,
  withMikroContext,
} from '../test-utils/helpers.js';
import { securityProcessConfig } from '../test-utils/security-process-config.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';

async function createSecurityApp(
  config: NonNullable<Parameters<typeof createTestApp>[0]>,
) {
  return createTestApp({
    ...config,
    database: process.env['SECURITY_POSTGRES_PORT']
      ? securityProcessConfig(
          `/tmp/grant-completion-${crypto.randomUUID()}/db.sqlite`,
        ).database
      : (config?.database ?? MINIMAL_TEST_CONFIG.database),
  });
}

const body = {
  client_id: 'review-created',
  name: 'Review',
  type: 'public',
  redirect_uris: ['https://review.example/cb'],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  scopes: ['openid'],
  skip_consent: true,
};
function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
afterEach(() => vi.restoreAllMocks());

test.each(
  ['logout', 'demotion'].flatMap((action) =>
    [
      { label: 'create', path: '/api/admin/clients', method: 'POST', body },
      {
        label: 'update',
        path: `/api/admin/clients/${TEST_OAUTH_CLIENT_CONFIG.id}`,
        method: 'PATCH',
        body: { name: 'Unauthorized update' },
      },
      {
        label: 'rotate',
        path: `/api/admin/clients/${TEST_OAUTH_CLIENT_CONFIG.id}/rotate-secret`,
        method: 'POST',
        body: {},
      },
      {
        label: 'bulk',
        path: '/api/admin/clients/bulk-status',
        method: 'POST',
        body: {
          target: { kind: 'filter', filter: { managed_by: 'database' } },
          active: false,
        },
      },
      {
        label: 'terms',
        path: '/api/admin/terms',
        method: 'POST',
        body: {
          id: 'unauthorized-term',
          required: true,
          consent_mode: 'explicit',
          version: '1',
          contents: [
            {
              lang: 'en',
              title: 'Unauthorized term',
              type: 'text',
              content: 'Term',
            },
          ],
        },
      },
    ].map((mutation) => ({ action, ...mutation })),
  ),
)(
  '$action before admin $label must prevent the mutation',
  async ({ action, path, method, body: mutationBody }) => {
    const server = await createSecurityApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      clients: [TEST_OAUTH_CLIENT_CONFIG],
      users: [
        TEST_USER_CONFIG,
        {
          ...TEST_USER_CONFIG,
          sub: 'controller-admin',
          email: 'controller@example.test',
        },
      ],
    });
    const reached = gate();
    const resume = gate();
    try {
      const cookie = `session=${await createAuthenticatedSession(server.app)}`;
      const controller = `session=${await createAuthenticatedSession(server.app, 'controller@example.test')}`;
      await withMikroContext(server.services, () =>
        server.services.mikro.user.nativeUpdate(
          { sub: TEST_USER_CONFIG.sub },
          { managed_by: 'database' },
        ),
      );
      await withMikroContext(server.services, () =>
        server.services.mikro.oauthClient.nativeUpdate(
          { id: TEST_OAUTH_CLIENT_CONFIG.id },
          { managed_by: 'database' },
        ),
      );
      const snapshot = () =>
        withMikroContext(server.services, async () => ({
          clients: (
            await server.services.mikro.oauthClient.find(
              {},
              { populate: ['clientSecretHash'], orderBy: { id: 'ASC' } },
            )
          ).map((client) => ({
            id: client.id,
            name: client.name,
            enabled: client.enabled,
            secret: client.clientSecretHash,
            epoch: client.tokenEpoch,
          })),
          terms: await server.services.mikro.terms.count({}),
        }));
      const before = await snapshot();
      const original = server.services.mikro.user.findBySub.bind(
        server.services.mikro.user,
      );
      vi.spyOn(server.services.mikro.user, 'findBySub').mockImplementationOnce(
        async (input) => {
          const verified = await original(input);
          reached.release();
          await resume.promise;
          return verified;
        },
      );
      const pending = server.app.request(path, {
        method,
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(mutationBody),
      });
      await reached.promise;
      const revoke =
        action === 'logout'
          ? await server.app.request('/api/auth/logout', {
              method: 'POST',
              headers: { Cookie: cookie },
            })
          : await server.app.request(
              `/api/admin/users/${TEST_USER_CONFIG.sub}`,
              {
                method: 'PATCH',
                headers: {
                  Cookie: controller,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ role: 'user' }),
              },
            );
      expect(revoke.status).toBe(200);
      const protectedResponse = await server.app.request('/api/admin/system', {
        headers: { Cookie: cookie },
      });
      expect(protectedResponse.status).toBe(401);
      resume.release();
      const response = await pending;
      expect(response.status).toBe(401);
      expect(await snapshot()).toEqual(before);
    } finally {
      resume.release();
      await server.cleanup();
    }
  },
);

test('stale client authentication must not mint current epoch tokens after deletion and secret rotation', async () => {
  const server = await createSecurityApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        grant_types: ['authorization_code', 'client_credentials'],
      },
    ],
  });
  const reached = gate();
  const resume = gate();
  try {
    await withMikroContext(server.services, async () =>
      server.services.mikro.oauthClient.nativeUpdate(
        { id: TEST_OAUTH_CLIENT_CONFIG.id },
        { managed_by: 'database' },
      ),
    );
    const original =
      server.services.oauthTokenService.issueClientCredentialsToken.bind(
        server.services.oauthTokenService,
      );
    vi.spyOn(
      server.services.oauthTokenService,
      'issueClientCredentialsToken',
    ).mockImplementationOnce(async (input) => {
      reached.release();
      await resume.promise;
      return original(input);
    });
    const pending = server.app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: TEST_OAUTH_CLIENT_CONFIG.client_id,
        client_secret: TEST_OAUTH_CLIENT_CONFIG.client_secret,
      }),
    });
    await reached.promise;
    await withMikroContext(server.services, async () => {
      await server.services.adminConsoleService.deleteClient(
        TEST_OAUTH_CLIENT_CONFIG.id,
      );
      await server.services.adminConsoleService.restoreClient(
        TEST_OAUTH_CLIENT_CONFIG.id,
      );
      await server.services.adminConsoleService.rotateClientSecret(
        TEST_OAUTH_CLIENT_CONFIG.id,
      );
    });
    const fresh = await server.app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: TEST_OAUTH_CLIENT_CONFIG.client_id,
        client_secret: TEST_OAUTH_CLIENT_CONFIG.client_secret,
      }),
    });
    expect(fresh.status).toBe(401);
    resume.release();
    const response = await pending;
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('access_token');
  } finally {
    resume.release();
    await server.cleanup();
  }
});

test('a failed grant revocation must remain retryable', async () => {
  const server = await createSecurityApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        grant_types: ['authorization_code', 'refresh_token'],
        scope: 'openid email offline_access',
      },
    ],
  });
  try {
    const { getAuthorizationCode, exchangeCodeForTokens } = await import(
      '../test-utils/oauth.js'
    );
    const { TEST_PKCE } = await import('../test-utils/fixtures.js');
    const sessionCookie = await createAuthenticatedSession(server.app);
    const { code } = await getAuthorizationCode(server.app, {
      sessionCookie,
      scope: 'openid email offline_access',
    });
    const issued = await exchangeCodeForTokens(server.app, {
      code,
      codeVerifier: TEST_PKCE.codeVerifier,
    });
    expect(issued.status).toBe(200);
    const tokens = z
      .object({ access_token: z.string(), refresh_token: z.string() })
      .parse(await issued.json());
    const fail = vi
      .spyOn(server.services.mikro.em, 'nativeUpdate')
      .mockRejectedValueOnce(new Error('injected grant update failure'));
    const revoke = () =>
      server.app.request('/oauth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: tokens.refresh_token,
          token_type_hint: 'refresh_token',
          client_id: TEST_OAUTH_CLIENT_CONFIG.client_id,
          client_secret: TEST_OAUTH_CLIENT_CONFIG.client_secret,
        }),
      });
    const failed = await revoke();
    expect(failed.status).toBe(500);
    expect(fail).toHaveBeenCalledTimes(1);
    fail.mockRestore();
    const second = await revoke();
    expect(second.status).toBe(200);
    const response = await server.app.request('/oauth/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    expect(response.status).toBe(401);
  } finally {
    await server.cleanup();
  }
});

test('device grant must enforce the same required terms as authorization code', async () => {
  const { TEST_TERMS_CONFIG, TEST_PKCE } = await import(
    '../test-utils/fixtures.js'
  );
  const server = await createSecurityApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    terms: TEST_TERMS_CONFIG,
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        grant_types: [
          'authorization_code',
          'urn:ietf:params:oauth:grant-type:device_code',
        ],
      },
    ],
  });
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    const authorize = await server.app.request(
      `/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: TEST_OAUTH_CLIENT_CONFIG.client_id, redirect_uri: TEST_OAUTH_CLIENT_CONFIG.redirect_uris[0] ?? '', scope: 'openid email', code_challenge: TEST_PKCE.codeChallenge, code_challenge_method: 'S256' })}`,
      { headers: { Cookie: cookie } },
    );
    expect(authorize.status).toBe(302);
    expect(new URL(authorize.headers.get('location') ?? '').pathname).toBe(
      '/terms',
    );
    const form = (path: string, values: Record<string, string>, session = '') =>
      server.app.request(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: session,
        },
        body: new URLSearchParams(values),
      });
    const device = await form('/oauth/device_authorization', {
      client_id: TEST_OAUTH_CLIENT_CONFIG.client_id,
      client_secret: TEST_OAUTH_CLIENT_CONFIG.client_secret,
      scope: 'openid email',
    });
    expect(device.status).toBe(200);
    const codes = z
      .object({ device_code: z.string(), user_code: z.string() })
      .parse(await device.json());
    const approval = await form(
      '/oauth/device',
      { user_code: codes.user_code, decision: 'approve' },
      cookie,
    );
    expect(approval.status).toBe(303);
    expect(
      new URL(approval.headers.get('location') ?? '', 'http://localhost')
        .pathname,
    ).toBe('/terms');
    const issued = await form('/oauth/token', {
      client_id: TEST_OAUTH_CLIENT_CONFIG.client_id,
      client_secret: TEST_OAUTH_CLIENT_CONFIG.client_secret,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: codes.device_code,
    });
    expect(issued.status).toBe(400);
    expect(await issued.json()).toMatchObject({
      error: 'authorization_pending',
    });
  } finally {
    await server.cleanup();
  }
});

test('authorization must not expose a usable code after browser logout wins', async () => {
  const { TEST_PKCE } = await import('../test-utils/fixtures.js');
  const { exchangeCodeForTokens } = await import('../test-utils/oauth.js');
  const server = await createSecurityApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [{ ...TEST_OAUTH_CLIENT_CONFIG, skip_consent: true }],
  });
  const reached = gate();
  const resume = gate();
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    const original = server.services.oauthAuthorizeService.authorize.bind(
      server.services.oauthAuthorizeService,
    );
    vi.spyOn(
      server.services.oauthAuthorizeService,
      'authorize',
    ).mockImplementationOnce(async (input) => {
      reached.release();
      await resume.promise;
      return original(input);
    });
    const pending = server.app.request(
      `/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: TEST_OAUTH_CLIENT_CONFIG.client_id, redirect_uri: TEST_OAUTH_CLIENT_CONFIG.redirect_uris[0] ?? '', scope: 'openid email', code_challenge: TEST_PKCE.codeChallenge, code_challenge_method: 'S256' })}`,
      { headers: { Cookie: cookie } },
    );
    await reached.promise;
    const logout = await server.app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(logout.status).toBe(200);
    resume.release();
    const response = await pending;
    expect(response.status).toBe(401);
    const location = response.headers.get('location');
    if (location) {
      const code = new URL(location).searchParams.get('code');
      if (code) {
        const tokens = await exchangeCodeForTokens(server.app, {
          code,
          codeVerifier: TEST_PKCE.codeVerifier,
        });
        const payload = z
          .object({ access_token: z.string() })
          .parse(await tokens.json());
        const userinfo = await server.app.request('/oauth/userinfo', {
          headers: { Authorization: `Bearer ${payload.access_token}` },
        });
        expect(userinfo.status).toBe(401);
      }
    }
    expect(response.headers.has('location')).toBe(false);
    expect(
      await withMikroContext(server.services, () =>
        server.services.mikro.oauthCode.count({}),
      ),
    ).toBe(0);
  } finally {
    resume.release();
    await server.cleanup();
  }
});

const ALL_GRANTS = [
  'authorization_code',
  'refresh_token',
  'client_credentials',
  'urn:ietf:params:oauth:grant-type:device_code',
];
async function tokenFixture() {
  return createSecurityApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    admin: { enabled: true },
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        grant_types: ALL_GRANTS,
        scope: 'openid email offline_access service',
      },
    ],
  });
}
function oauthForm(
  server: Awaited<ReturnType<typeof createTestApp>>,
  path: string,
  values: Record<string, string>,
) {
  return server.app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TEST_OAUTH_CLIENT_CONFIG.client_id,
      client_secret: TEST_OAUTH_CLIENT_CONFIG.client_secret,
      ...values,
    }),
  });
}
async function refreshable(server: Awaited<ReturnType<typeof createTestApp>>) {
  const { getAuthorizationCode, exchangeCodeForTokens } = await import(
    '../test-utils/oauth.js'
  );
  const { TEST_PKCE } = await import('../test-utils/fixtures.js');
  const sessionCookie = await createAuthenticatedSession(server.app);
  const { code } = await getAuthorizationCode(server.app, {
    sessionCookie,
    scope: 'openid email offline_access',
  });
  const result = await exchangeCodeForTokens(server.app, {
    code,
    codeVerifier: TEST_PKCE.codeVerifier,
  });
  expect(result.status).toBe(200);
  return z
    .object({ access_token: z.string(), refresh_token: z.string() })
    .parse(await result.json());
}

test.each(ALL_GRANTS)(
  '%s preserves the credential proof until its client lock',
  async (grantType) => {
    const server = await tokenFixture();
    const reached = gate();
    const resume = gate();
    try {
      await withMikroContext(server.services, () =>
        server.services.mikro.oauthClient.nativeUpdate(
          { id: TEST_OAUTH_CLIENT_CONFIG.id },
          { managed_by: 'database' },
        ),
      );
      const { TEST_PKCE } = await import('../test-utils/fixtures.js');
      const { getAuthorizationCode } = await import('../test-utils/oauth.js');
      let values: Record<string, string> = { grant_type: grantType };
      if (grantType === 'authorization_code') {
        const sessionCookie = await createAuthenticatedSession(server.app);
        const { code } = await getAuthorizationCode(server.app, {
          sessionCookie,
          scope: 'openid email',
        });
        values = {
          ...values,
          code,
          redirect_uri: TEST_OAUTH_CLIENT_CONFIG.redirect_uris[0] ?? '',
          code_verifier: TEST_PKCE.codeVerifier,
        };
      } else if (grantType === 'refresh_token')
        values['refresh_token'] = (await refreshable(server)).refresh_token;
      else if (grantType.includes('device_code')) {
        const issued = await oauthForm(server, '/oauth/device_authorization', {
          scope: 'openid email',
        });
        const device = z
          .object({ device_code: z.string(), user_code: z.string() })
          .parse(await issued.json());
        const cookie = `session=${await createAuthenticatedSession(server.app)}`;
        expect(
          (
            await server.app.request('/oauth/device', {
              method: 'POST',
              headers: {
                Cookie: cookie,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ user_code: device.user_code }),
            })
          ).status,
        ).toBe(200);
        values['device_code'] = device.device_code;
      }
      const original =
        server.services.oauthClientService.validateClientSecretIfRequired.bind(
          server.services.oauthClientService,
        );
      vi.spyOn(
        server.services.oauthClientService,
        'validateClientSecretIfRequired',
      ).mockImplementationOnce(async (...args) => {
        const proof = await original(...args);
        reached.release();
        await resume.promise;
        return proof;
      });
      const pending = oauthForm(server, '/oauth/token', values);
      await reached.promise;
      const rotated = await withMikroContext(server.services, () =>
        server.services.adminConsoleService.rotateClientSecret(
          TEST_OAUTH_CLIENT_CONFIG.id,
        ),
      );
      if (!rotated) throw new Error('Missing client');
      resume.release();
      const stale = await pending;
      expect(stale.status).toBe(401);
      expect(await stale.json()).toMatchObject({ error: 'invalid_client' });
      const fresh = await oauthForm(server, '/oauth/token', {
        ...values,
        client_secret: rotated.client_secret,
      });
      expect(fresh.status).toBe(200);
    } finally {
      resume.release();
      await server.cleanup();
    }
  },
);

test.each(['grant', 'scope'])(
  'issuance rechecks changed client %s policy',
  async (change) => {
    const server = await tokenFixture();
    try {
      const authentication = await withMikroContext(server.services, () =>
        server.services.oauthClientService.validateClientSecretIfRequired(
          TEST_OAUTH_CLIENT_CONFIG.client_id,
          TEST_OAUTH_CLIENT_CONFIG.client_secret,
        ),
      );
      await withMikroContext(server.services, () =>
        server.services.mikro.oauthClient.nativeUpdate(
          { id: TEST_OAUTH_CLIENT_CONFIG.id },
          change === 'grant'
            ? { grantTypes: ['authorization_code'] }
            : { scopes: ['openid'] },
        ),
      );
      await expect(
        withMikroContext(server.services, () =>
          server.services.oauthTokenService.issueClientCredentialsToken({
            authentication,
            clientId: TEST_OAUTH_CLIENT_CONFIG.client_id,
            scope: ['service'],
          }),
        ),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      await server.cleanup();
    }
  },
);

test.each([3, 4, 5])(
  'revocation rolls back all writes when storage stage %s fails',
  async (stage) => {
    const server = await tokenFixture();
    try {
      const tokens = await refreshable(server);
      const decoded = server.services.jwtService.decodeToken(
        tokens.refresh_token,
      );
      if (!decoded?.jti) throw new Error('Missing JTI');
      const jti = decoded.jti;
      const original = server.services.mikro.em.nativeUpdate.bind(
        server.services.mikro.em,
      );
      const fail =
        stage === 5
          ? vi
              .spyOn(server.services.mikro.revokedToken, 'revokeGrant')
              .mockRejectedValueOnce(
                new Error('injected family storage failure'),
              )
          : vi.spyOn(server.services.mikro.em, 'nativeUpdate');
      if (stage !== 5) {
        const update = vi.mocked(server.services.mikro.em.nativeUpdate);
        for (let i = 1; i < stage; i++) update.mockImplementationOnce(original);
        update.mockRejectedValueOnce(
          new Error('injected revocation write failure'),
        );
      }
      const request = () =>
        oauthForm(server, '/oauth/revoke', {
          token: tokens.refresh_token,
          token_type_hint: 'refresh_token',
        });
      expect((await request()).status).toBe(500);
      fail.mockRestore();
      await withMikroContext(server.services, async () => {
        expect(await server.services.mikro.revokedToken.count({ jti })).toBe(0);
        await expect(
          server.services.jwtService.verifyRefreshToken(tokens.refresh_token),
        ).resolves.toBeDefined();
      });
      expect((await request()).status).toBe(200);
      expect(
        (
          await server.app.request('/oauth/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })
        ).status,
      ).toBe(401);
    } finally {
      await server.cleanup();
    }
  },
);

test.each(['rotated', 'partial'])(
  'explicit revocation completes a %s refresh revocation',
  async (kind) => {
    const server = await tokenFixture();
    try {
      const first = await refreshable(server);
      let access = first.access_token;
      if (kind === 'rotated') {
        const result = await oauthForm(server, '/oauth/token', {
          grant_type: 'refresh_token',
          refresh_token: first.refresh_token,
        });
        expect(result.status).toBe(200);
        access = z
          .object({ access_token: z.string() })
          .parse(await result.json()).access_token;
      } else {
        const decoded = server.services.jwtService.decodeToken(
          first.refresh_token,
        );
        if (!decoded?.jti || !decoded.exp || !decoded.sub)
          throw new Error('Missing claims');
        await withMikroContext(server.services, () =>
          server.services.mikro.revokedToken.revokeToken({
            jti: decoded.jti ?? '',
            token_type: 'refresh_token',
            userSub: decoded.sub,
            clientId: TEST_OAUTH_CLIENT_CONFIG.id,
            expires_at: new Date((decoded.exp ?? 0) * 1000),
          }),
        );
      }
      const request = () =>
        oauthForm(server, '/oauth/revoke', {
          token: first.refresh_token,
          token_type_hint: 'refresh_token',
        });
      expect((await request()).status).toBe(200);
      expect((await request()).status).toBe(200);
      expect(
        (
          await server.app.request('/oauth/userinfo', {
            headers: { Authorization: `Bearer ${access}` },
          })
        ).status,
      ).toBe(401);
    } finally {
      await server.cleanup();
    }
  },
);

test.each([
  { responseType: 'code', mode: 'query' },
  { responseType: 'code', mode: 'fragment' },
  { responseType: 'code', mode: 'form_post' },
  { responseType: 'id_token', mode: 'fragment' },
  { responseType: 'id_token', mode: 'form_post' },
])(
  'session save failure rolls back $responseType / $mode issuance',
  async ({ responseType, mode }) => {
    const { BrowserSessionService } = await import(
      './browser-session.service.js'
    );
    const { TEST_PKCE } = await import('../test-utils/fixtures.js');
    const server = await createSecurityApp({
      ...MINIMAL_TEST_CONFIG,
      users: [TEST_USER_CONFIG],
      clients: [
        {
          ...TEST_OAUTH_CLIENT_CONFIG,
          response_types: ['code', 'id_token'],
          grant_types: ['authorization_code', 'implicit'],
          skip_consent: true,
        },
      ],
    });
    try {
      const cookie = `session=${await createAuthenticatedSession(server.app)}`;
      vi.spyOn(BrowserSessionService.prototype, 'save').mockResolvedValueOnce(
        false,
      );
      const response = await server.app.request(
        `/oauth/authorize?${new URLSearchParams({ response_type: responseType, response_mode: mode, nonce: 'nonce', client_id: TEST_OAUTH_CLIENT_CONFIG.client_id, redirect_uri: TEST_OAUTH_CLIENT_CONFIG.redirect_uris[0] ?? '', scope: 'openid email', code_challenge: TEST_PKCE.codeChallenge, code_challenge_method: 'S256' })}`,
        { headers: { Cookie: cookie } },
      );
      expect(response.status).toBe(401);
      expect(response.headers.has('location')).toBe(false);
      expect(response.headers.get('set-cookie') ?? '').not.toMatch(
        /(?:^|[,;]\s*)session=[^;]/,
      );
      expect(await response.text()).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);
      await withMikroContext(server.services, async () => {
        expect(await server.services.mikro.oauthCode.count({})).toBe(0);
      });
    } finally {
      await server.cleanup();
    }
  },
);

test('admin changes roll back when browser persistence fails', async () => {
  const { BrowserSessionService } = await import(
    './browser-session.service.js'
  );
  const server = await tokenFixture();
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    vi.spyOn(BrowserSessionService.prototype, 'save').mockResolvedValueOnce(
      false,
    );
    const response = await server.app.request('/api/admin/clients', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(401);
    expect(
      await withMikroContext(server.services, () =>
        server.services.mikro.oauthClient.count({ clientId: body.client_id }),
      ),
    ).toBe(0);
  } finally {
    await server.cleanup();
  }
});

test('device terms acceptance requires a separate approval and rejects a newer required version', async () => {
  const { TEST_TERMS_CONFIG } = await import('../test-utils/fixtures.js');
  const server = await createSecurityApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    terms: TEST_TERMS_CONFIG,
    clients: [{ ...TEST_OAUTH_CLIENT_CONFIG, grant_types: ALL_GRANTS }],
  });
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    const issued = await oauthForm(server, '/oauth/device_authorization', {
      scope: 'openid email',
    });
    const device = z
      .object({ device_code: z.string(), user_code: z.string() })
      .parse(await issued.json());
    const approve = () =>
      server.app.request('/oauth/device', {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ user_code: device.user_code }),
      });
    const first = await approve();
    expect(first.status).toBe(303);
    const terms = new URL(
      first.headers.get('location') ?? '',
      'http://localhost',
    );
    const returnTo = terms.searchParams.get('redirect');
    expect(returnTo).toBe(
      `/oauth/device?${new URLSearchParams({ user_code: device.user_code })}`,
    );
    const agree = () =>
      server.app.request('/api/terms/consent', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consents: TEST_TERMS_CONFIG.map((term) => ({
            termsId: term.id,
            agreed: true,
            consentType: term.consent_mode,
          })),
        }),
      });
    expect((await agree()).status).toBe(200);
    const pending = await oauthForm(server, '/oauth/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: device.device_code,
    });
    expect(await pending.json()).toMatchObject({
      error: 'authorization_pending',
    });
    expect(
      (
        await server.app.request(returnTo ?? '', {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(200);
    await withMikroContext(server.services, () =>
      server.services.mikro.terms.nativeUpdate(
        { required: true },
        { version: '2.0.0' },
      ),
    );
    expect((await approve()).status).toBe(303);
    expect((await agree()).status).toBe(200);
    expect((await approve()).status).toBe(200);
    expect(
      (
        await oauthForm(server, '/oauth/token', {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: device.device_code,
        })
      ).status,
    ).toBe(200);
  } finally {
    await server.cleanup();
  }
});

test('revocation also rejects a credential proof invalidated by secret rotation', async () => {
  const server = await tokenFixture();
  const reached = gate();
  const resume = gate();
  try {
    const tokens = await refreshable(server);
    await withMikroContext(server.services, () =>
      server.services.mikro.oauthClient.nativeUpdate(
        { id: TEST_OAUTH_CLIENT_CONFIG.id },
        { managed_by: 'database' },
      ),
    );
    const original =
      server.services.oauthClientService.validateClientSecretIfRequired.bind(
        server.services.oauthClientService,
      );
    vi.spyOn(
      server.services.oauthClientService,
      'validateClientSecretIfRequired',
    ).mockImplementationOnce(async (...args) => {
      const proof = await original(...args);
      reached.release();
      await resume.promise;
      return proof;
    });
    const pending = oauthForm(server, '/oauth/revoke', {
      token: tokens.refresh_token,
      token_type_hint: 'refresh_token',
    });
    await reached.promise;
    await withMikroContext(server.services, () =>
      server.services.adminConsoleService.rotateClientSecret(
        TEST_OAUTH_CLIENT_CONFIG.id,
      ),
    );
    resume.release();
    expect((await pending).status).toBe(401);
    expect(
      (
        await server.app.request('/oauth/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
      ).status,
    ).toBe(200);
  } finally {
    resume.release();
    await server.cleanup();
  }
});

test('an error replacing a prepared redirect discards Location', async () => {
  const { BrowserSessionService } = await import(
    './browser-session.service.js'
  );
  const { TEST_PKCE } = await import('../test-utils/fixtures.js');
  const server = await tokenFixture();
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    vi.spyOn(BrowserSessionService.prototype, 'save').mockResolvedValueOnce(
      false,
    );
    const response = await server.app.request(
      `/oauth/authorize?${new URLSearchParams({ response_type: 'code', prompt: 'login', client_id: TEST_OAUTH_CLIENT_CONFIG.client_id, redirect_uri: TEST_OAUTH_CLIENT_CONFIG.redirect_uris[0] ?? '', scope: 'openid email', code_challenge: TEST_PKCE.codeChallenge, code_challenge_method: 'S256' })}`,
      { headers: { Cookie: cookie } },
    );
    expect(response.status).toBe(401);
    expect(response.headers.has('location')).toBe(false);
    expect(response.headers.get('cache-control')).toContain('no-store');
  } finally {
    await server.cleanup();
  }
});
