import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
import {
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../test-utils/fixtures.js';
import {
  createAuthenticatedSession,
  withMikroContext,
} from '../test-utils/helpers.js';
import { exchangeCodeForTokens } from '../test-utils/oauth.js';
import { securityProcessConfig } from '../test-utils/security-process-config.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';

function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
afterEach(() => vi.restoreAllMocks());
async function fixture(skipConsent = false) {
  return createTestApp({
    ...MINIMAL_TEST_CONFIG,
    database: process.env['SECURITY_POSTGRES_PORT']
      ? securityProcessConfig(
          `/tmp/consent-policy-${crypto.randomUUID()}/db.sqlite`,
        ).database
      : MINIMAL_TEST_CONFIG.database,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
    clients: [
      {
        ...TEST_OAUTH_CLIENT_CONFIG,
        scope: 'openid email offline_access',
        grant_types: ['authorization_code', 'refresh_token'],
        skip_consent: skipConsent,
      },
    ],
  });
}
const query = {
  response_type: 'code',
  client_id: TEST_OAUTH_CLIENT.clientId,
  redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
  scope: 'openid email offline_access',
  code_challenge: TEST_PKCE.codeChallenge,
  code_challenge_method: 'S256',
};

test('consent must not persist after logout commits', async () => {
  const server = await fixture();
  const reached = gate();
  const resume = gate();
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    const original = server.services.oauthClientService.findByClientId.bind(
      server.services.oauthClientService,
    );
    vi.spyOn(
      server.services.oauthClientService,
      'findByClientId',
    ).mockImplementationOnce(async (input) => {
      const client = await original(input);
      reached.release();
      await resume.promise;
      return client;
    });
    const pending = server.app.request('/api/consent', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, decision: 'allow', prompt: 'consent' }),
    });
    await reached.promise;
    expect(
      (
        await server.app.request('/api/auth/logout', {
          method: 'POST',
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await server.app.request('/api/user/oauth-accounts', {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
    resume.release();
    const response = await pending;
    const consent = await withMikroContext(server.services, () =>
      server.services.mikro.userConsent.findConsent(
        TEST_USER_CONFIG.sub,
        TEST_OAUTH_CLIENT_CONFIG.id,
      ),
    );
    const newCookie = `session=${await createAuthenticatedSession(server.app)}`;
    const later = await server.app.request(
      `/oauth/authorize?${new URLSearchParams(query)}`,
      { headers: { Cookie: newCookie } },
    );
    const laterCode = new URL(
      later.headers.get('location') ?? '/',
      'http://localhost',
    ).searchParams.has('code');
    expect(response.status).toBe(401);
    expect(laterCode).toBe(false);
    expect(consent).toBeNull();
  } finally {
    resume.release();
    await server.cleanup();
  }
});

test.each(['consent-policy', 'required-terms'])(
  '%s change committed before issuance must be enforced',
  async (policy) => {
    const server = await fixture(true);
    const reached = gate();
    const resume = gate();
    try {
      const cookie = `session=${await createAuthenticatedSession(server.app)}`;
      const adminCookie = `session=${await createAuthenticatedSession(server.app)}`;
      await withMikroContext(server.services, () =>
        server.services.mikro.oauthClient.nativeUpdate(
          { id: TEST_OAUTH_CLIENT_CONFIG.id },
          { managed_by: 'database' },
        ),
      );
      const original = server.services.oauthAuthorizeService.authorize.bind(
        server.services.oauthAuthorizeService,
      );
      vi.spyOn(
        server.services.oauthAuthorizeService,
        'authorize',
      ).mockImplementationOnce(async (input) => {
        const complete = input.completeAuthorization;
        if (!complete) throw new Error('Missing completion callback');
        return original({
          ...input,
          completeAuthorization: async (proof, operation) => {
            reached.release();
            await resume.promise;
            return complete(proof, operation);
          },
        });
      });
      const pending = server.app.request(
        `/oauth/authorize?${new URLSearchParams(query)}`,
        { headers: { Cookie: cookie } },
      );
      await reached.promise;
      const update =
        policy === 'consent-policy'
          ? await server.app.request(
              `/api/admin/clients/${TEST_OAUTH_CLIENT_CONFIG.id}`,
              {
                method: 'PATCH',
                headers: {
                  Cookie: adminCookie,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: 'My App',
                  redirect_uris: TEST_OAUTH_CLIENT_CONFIG.redirect_uris,
                  grant_types: ['authorization_code', 'refresh_token'],
                  response_types: ['code'],
                  scopes: ['openid', 'email', 'offline_access'],
                  skip_consent: false,
                }),
              },
            )
          : await server.app.request('/api/admin/terms', {
              method: 'POST',
              headers: {
                Cookie: adminCookie,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: 'new-required',
                required: true,
                consent_mode: 'explicit',
                version: '1',
                contents: [
                  {
                    lang: 'en',
                    title: 'New terms',
                    type: 'text',
                    content: 'New required terms',
                  },
                ],
              }),
            });
      expect(update.status).toBe(policy === 'consent-policy' ? 200 : 201);
      resume.release();
      const response = await pending;
      const location = new URL(
        response.headers.get('location') ?? '/',
        'http://localhost',
      );
      const code = location.searchParams.get('code');
      let exchangeStatus: number | undefined;
      let refreshIssued = false;
      let userinfoStatus: number | undefined;
      if (code) {
        const exchange = await exchangeCodeForTokens(server.app, {
          code,
          codeVerifier: TEST_PKCE.codeVerifier,
        });
        exchangeStatus = exchange.status;
        const tokens = z
          .object({
            access_token: z.string(),
            refresh_token: z.string().optional(),
          })
          .parse(await exchange.json());
        refreshIssued = Boolean(tokens.refresh_token);
        userinfoStatus = (
          await server.app.request('/oauth/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })
        ).status;
      }
      const fresh = await server.app.request(
        `/oauth/authorize?${new URLSearchParams(query)}`,
        { headers: { Cookie: adminCookie } },
      );
      const freshTarget = new URL(
        fresh.headers.get('location') ?? '/',
        'http://localhost',
      );
      expect(freshTarget.pathname).toBe(
        policy === 'consent-policy' ? '/consent' : '/terms',
      );
      expect(code).toBeNull();
      expect(exchangeStatus).toBeUndefined();
      expect(refreshIssued).toBe(false);
      expect(userinfoStatus).toBeUndefined();
    } finally {
      resume.release();
      await server.cleanup();
    }
  },
);

test.each(['new', 'existing', 'revoked'])(
  'consent persistence failure restores %s consent and its scopes',
  async (kind) => {
    const { BrowserSessionService } = await import(
      './browser-session.service.js'
    );
    const server = await fixture();
    try {
      const cookie = `session=${await createAuthenticatedSession(server.app)}`;
      if (kind !== 'new')
        await withMikroContext(server.services, async () => {
          const consent = await server.services.userConsentService.grantConsent(
            {
              userSub: TEST_USER_CONFIG.sub,
              clientId: TEST_OAUTH_CLIENT_CONFIG.id,
              scopes: ['openid'],
            },
          );
          if (kind === 'revoked') {
            consent.revoked_at = new Date();
            await server.services.mikro.em.flush();
          }
        });
      const snapshot = () =>
        withMikroContext(server.services, async () => {
          const rows = await server.services.mikro.userConsent.find({});
          return rows.map((row) => ({
            id: row.id,
            scopes: row.scopes,
            revoked: row.revoked_at?.toISOString() ?? null,
          }));
        });
      const before = await snapshot();
      vi.spyOn(BrowserSessionService.prototype, 'save').mockResolvedValueOnce(
        false,
      );
      const response = await server.app.request('/api/consent', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...query,
          prompt: 'consent',
          decision: 'allow',
        }),
      });
      expect(response.status).toBe(401);
      expect(await snapshot()).toEqual(before);
      expect(await response.text()).not.toContain('redirect_url');
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
  'prompt=none preserves $responseType/$mode errors when terms change before completion',
  async ({ responseType, mode }) => {
    const server = await fixture(true);
    try {
      await withMikroContext(server.services, () =>
        server.services.mikro.oauthClient.nativeUpdate(
          { id: TEST_OAUTH_CLIENT_CONFIG.id },
          {
            responseTypes: ['code', 'id_token'],
            grantTypes: ['authorization_code', 'implicit'],
          },
        ),
      );
      const cookie = `session=${await createAuthenticatedSession(server.app)}`;
      const original = server.services.oauthAuthorizeService.authorize.bind(
        server.services.oauthAuthorizeService,
      );
      vi.spyOn(
        server.services.oauthAuthorizeService,
        'authorize',
      ).mockImplementationOnce(async (input) => {
        const complete = input.completeAuthorization;
        if (!complete) throw new Error('Missing completion');
        return original({
          ...input,
          completeAuthorization: async (proof, operation) => {
            await withMikroContext(server.services, () =>
              server.services.adminConsoleService.createTerm({
                id: 'late-term',
                required: true,
                consentMode: 'explicit',
                version: '1',
                contents: [
                  {
                    lang: 'en',
                    title: 'Late terms',
                    type: 'text',
                    content: 'Required',
                  },
                ],
              }),
            );
            return complete(proof, operation);
          },
        });
      });
      const response = await server.app.request(
        `/oauth/authorize?${new URLSearchParams({ ...query, scope: 'openid email', response_type: responseType, response_mode: mode, nonce: 'nonce', prompt: 'none' })}`,
        { headers: { Cookie: cookie } },
      );
      if (mode === 'form_post') {
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('interaction_required');
        expect(html).not.toMatch(/name="(?:code|id_token)"/);
      } else {
        expect(response.status).toBe(302);
        const target = new URL(response.headers.get('location') ?? '');
        const params =
          mode === 'fragment'
            ? new URLSearchParams(target.hash.slice(1))
            : target.searchParams;
        expect(params.get('error')).toBe('interaction_required');
        expect(params.has('code')).toBe(false);
        expect(params.has('id_token')).toBe(false);
      }
      expect(
        await withMikroContext(server.services, () =>
          server.services.mikro.oauthCode.count({}),
        ),
      ).toBe(0);
    } finally {
      await server.cleanup();
    }
  },
);

test('final scope resolution drops offline access when preconfigured approval is removed', async () => {
  const server = await fixture(true);
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    await withMikroContext(server.services, () =>
      server.services.userConsentService.grantConsent({
        userSub: TEST_USER_CONFIG.sub,
        clientId: TEST_OAUTH_CLIENT_CONFIG.id,
        scopes: ['openid', 'email'],
      }),
    );
    const original = server.services.oauthAuthorizeService.authorize.bind(
      server.services.oauthAuthorizeService,
    );
    vi.spyOn(
      server.services.oauthAuthorizeService,
      'authorize',
    ).mockImplementationOnce(async (input) => {
      const complete = input.completeAuthorization;
      if (!complete) throw new Error('Missing completion');
      return original({
        ...input,
        completeAuthorization: async (proof, operation) => {
          await withMikroContext(server.services, () =>
            server.services.mikro.oauthClient.nativeUpdate(
              { id: TEST_OAUTH_CLIENT_CONFIG.id },
              { skipConsent: false },
            ),
          );
          return complete(proof, operation);
        },
      });
    });
    const response = await server.app.request(
      `/oauth/authorize?${new URLSearchParams(query)}`,
      { headers: { Cookie: cookie } },
    );
    const code = new URL(
      response.headers.get('location') ?? '',
    ).searchParams.get('code');
    if (!code) throw new Error('Missing code');
    const tokens = await exchangeCodeForTokens(server.app, {
      code,
      codeVerifier: TEST_PKCE.codeVerifier,
    });
    expect(tokens.status).toBe(200);
    const result = await tokens.json();
    expect(result).toMatchObject({ scope: 'openid email' });
    expect(result).not.toHaveProperty('refresh_token');
  } finally {
    await server.cleanup();
  }
});

test.each(['user-epoch', 'client-epoch'])(
  'consent rejects an earlier %s without writing a grant',
  async (kind) => {
    const server = await fixture();
    try {
      const cookie = `session=${await createAuthenticatedSession(server.app)}`;
      const original = server.services.oauthClientService.findByClientId.bind(
        server.services.oauthClientService,
      );
      vi.spyOn(
        server.services.oauthClientService,
        'findByClientId',
      ).mockImplementationOnce(async (id) => {
        const client = await original(id);
        await withMikroContext(server.services, async () => {
          if (kind === 'user-epoch') {
            const { withUserSecurity } = await import(
              './user-security.service.js'
            );
            const { invalidateUserAuthentication } = await import(
              './authentication-epoch.js'
            );
            await withUserSecurity(
              server.services.mikro,
              TEST_USER_CONFIG.sub,
              async (user) => {
                await invalidateUserAuthentication(
                  server.services.mikro.em,
                  user,
                );
                await server.services.mikro.em.flush();
              },
            );
          } else {
            await server.services.mikro.oauthClient.nativeUpdate(
              { id: client.id },
              { managed_by: 'database' },
            );
            await server.services.adminConsoleService.deleteClient(client.id);
            await server.services.adminConsoleService.restoreClient(client.id);
          }
        });
        return client;
      });
      const response = await server.app.request('/api/consent', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...query,
          prompt: 'consent',
          decision: 'allow',
        }),
      });
      expect(response.status).toBe(kind === 'user-epoch' ? 401 : 400);
      expect(
        await withMikroContext(server.services, () =>
          server.services.mikro.userConsent.count({}),
        ),
      ).toBe(0);
    } finally {
      await server.cleanup();
    }
  },
);

test.each(['version', 'restoration', 'scope-revocation'])(
  'final authorization rechecks %s instead of the preflight cache',
  async (kind) => {
    const server = await fixture(kind !== 'scope-revocation');
    try {
      const cookie = `session=${await createAuthenticatedSession(server.app)}`;
      await withMikroContext(server.services, async () => {
        if (kind === 'scope-revocation') {
          await server.services.userConsentService.grantConsent({
            userSub: TEST_USER_CONFIG.sub,
            clientId: TEST_OAUTH_CLIENT_CONFIG.id,
            scopes: ['openid', 'email', 'offline_access'],
          });
        } else {
          await server.services.adminConsoleService.createTerm({
            id: 'changed-terms',
            required: true,
            consentMode: 'explicit',
            version: '1',
            contents: [
              { lang: 'en', title: 'Terms', type: 'text', content: 'Required' },
            ],
          });
          if (kind === 'restoration')
            await server.services.adminConsoleService.setTermsArchived(
              ['changed-terms'],
              undefined,
              true,
            );
          else
            await server.services.termsService.recordConsents({
              userSub: TEST_USER_CONFIG.sub,
              consents: [{ termsId: 'changed-terms', agreed: true }],
            });
        }
      });
      const original = server.services.oauthAuthorizeService.authorize.bind(
        server.services.oauthAuthorizeService,
      );
      vi.spyOn(
        server.services.oauthAuthorizeService,
        'authorize',
      ).mockImplementationOnce(async (input) => {
        const complete = input.completeAuthorization;
        if (!complete) throw new Error('Missing completion');
        return original({
          ...input,
          completeAuthorization: async (proof, operation) => {
            await withMikroContext(server.services, async () => {
              if (kind === 'scope-revocation')
                await server.services.mikro.userConsent.nativeUpdate(
                  { user: TEST_USER_CONFIG.sub },
                  { revoked_at: new Date() },
                );
              else if (kind === 'restoration')
                await server.services.adminConsoleService.setTermsArchived(
                  ['changed-terms'],
                  undefined,
                  false,
                );
              else
                await server.services.adminConsoleService.updateTerm(
                  'changed-terms',
                  {
                    required: true,
                    consentMode: 'explicit',
                    version: '2',
                    contents: [
                      {
                        lang: 'en',
                        title: 'Updated terms',
                        type: 'text',
                        content: 'Required again',
                      },
                    ],
                  },
                );
            });
            return complete(proof, operation);
          },
        });
      });
      const response = await server.app.request(
        `/oauth/authorize?${new URLSearchParams(query)}`,
        { headers: { Cookie: cookie } },
      );
      expect(
        new URL(response.headers.get('location') ?? '', 'http://localhost')
          .pathname,
      ).toBe(kind === 'scope-revocation' ? '/consent' : '/terms');
      expect(
        await withMikroContext(server.services, () =>
          server.services.mikro.oauthCode.count({}),
        ),
      ).toBe(0);
    } finally {
      await server.cleanup();
    }
  },
);

test('consent committed before logout remains a valid prior approval', async () => {
  const server = await fixture();
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    const response = await server.app.request('/api/consent', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, prompt: 'consent', decision: 'allow' }),
    });
    expect(response.status).toBe(200);
    expect(
      (
        await server.app.request('/api/auth/logout', {
          method: 'POST',
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(200);
    const consent = await withMikroContext(server.services, () =>
      server.services.mikro.userConsent.findConsent(
        TEST_USER_CONFIG.sub,
        TEST_OAUTH_CLIENT_CONFIG.id,
      ),
    );
    expect(consent?.scopes).toContain('offline_access');
  } finally {
    await server.cleanup();
  }
});

test('terms added after token issuance do not retroactively revoke the grant', async () => {
  const server = await fixture(true);
  try {
    const cookie = `session=${await createAuthenticatedSession(server.app)}`;
    const response = await server.app.request(
      `/oauth/authorize?${new URLSearchParams(query)}`,
      { headers: { Cookie: cookie } },
    );
    const code = new URL(
      response.headers.get('location') ?? '',
    ).searchParams.get('code');
    if (!code) throw new Error('Missing code');
    const exchanged = await exchangeCodeForTokens(server.app, {
      code,
      codeVerifier: TEST_PKCE.codeVerifier,
    });
    expect(exchanged.status).toBe(200);
    const token = z
      .object({ access_token: z.string() })
      .parse(await exchanged.json()).access_token;
    await withMikroContext(server.services, () =>
      server.services.adminConsoleService.createTerm({
        id: 'after-issuance',
        required: true,
        consentMode: 'explicit',
        version: '1',
        contents: [
          { lang: 'en', title: 'New terms', type: 'text', content: 'Required' },
        ],
      }),
    );
    expect(
      (
        await server.app.request('/oauth/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(200);
    const fresh = await server.app.request(
      `/oauth/authorize?${new URLSearchParams(query)}`,
      { headers: { Cookie: cookie } },
    );
    expect(
      new URL(fresh.headers.get('location') ?? '', 'http://localhost').pathname,
    ).toBe('/terms');
  } finally {
    await server.cleanup();
  }
});
