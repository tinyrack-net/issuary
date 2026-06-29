import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import { encrypt } from '../../../lib/crypto.ts';
import type { ServiceContainer } from '../../../services/container.ts';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.ts';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

function buildReauthenticationRequestFingerprint(params: {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string | undefined;
  state?: string | undefined;
  nonce?: string | undefined;
  code_challenge?: string | undefined;
  code_challenge_method?: 'S256' | 'plain' | undefined;
  prompt?: string | undefined;
  max_age?: number | undefined;
  display?: 'page' | 'popup' | 'touch' | 'wap' | undefined;
  response_mode?: 'query' | 'fragment' | 'form_post' | undefined;
  login_hint?: string | undefined;
  ui_locales?: string | undefined;
  id_token_hint?: string | undefined;
  acr_values?: string | undefined;
  account_selected?: '1' | undefined;
}): string {
  return JSON.stringify(
    [
      ['client_id', params.client_id],
      ['redirect_uri', params.redirect_uri],
      ['response_type', params.response_type],
      ['scope', params.scope],
      ['state', params.state],
      ['nonce', params.nonce],
      ['code_challenge', params.code_challenge],
      ['code_challenge_method', params.code_challenge_method],
      ['prompt', params.prompt],
      ['max_age', params.max_age],
      ['display', params.display],
      ['response_mode', params.response_mode],
      ['login_hint', params.login_hint],
      ['ui_locales', params.ui_locales],
      ['id_token_hint', params.id_token_hint],
      ['acr_values', params.acr_values],
      ['account_selected', params.account_selected],
    ].filter(([, value]) => value !== undefined),
  );
}

async function createBoundReauthenticationSessionCookie(params: {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string | undefined;
  state?: string | undefined;
  nonce?: string | undefined;
  code_challenge?: string | undefined;
  code_challenge_method?: 'S256' | 'plain' | undefined;
  prompt?: string | undefined;
  max_age?: number | undefined;
  display?: 'page' | 'popup' | 'touch' | 'wap' | undefined;
  response_mode?: 'query' | 'fragment' | 'form_post' | undefined;
  login_hint?: string | undefined;
  ui_locales?: string | undefined;
  id_token_hint?: string | undefined;
  acr_values?: string | undefined;
}): Promise<string> {
  const authenticatedAt = Math.floor(Date.now() / 1000);
  return encrypt(
    JSON.stringify({
      user: {
        sub: TEST_USER_CONFIG.sub,
        authenticated_at: authenticatedAt,
      },
      reauthentication: {
        sub: TEST_USER_CONFIG.sub,
        authenticated_at: authenticatedAt,
        request_fingerprint: buildReauthenticationRequestFingerprint(params),
      },
    }),
    MINIMAL_TEST_CONFIG.security.session_secret,
  );
}

type ConsentAllowBody = Parameters<
  typeof createBoundReauthenticationSessionCookie
>[0] & {
  reauthenticated?: '1' | undefined;
  account_selected?: '1' | undefined;
  account_selection_state?: string | undefined;
  decision: 'allow';
};

describe('POST /api/consent', () => {
  test('should preserve account_selected marker in the authorize continuation URL', async () => {
    const body: ConsentAllowBody = {
      client_id: TEST_OAUTH_CLIENT.clientId,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'state-account-selected',
      nonce: 'nonce-account-selected',
      code_challenge: TEST_PKCE.codeChallenge,
      code_challenge_method: TEST_PKCE.codeChallengeMethod,
      prompt: 'select_account consent',
      max_age: 3600,
      reauthenticated: '1',
      display: 'popup',
      response_mode: 'fragment',
      login_hint: 'alice@example.com',
      ui_locales: 'ko en',
      id_token_hint: 'header.payload.signature',
      acr_values: 'urn:mace:incommon:iap:silver',
      account_selected: '1',
      account_selection_state: 'chooser-state-after-consent',
      decision: 'allow',
    };
    const sessionCookie = await createBoundReauthenticationSessionCookie(body);
    const client = testClient(app);

    const res = await client.api.consent.$post(
      {
        json: body,
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const responseBody = await assertJsonBody(res, 200);
    const redirect = new URL(responseBody.redirect_url);
    expect(redirect.pathname).toBe('/oauth/authorize');
    expect(redirect.searchParams.get('account_selected')).toBe('1');
    expect(redirect.searchParams.get('account_selection_state')).toBe(
      'chooser-state-after-consent',
    );
    expect(redirect.searchParams.get('state')).toBe('state-account-selected');
    expect(redirect.searchParams.get('prompt')).toBe('select_account');
    expect(redirect.searchParams.get('max_age')).toBe('3600');
    expect(redirect.searchParams.get('reauthenticated')).toBe('1');
    expect(redirect.searchParams.get('display')).toBe('popup');
    expect(redirect.searchParams.get('response_mode')).toBe('fragment');
    expect(redirect.searchParams.get('login_hint')).toBe('alice@example.com');
    expect(redirect.searchParams.get('ui_locales')).toBe('ko en');
    expect(redirect.searchParams.get('id_token_hint')).toBe(
      'header.payload.signature',
    );
    expect(redirect.searchParams.get('acr_values')).toBe(
      'urn:mace:incommon:iap:silver',
    );
  });

  test('should consume prompt=consent after consent is granted', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const client = testClient(app);

    const res = await client.api.consent.$post(
      {
        json: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile email',
          state: 'state-prompt-consent',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          prompt: 'consent',
          decision: 'allow',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const responseBody = await assertJsonBody(res, 200);
    const redirect = new URL(responseBody.redirect_url);
    expect(redirect.searchParams.has('prompt')).toBe(false);
    expect(redirect.searchParams.get('state')).toBe('state-prompt-consent');
  });

  test('should consume fulfilled prompt=login consent while preserving reauthentication', async () => {
    const body: ConsentAllowBody = {
      client_id: TEST_OAUTH_CLIENT.clientId,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'state-login-consent',
      code_challenge: TEST_PKCE.codeChallenge,
      code_challenge_method: TEST_PKCE.codeChallengeMethod,
      prompt: 'login consent',
      reauthenticated: '1',
      decision: 'allow',
    };
    const sessionCookie = await createBoundReauthenticationSessionCookie(body);
    const client = testClient(app);

    const res = await client.api.consent.$post(
      {
        json: body,
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const responseBody = await assertJsonBody(res, 200);
    const redirect = new URL(responseBody.redirect_url);
    expect(redirect.pathname).toBe('/oauth/authorize');
    expect(redirect.searchParams.has('prompt')).toBe(false);
    expect(redirect.searchParams.get('reauthenticated')).toBe('1');
    expect(redirect.searchParams.get('state')).toBe('state-login-consent');
  });

  test('should preserve reauthentication when consent submits after prompt=login was stripped', async () => {
    const originalBody: ConsentAllowBody = {
      client_id: TEST_OAUTH_CLIENT.clientId,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'state-stripped-login-consent',
      nonce: 'nonce-stripped-login-consent',
      code_challenge: TEST_PKCE.codeChallenge,
      code_challenge_method: TEST_PKCE.codeChallengeMethod,
      prompt: 'login consent',
      max_age: 0,
      login_hint: TEST_USER_CONFIG.email,
      account_selected: '1',
      reauthenticated: '1',
      decision: 'allow',
    };
    const sessionCookie =
      await createBoundReauthenticationSessionCookie(originalBody);
    const client = testClient(app);

    const res = await client.api.consent.$post(
      {
        json: {
          ...originalBody,
          prompt: 'consent',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const responseBody = await assertJsonBody(res, 200);
    const redirect = new URL(responseBody.redirect_url);
    expect(redirect.searchParams.get('reauthenticated')).toBe('1');
    expect(redirect.searchParams.get('account_selected')).toBe('1');
    expect(redirect.searchParams.has('prompt')).toBe(false);
  });

  test('should not consume prompt=login based on forged reauthenticated body value', async () => {
    const authenticatedAt = Math.floor(Date.now() / 1000);
    const sessionCookie = await encrypt(
      JSON.stringify({
        user: {
          sub: TEST_USER_CONFIG.sub,
          authenticated_at: authenticatedAt,
        },
        reauthentication: {
          sub: TEST_USER_CONFIG.sub,
          authenticated_at: authenticatedAt,
        },
      }),
      MINIMAL_TEST_CONFIG.security.session_secret,
    );
    const client = testClient(app);

    const res = await client.api.consent.$post(
      {
        json: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid profile email',
          state: 'state-forged-login-consent',
          code_challenge: TEST_PKCE.codeChallenge,
          code_challenge_method: TEST_PKCE.codeChallengeMethod,
          prompt: 'login consent',
          reauthenticated: '1',
          decision: 'allow',
        },
      },
      { headers: { Cookie: `session=${sessionCookie}` } },
    );

    const responseBody = await assertJsonBody(res, 200);
    const redirect = new URL(responseBody.redirect_url);
    expect(redirect.pathname).toBe('/oauth/authorize');
    expect(redirect.searchParams.get('prompt')).toBe('login');
    expect(redirect.searchParams.has('reauthenticated')).toBe(false);
    expect(redirect.searchParams.get('state')).toBe(
      'state-forged-login-consent',
    );
  });

  describe('Allow decision', () => {
    test('should grant consent and return redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            state: 'test-state-123',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body).toHaveProperty('redirect_url');

      // Verify redirect URL contains correct parameters
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.pathname).toBe('/oauth/authorize');
      expect(redirectUrl.searchParams.get('client_id')).toBe(
        TEST_OAUTH_CLIENT.clientId,
      );
      expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
        TEST_OAUTH_CLIENT.redirectUri,
      );
      expect(redirectUrl.searchParams.get('response_type')).toBe('code');
      expect(redirectUrl.searchParams.get('scope')).toBe(
        'openid profile email',
      );
      expect(redirectUrl.searchParams.get('state')).toBe('test-state-123');
    });

    test('should include PKCE parameters in redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            code_challenge_method: 'S256',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.get('code_challenge')).toBe(
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      );
      expect(redirectUrl.searchParams.get('code_challenge_method')).toBe(
        'S256',
      );
    });

    test('should include nonce parameter in redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            nonce: 'test-nonce-456',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.get('nonce')).toBe('test-nonce-456');
    });

    test('should store consent in database', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      // Get user ID from session
      const sessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const sessionBody = await assertJsonBody(sessionRes);
      expect(sessionBody.user).toBeDefined();
      const user = sessionBody.user;
      if (!user) return;

      // Grant consent
      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid profile',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      // Verify consent was stored
      await withMikroContext(services, async () => {
        const userEntity = await services.mikro.user.findOneOrFail({
          sub: user.sub,
        });
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        const consent = await services.mikro.userConsent.findOne({
          user: userEntity,
          client: clientEntity,
        });

        expect(consent).not.toBeNull();
        expect(consent?.scopes).toContain('openid');
        expect(consent?.scopes).toContain('profile');
      });
    });

    test('should handle empty scope', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body).toHaveProperty('redirect_url');

      const redirectUrl = new URL(body.redirect_url);
      // scope should not be in the URL if not provided
      expect(redirectUrl.searchParams.has('scope')).toBe(false);
    });

    test('should reject invalid redirect_uri before storing consent', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);
      const invalidScope = `invalid_redirect_scope_${Date.now()}`;

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: 'https://evil.example/callback',
            response_type: 'code',
            scope: invalidScope,
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);

      await withMikroContext(services, async () => {
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        const consents = await services.mikro.userConsent.findAll({
          where: { client: clientEntity },
        });
        for (const consent of consents) {
          expect(consent.scopes).not.toContain(invalidScope);
        }
      });
    });

    test('should reject invalid scope before storing consent', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);
      const invalidScope = `not_registered_${Date.now()}`;

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: invalidScope,
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);

      await withMikroContext(services, async () => {
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        const consents = await services.mikro.userConsent.findAll({
          where: { client: clientEntity },
        });
        for (const consent of consents) {
          expect(consent.scopes).not.toContain(invalidScope);
        }
      });
    });

    test('should reject unsupported response_type before storing consent', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);
      const invalidScope = `unsupported_response_scope_${Date.now()}`;

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'token',
            scope: invalidScope,
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);

      await withMikroContext(services, async () => {
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        const consents = await services.mikro.userConsent.findAll({
          where: { client: clientEntity },
        });
        for (const consent of consents) {
          expect(consent.scopes).not.toContain(invalidScope);
        }
      });
    });
  });

  describe('Deny decision', () => {
    test('should return error redirect URL when consent is denied', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid profile',
            state: 'test-state-789',
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body).toHaveProperty('redirect_url');

      // Verify error redirect URL
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.origin).toBe('http://localhost:8080');
      expect(redirectUrl.pathname).toBe('/callback');
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
      expect(redirectUrl.searchParams.get('error_description')).toBe(
        'The resource owner or authorization server denied the request.',
      );
      expect(redirectUrl.searchParams.get('state')).toBe('test-state-789');
    });

    test('should not include state when not provided in deny response', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      const redirectUrl = new URL(body.redirect_url);
      expect(redirectUrl.searchParams.has('state')).toBe(false);
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
    });

    test('should reject unregistered redirect_uri instead of returning a deny redirect URL', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: 'https://evil.example/callback',
            response_type: 'code',
            scope: 'openid',
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).not.toHaveProperty('redirect_url');
    });

    test('should return fragment error redirect when response_mode=fragment', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            state: 'fragment-deny-state',
            response_mode: 'fragment',
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res, 200);
      const redirectUrl = new URL(body.redirect_url);
      const fragment = new URLSearchParams(redirectUrl.hash.slice(1));
      expect(redirectUrl.searchParams.has('error')).toBe(false);
      expect(fragment.get('error')).toBe('access_denied');
      expect(fragment.get('state')).toBe('fragment-deny-state');
    });

    test('should not store consent when denied', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      // Get user ID from session
      const sessionRes = await client.api.user.session.$get(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const sessionBody = await assertJsonBody(sessionRes);
      expect(sessionBody.user).toBeDefined();
      const user = sessionBody.user;
      if (!user) return;

      let consentCountBefore = 0;
      await withMikroContext(services, async () => {
        const userEntity = await services.mikro.user.findOneOrFail({
          sub: user.sub,
        });
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        consentCountBefore = await services.mikro.userConsent.count({
          user: userEntity,
          client: clientEntity,
        });
      });

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            decision: 'deny',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      // Verify deny did not create or update a consent record.
      await withMikroContext(services, async () => {
        const userEntity = await services.mikro.user.findOneOrFail({
          sub: user.sub,
        });
        const clientEntity = await services.mikro.oauthClient.findOneOrFail({
          clientId: TEST_OAUTH_CLIENT.clientId,
        });
        const consentCountAfter = await services.mikro.userConsent.count({
          user: userEntity,
          client: clientEntity,
        });
        expect(consentCountAfter).toBe(consentCountBefore);
      });
    });
  });

  describe('Authentication', () => {
    test('should return 401 when user is not authenticated', async () => {
      const client = testClient(app);

      const res = await client.api.consent.$post({
        json: {
          client_id: TEST_OAUTH_CLIENT.clientId,
          redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
          response_type: 'code',
          scope: 'openid',
          decision: 'allow',
        },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
      expect(body).toHaveProperty('message');
    });

    test('should return 401 with invalid session cookie', async () => {
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: 'session=invalid-session-cookie' } },
      );

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('Validation', () => {
    test('should return 400 when client_id is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when redirect_uri is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            response_type: 'code',
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when response_type is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            scope: 'openid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when decision is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when decision is invalid', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            // @ts-expect-error testing validation with invalid input
            decision: 'invalid',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when code_challenge_method is invalid', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.consent.$post(
        {
          json: {
            client_id: TEST_OAUTH_CLIENT.clientId,
            redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
            response_type: 'code',
            scope: 'openid',
            code_challenge: 'some-challenge',
            // @ts-expect-error testing validation with invalid input
            code_challenge_method: 'invalid',
            decision: 'allow',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });
  });
});
