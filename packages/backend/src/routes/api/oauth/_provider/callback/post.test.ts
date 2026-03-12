import { testClient } from 'hono/testing';
import { generateKeyPair, SignJWT } from 'jose';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { apple } from '#backend/entrypoints/identity-providers/apple.js';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  mockOAuthProviderFetch,
  TEST_USER_CONFIG,
} from '#backend/test-utils/index.js';

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';

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

/**
 * Create a signed JWT that mimics Apple's ID token.
 */
async function createAppleIdToken(claims: {
  sub: string;
  email: string;
  email_verified?: boolean;
}): Promise<string> {
  const { privateKey } = await generateKeyPair('RS256');
  return new SignJWT({
    sub: claims.sub,
    email: claims.email,
    email_verified: claims.email_verified ?? true,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .sign(privateKey);
}

describe('POST /api/oauth/:provider/callback', () => {
  describe('Apple form_post Callback', () => {
    test('should complete Apple login via POST form_post callback', async () => {
      const oauthEmail = generateUniqueEmail('apple-callback');
      const { sessionCookie, state } = await startAppleOAuthFlow({
        mode: 'login',
      });

      const idToken = await createAppleIdToken({
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
      } finally {
        oauthMock.restore();
      }
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
