import { testClient } from 'hono/testing';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import type { AppType } from '../../../../../entrypoints/app.ts';
import { apple } from '../../../../../entrypoints/identity-providers/apple.ts';
import { e } from '../../../../../schemas/error.ts';
import {
  assertJsonBody,
  createTestApp,
  expectError,
  extractCookie,
  generateUniqueEmail,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  mockOAuthProviderFetch,
  TEST_USER_CONFIG,
} from '../../../../../test-utils/index.ts';

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
    users: [TEST_USER_CONFIG],
    identity_providers: [
      apple({
        id: 'apple',
        enabled: true,
        display_name: 'Apple',
        client_id: 'test-apple-client-id',
        client_secret: 'test-apple-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
    terms: [],
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await cleanup();
});

/**
 * Helper: Start OAuth flow with Apple and get session state/cookie.
 * Uses the GET authorize endpoint which redirects to Apple.
 */
async function startAppleOAuthFlow(options?: {
  mode?: 'login' | 'register' | 'link';
  sessionCookie?: string;
}): Promise<{ sessionCookie: string; state: string }> {
  const client = testClient(app);

  const res = await client.api.oauth[':provider'].authorize.$get(
    {
      param: { provider: 'apple' },
      query: {
        mode: options?.mode ?? 'login',
      },
    },
    options?.sessionCookie
      ? { headers: { Cookie: `session=${options.sessionCookie}` } }
      : undefined,
  );

  expect(res.status).toBe(302);

  const location = new URL(getLocationHeader(res));
  const state = location.searchParams.get('state');
  if (!state) {
    throw new Error('Expected state parameter in OAuth redirect');
  }

  const cookie = extractCookie(res, 'session');
  return { sessionCookie: cookie, state };
}

async function startAppleFormPostOAuthFlow(): Promise<{
  oauthStateCookie: string;
  state: string;
}> {
  const client = testClient(app);

  const res = await client.api.oauth[':provider'].authorize.$get({
    param: { provider: 'apple' },
    query: { mode: 'login' },
  });

  expect(res.status).toBe(302);
  const setCookie = res.headers.get('set-cookie');
  expect(setCookie).toContain('oauth_state=');
  expect(setCookie).toContain('SameSite=None');
  expect(setCookie).toContain('Secure');

  const location = new URL(getLocationHeader(res));
  const state = location.searchParams.get('state');
  if (!state) {
    throw new Error('Expected state parameter in OAuth redirect');
  }

  return {
    oauthStateCookie: extractCookie(res, 'oauth_state'),
    state,
  };
}

/**
 * Create a signed JWT that mimics Apple's ID token.
 */
async function createAppleIdToken(claims: {
  sub: string;
  email: string;
  email_verified?: boolean;
}): Promise<{ idToken: string; jwks: unknown }> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const kid = `apple-callback-${crypto.randomUUID()}`;
  const idToken = await new SignJWT({
    sub: claims.sub,
    email: claims.email,
    email_verified: claims.email_verified ?? true,
    iss: 'https://appleid.apple.com',
    aud: 'test-apple-client-id',
    exp: Math.floor(Date.now() / 1000) + 60,
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt()
    .sign(privateKey);

  return {
    idToken,
    jwks: {
      keys: [
        {
          ...jwk,
          kid,
          alg: 'RS256',
          use: 'sig',
        },
      ],
    },
  };
}

function expectOAuthSessionCleared(res: Response): void {
  const setCookie = res.headers.get('set-cookie');
  expect(setCookie).toContain('session=');
  expect(setCookie).toContain('Max-Age=0');
}

describe('POST /api/oauth/:provider/callback', () => {
  describe('Apple form_post Callback', () => {
    test('should complete Apple form_post callback with only the cross-site OAuth state cookie', async () => {
      const oauthEmail = generateUniqueEmail('apple-form-post-state-cookie');
      const { oauthStateCookie, state } = await startAppleFormPostOAuthFlow();

      const { idToken, jwks } = await createAppleIdToken({
        sub: `apple-form-post-${Date.now()}`,
        email: oauthEmail,
        email_verified: true,
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: APPLE_TOKEN_URL,
        userInfoUrl: null,
        tokens: {
          id_token: idToken,
        },
        jwksUrl: APPLE_JWKS_URL,
        jwks,
      });

      try {
        const client = testClient(app);
        const callbackRes = await client.api.oauth[':provider'].callback.$post(
          {
            param: { provider: 'apple' },
            form: {
              code: 'apple-auth-code',
              state,
            },
          },
          { headers: { Cookie: `oauth_state=${oauthStateCookie}` } },
        );

        expect(callbackRes.status).toBe(302);
        expect(callbackRes.headers.get('set-cookie')).toContain('oauth_state=');

        const callbackCookie = extractCookie(callbackRes, 'session');
        const sessionRes = await client.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        const sessionBody = await assertJsonBody(sessionRes);
        expect(sessionBody.user?.email).toBe(oauthEmail);
      } finally {
        oauthMock.restore();
      }
    });

    test('should complete Apple login via POST form_post callback', async () => {
      const oauthEmail = generateUniqueEmail('apple-callback');
      const { sessionCookie, state } = await startAppleOAuthFlow({
        mode: 'login',
      });

      const { idToken, jwks } = await createAppleIdToken({
        sub: `apple-user-${Date.now()}`,
        email: oauthEmail,
        email_verified: true,
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: APPLE_TOKEN_URL,
        userInfoUrl: null,
        tokens: {
          id_token: idToken,
        },
        jwksUrl: APPLE_JWKS_URL,
        jwks,
      });

      try {
        const client = testClient(app);
        const callbackRes = await client.api.oauth[':provider'].callback.$post(
          {
            param: { provider: 'apple' },
            form: {
              code: 'apple-auth-code',
              state,
            },
          },
          { headers: { Cookie: `session=${sessionCookie}` } },
        );

        expect(callbackRes.status).toBe(302);
        const callbackLocation = new URL(
          getLocationHeader(callbackRes),
          'http://test',
        );
        expect(callbackLocation.pathname).toBe('/profile');

        // Verify session was created with correct user
        const callbackCookie = extractCookie(callbackRes, 'session');
        const sessionClient = testClient(app);
        const sessionRes = await sessionClient.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        const sessionBody = await assertJsonBody(sessionRes);
        expect(sessionBody.user).not.toBeNull();
        expect(sessionBody.user?.email).toBe(oauthEmail);

        const replayRes = await client.api.oauth[':provider'].callback.$post(
          {
            param: { provider: 'apple' },
            form: {
              code: 'apple-auth-code',
              state,
            },
          },
          { headers: { Cookie: `session=${callbackCookie}` } },
        );
        await expectError(replayRes, e.OAuthSessionExpired);
      } finally {
        oauthMock.restore();
      }
    });

    test('should validate Apple form_post state and clear OAuth session on mismatch', async () => {
      const { sessionCookie } = await startAppleOAuthFlow();

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$post(
        {
          param: { provider: 'apple' },
          form: {
            code: 'apple-auth-code',
            state: 'wrong-state-value',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.OAuthStateMismatch);
      expectOAuthSessionCleared(res);
    });

    test('should handle Apple OAuth error via POST', async () => {
      const { sessionCookie } = await startAppleOAuthFlow();

      const client = testClient(app);
      const res = await client.api.oauth[':provider'].callback.$post(
        {
          param: { provider: 'apple' },
          form: {
            error: 'user_cancelled_authorize',
            error_description: 'The user cancelled the authorization',
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(302);
      const location = new URL(getLocationHeader(res), 'http://test');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('oauth_error')).toBe(
        'user_cancelled_authorize',
      );
    });
  });
});
