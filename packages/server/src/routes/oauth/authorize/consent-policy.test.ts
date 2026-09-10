import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.js';
import { IssuaryRuntimeConfigSchema } from '../../../lib/config/index.js';
import { seedConfigIfNeeded } from '../../../seeders/config.seeder.js';
import type { ServiceContainer } from '../../../services/container.js';
import { createTestUser } from '../../../test-utils/cli.js';
import { assertJsonBody } from '../../../test-utils/client.js';
import {
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_TERMS_CONFIG,
} from '../../../test-utils/fixtures.js';
import {
  createDbUserWithSession,
  getLocationHeader,
  withMikroContext,
} from '../../../test-utils/helpers.js';
import {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/setup.js';

const normalClient = {
  ...TEST_OAUTH_CLIENT_CONFIG,
  scope: 'openid email offline_access',
  grant_types: ['authorization_code', 'refresh_token'],
};
const trustedClient = {
  ...normalClient,
  id: 'trusted-policy',
  client_id: 'trusted-policy',
  skip_consent: true,
};
const inputConfig = {
  ...MINIMAL_TEST_CONFIG,
  clients: [normalClient, trustedClient],
};
let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ app, services, cleanup } = await createTestApp(inputConfig));
});
afterAll(async () => {
  await cleanup();
});

function requestQuery(
  clientId: string = normalClient.client_id,
  prompt?: string,
) {
  return {
    client_id: clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    response_type: 'code',
    scope: 'openid email offline_access',
    state: 'policy-state',
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
    ...(prompt ? { prompt } : {}),
  };
}

async function newSession() {
  const { sessionCookie, userSub } = await createDbUserWithSession(
    app,
    services,
    `${crypto.randomUUID()}@example.com`,
    'password-123',
  );
  return {
    userSub,
    headers: {
      Cookie: `session=${sessionCookie}`,
      'Sec-Fetch-Site': 'same-origin',
    },
  };
}

async function exchangeCode(location: URL) {
  const code = location.searchParams.get('code');
  if (!code) throw new Error(`Expected code, received ${location.pathname}`);
  const response = await testClient(app).oauth.token.$post({
    form: {
      grant_type: 'authorization_code',
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      code,
      code_verifier: TEST_PKCE.codeVerifier,
    },
  });
  return assertJsonBody(response);
}

describe('consent authorization policy', () => {
  test.each([undefined, 'none'])(
    'preapproves trusted scopes without recording user consent (prompt=%s)',
    async (prompt) => {
      const session = await newSession();
      const query = requestQuery(trustedClient.client_id, prompt);
      const response = await testClient(app).oauth.authorize.$get(
        { query },
        session,
      );
      const location = new URL(getLocationHeader(response));
      const code = location.searchParams.get('code');
      expect(code).toBeTruthy();
      if (!code) throw new Error('Expected authorization code');
      const token = await testClient(app).oauth.token.$post({
        form: {
          grant_type: 'authorization_code',
          client_id: trustedClient.client_id,
          client_secret: TEST_OAUTH_CLIENT.clientSecret,
          redirect_uri: query.redirect_uri,
          code,
          code_verifier: TEST_PKCE.codeVerifier,
        },
      });
      const body = await assertJsonBody(token);
      expect(body.scope).toBe(query.scope);
      expect(body.refresh_token).toBeTruthy();
      await withMikroContext(services, async () => {
        expect(
          await services.mikro.userConsent.count({ user: session.userSub }),
        ).toBe(0);
      });
    },
  );

  test('request parameters cannot enable administrative preapproval', async () => {
    const session = await newSession();
    const search = new URLSearchParams({
      ...requestQuery(),
      skip_consent: 'true',
    });
    const response = await app.request(
      `/oauth/authorize?${search.toString()}`,
      session,
    );
    expect(new URL(getLocationHeader(response)).pathname).toBe('/consent');
  });

  test('a disabled client cannot use its preapproval', async () => {
    const session = await newSession();
    try {
      await withMikroContext(services, async () => {
        await services.mikro.oauthClient.nativeUpdate(
          { id: trustedClient.id },
          { enabled: false },
        );
      });
      const response = await testClient(app).oauth.authorize.$get(
        { query: requestQuery(trustedClient.client_id) },
        session,
      );
      expect(response.status).toBe(400);
      expect(response.headers.get('location')).toBeNull();
    } finally {
      await withMikroContext(services, async () => {
        await services.mikro.oauthClient.nativeUpdate(
          { id: trustedClient.id },
          { enabled: true },
        );
      });
    }
  });

  test('explicit consent overrides preapproval, and none never logs a user in', async () => {
    const client = testClient(app);
    const session = await newSession();
    const forced = await client.oauth.authorize.$get(
      { query: requestQuery(trustedClient.client_id, 'consent') },
      session,
    );
    expect(new URL(getLocationHeader(forced)).pathname).toBe('/consent');
    const unauthenticated = await client.oauth.authorize.$get({
      query: requestQuery(trustedClient.client_id, 'none'),
    });
    expect(
      new URL(getLocationHeader(unauthenticated)).searchParams.get('error'),
    ).toBe('login_required');
    const mixed = await client.oauth.authorize.$get(
      { query: requestQuery(trustedClient.client_id, 'login consent') },
      session,
    );
    expect(new URL(getLocationHeader(mixed)).pathname).toBe('/login');
    const invalid = await client.oauth.authorize.$get(
      { query: requestQuery(trustedClient.client_id, 'none consent') },
      session,
    );
    expect(new URL(getLocationHeader(invalid)).searchParams.get('error')).toBe(
      'invalid_request',
    );
  });

  test('removing config preapproval requires actual user consent on the next request', async () => {
    const session = await newSession();
    try {
      const nextConfig = IssuaryRuntimeConfigSchema.parse({
        ...inputConfig,
        clients: [normalClient, { ...trustedClient, skip_consent: false }],
      });
      expect(
        await seedConfigIfNeeded(
          services.mikro.orm.em.fork(),
          nextConfig,
          services.securityService,
        ),
      ).toBe(true);
      const response = await testClient(app).oauth.authorize.$get(
        { query: requestQuery(trustedClient.client_id, 'none') },
        session,
      );
      expect(
        new URL(getLocationHeader(response)).searchParams.get('error'),
      ).toBe('consent_required');
    } finally {
      await seedConfigIfNeeded(
        services.mikro.orm.em.fork(),
        IssuaryRuntimeConfigSchema.parse(inputConfig),
        services.securityService,
      );
    }
  });

  test.each([
    { scope: 'openid forbidden' },
    { redirect_uri: 'https://unregistered.example/callback' },
    { code_challenge: 'invalid' },
  ])('preapproval retains request validation: %j', async (invalid) => {
    const session = await newSession();
    const response = await testClient(app).oauth.authorize.$get(
      { query: { ...requestQuery(trustedClient.client_id), ...invalid } },
      session,
    );
    const location = response.headers.get('location');
    if (location)
      expect(new URL(location).searchParams.has('code')).toBe(false);
    else expect(response.status).toBe(400);
  });

  test.each([undefined, 'consent'])(
    'uses the same effective offline scopes in display, consent, code and tokens (prompt=%s)',
    async (prompt) => {
      const client = testClient(app);
      const session = await newSession();
      const query = requestQuery(normalClient.client_id, prompt);
      const info = await assertJsonBody(
        await client.api.consent.$get({ query }, session),
      );
      const expectedScopes = prompt
        ? ['openid', 'email', 'offline_access']
        : ['openid', 'email'];
      expect(info.scopes.map((scope) => scope.name)).toEqual(expectedScopes);
      const decision = await client.api.consent.$post(
        { json: { ...query, decision: 'allow' } },
        session,
      );
      const continuation = await assertJsonBody(decision);
      const authorized = await app.request(continuation.redirect_url, session);
      const tokens = await exchangeCode(new URL(getLocationHeader(authorized)));
      expect(tokens.scope).toBe(expectedScopes.join(' '));
      expect(Boolean(tokens.refresh_token)).toBe(Boolean(prompt));
      await withMikroContext(services, async () => {
        const stored = await services.mikro.userConsent.findConsent(
          session.userSub,
          normalClient.id,
        );
        expect(stored?.scopes).toEqual(expectedScopes);
      });
      const repeat = await client.oauth.authorize.$get(
        { query: requestQuery(normalClient.client_id, 'none') },
        session,
      );
      const repeatTokens = await exchangeCode(
        new URL(getLocationHeader(repeat)),
      );
      expect(repeatTokens.scope).toBe(expectedScopes.join(' '));
      expect(Boolean(repeatTokens.refresh_token)).toBe(Boolean(prompt));
    },
  );
});

test('required terms gate preapproved authorization, including rejected current versions', async () => {
  const server = await createTestApp({
    ...inputConfig,
    terms: [...TEST_TERMS_CONFIG],
    auth: {
      account_selection: {
        enabled: true,
        remember_accounts: { enabled: true },
      },
    },
  });
  try {
    const client = testClient(server.app);
    const { sessionCookie, userSub } = await createDbUserWithSession(
      server.app,
      server.services,
      'terms-policy@example.com',
      'password-123',
    );
    const headers = {
      Cookie: `session=${sessionCookie}`,
      'Sec-Fetch-Site': 'same-origin',
    };
    const query = requestQuery(trustedClient.client_id);
    const first = await client.oauth.authorize.$get({ query }, { headers });
    const terms = new URL(getLocationHeader(first));
    expect(terms.pathname).toBe('/terms');
    const continuation = terms.searchParams.get('redirect');
    if (!continuation) throw new Error('Missing terms continuation');
    expect(new URL(continuation).searchParams.get('code_challenge')).toBe(
      TEST_PKCE.codeChallenge,
    );
    const silent = await client.oauth.authorize.$get(
      { query: { ...query, prompt: 'none' } },
      { headers },
    );
    expect(new URL(getLocationHeader(silent)).searchParams.get('error')).toBe(
      'interaction_required',
    );
    await withMikroContext(server.services, async () => {
      await server.services.termsService.recordConsents({
        userSub,
        consents: TEST_TERMS_CONFIG.map((term) => ({
          termsId: term.id,
          agreed: false,
        })),
      });
    });
    const rejected = await client.oauth.authorize.$get({ query }, { headers });
    expect(new URL(getLocationHeader(rejected)).pathname).toBe('/terms');
    const approved = await client.api.terms.consent.$post(
      {
        json: {
          consents: TEST_TERMS_CONFIG.map((term) => ({
            termsId: term.id,
            agreed: true,
            consentType: term.consent_mode,
          })),
        },
      },
      { headers },
    );
    expect(approved.status).toBe(200);
    const finished = await server.app.request(continuation, { headers });
    expect(
      new URL(getLocationHeader(finished)).searchParams.get('code'),
    ).toBeTruthy();
    const otherEmail = 'other-terms-policy@example.com';
    const otherSub = await createTestUser(server.services, {
      email: otherEmail,
    });
    const authenticatedAt = Math.floor(Date.now() / 1000);
    const selectedOther = await withMikroContext(server.services, () =>
      server.services.oauthAuthorizeService.authorize({
        query: { ...query, prompt: 'none', login_hint: otherEmail },
        userSession: { sub: userSub, authenticated_at: authenticatedAt },
        rememberedAccounts: [userSub, otherSub].map((sub) => ({
          sub,
          authenticated_at: authenticatedAt,
          last_used_at: authenticatedAt,
        })),
      }),
    );
    expect(new URL(selectedOther.url).searchParams.get('error')).toBe(
      'interaction_required',
    );
  } finally {
    await server.cleanup();
  }
});

test.each(['email', 'second-factor'])(
  'preapproval cannot issue a code with incomplete %s authentication',
  async (step) => {
    const server = await createTestApp({
      ...inputConfig,
      email: await createTestEmailConfig(),
      registration: { email_verification_required: step === 'email' },
      auth: {
        password: {
          two_factor: { enrollment_required: step === 'second-factor' },
          totp: { enabled: true },
        },
      },
    });
    try {
      const email = `pending-${step}@example.com`;
      await createTestUser(server.services, {
        email,
        password: 'password-123',
        emailVerified: step !== 'email',
      });
      const client = testClient(server.app);
      const login = await client.api.auth.login.$post({
        json: { email, password: 'password-123' },
      });
      expect(login.status).toBe(200);
      const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
      const response = await client.oauth.authorize.$get(
        { query: requestQuery(trustedClient.client_id, 'none') },
        { headers: { Cookie: cookie } },
      );
      expect(
        new URL(getLocationHeader(response)).searchParams.get('error'),
      ).toBe('login_required');
    } finally {
      await server.cleanup();
    }
  },
);
