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
import { apple } from '../entrypoints/identity-providers/apple.ts';
import { genericOAuth } from '../entrypoints/identity-providers/generic-oauth.ts';
import { github } from '../entrypoints/identity-providers/github.ts';
import { google } from '../entrypoints/identity-providers/google.ts';
import {
  createTestApp,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  mockOAuthProviderFetch,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';
import type { OAuthTokens } from './oauth-connect.service.ts';

/**
 * Tests for OAuthConnectService.authenticateWithOAuth()
 * Covers email_conflict_strategy (auto_link / require_link)
 * and email_verified validation.
 */

const MOCK_TOKENS: Pick<OAuthTokens, 'access_token' | 'token_type'> = {
  access_token: 'mock-access-token',
  token_type: 'Bearer',
};

async function createAppleIdToken(claims: Record<string, unknown>) {
  const { privateKey } = await generateKeyPair('RS256');
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .sign(privateKey);
}

async function createTrustedAppleIdToken(
  claims: Record<string, unknown>,
  jwksUrl = 'https://appleid.apple.com/auth/keys',
) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const kid = `apple-test-${crypto.randomUUID()}`;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url === jwksUrl) {
      return new Response(
        JSON.stringify({
          keys: [
            {
              ...jwk,
              kid,
              alg: 'RS256',
              use: 'sig',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    return new Response(null, { status: 404 });
  });

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt()
    .sign(privateKey);
}

/**
 * Helper to assert that a promise rejects with an error
 * having a specific error code.
 */
async function expectApiError(
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await promise;
    expect.unreachable('Expected promise to reject');
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    expect(err).toHaveProperty('code', expectedCode);
  }
}

describe('OAuthConnectService - auto_link strategy', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
      identity_providers: [
        google({
          id: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        }),
      ],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should reject when email_verified is false (existing user)', async () => {
    const email = generateUniqueEmail('oauth-unverified');

    await expectApiError(
      withMikroContext(services, () =>
        services.oauthConnectService.authenticateWithOAuth(
          'google',
          MOCK_TOKENS,
          {
            id: 'provider-user-1',
            email,
            email_verified: false,
          },
        ),
      ),
      'OAUTH_EMAIL_NOT_VERIFIED',
    );
  });

  test('should reject when email_verified is false (new user)', async () => {
    const email = generateUniqueEmail('oauth-new-unverified');

    await expectApiError(
      withMikroContext(services, () =>
        services.oauthConnectService.authenticateWithOAuth(
          'google',
          MOCK_TOKENS,
          {
            id: 'provider-user-new',
            email,
            email_verified: false,
          },
        ),
      ),
      'OAUTH_EMAIL_NOT_VERIFIED',
    );
  });

  test('should auto-link when email matches existing user and email_verified is true', async () => {
    const email = generateUniqueEmail('oauth-autolink');

    // Create existing user in DB
    await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword('test-password');
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    // Authenticate with OAuth using same email
    const result = await withMikroContext(services, () =>
      services.oauthConnectService.authenticateWithOAuth(
        'google',
        MOCK_TOKENS,
        {
          id: `provider-autolink-${Date.now()}`,
          email,
          email_verified: true,
        },
      ),
    );

    expect(result.isNewUser).toBe(false);
    expect(result.user.email).toBe(email);

    // Verify OAuth account was linked
    const linked = await withMikroContext(services, () =>
      services.oauthConnectService.getLinkedAccounts(result.user.sub),
    );
    expect(linked).toHaveLength(1);
    expect(linked[0]?.provider_name).toBe('google');
  });

  test('should create new user when email_verified is true and no existing user', async () => {
    const email = generateUniqueEmail('oauth-newuser');

    const result = await withMikroContext(services, () =>
      services.oauthConnectService.authenticateWithOAuth(
        'google',
        MOCK_TOKENS,
        {
          id: `provider-new-${Date.now()}`,
          email,
          email_verified: true,
        },
      ),
    );

    expect(result.isNewUser).toBe(true);
    expect(result.user.email).toBe(email);
    expect(result.user.email_verified).toBe(true);
    expect(result.user.has_password).toBe(false);
  });
});

describe('OAuthConnectService - require_link strategy', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
      identity_providers: [
        google({
          id: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'require_link',
        }),
      ],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should throw OAuthEmailConflict when email matches existing user', async () => {
    const email = generateUniqueEmail('oauth-requirelink');

    // Create existing user in DB
    await withMikroContext(services, async () => {
      const passwordHash =
        await services.securityService.hashPassword('test-password');
      const user = services.mikro.user.create({
        email,
        password_hash: passwordHash,
      });
      user.email_verified = true;
      await services.mikro.em.persist(user).flush();
    });

    await expectApiError(
      withMikroContext(services, () =>
        services.oauthConnectService.authenticateWithOAuth(
          'google',
          MOCK_TOKENS,
          {
            id: `provider-requirelink-${Date.now()}`,
            email,
            email_verified: true,
          },
        ),
      ),
      'OAUTH_EMAIL_CONFLICT',
    );
  });

  test('should still create new user when no email conflict', async () => {
    const email = generateUniqueEmail('oauth-requirelink-new');

    const result = await withMikroContext(services, () =>
      services.oauthConnectService.authenticateWithOAuth(
        'google',
        MOCK_TOKENS,
        {
          id: `provider-requirelink-new-${Date.now()}`,
          email,
          email_verified: true,
        },
      ),
    );

    expect(result.isNewUser).toBe(true);
    expect(result.user.email).toBe(email);
  });
});

describe('OAuthConnectService - completeOAuthRegistration', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      registration: {
        enabled: true,
        allowed_email_patterns: ['*'],
      },
      identity_providers: [
        google({
          id: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        }),
      ],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should reject when email_verified is false', async () => {
    const email = generateUniqueEmail('oauth-complete-unverified');

    await expectApiError(
      withMikroContext(services, () =>
        services.oauthConnectService.completeOAuthRegistration({
          providerId: 'google',
          tokens: MOCK_TOKENS,
          userInfo: {
            id: `provider-complete-${Date.now()}`,
            email,
            email_verified: false,
          },
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        }),
      ),
      'OAUTH_EMAIL_NOT_VERIFIED',
    );
  });
});

describe('OAuthConnectService - provider token responses', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      identity_providers: [
        google({
          id: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        }),
      ],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should reject non-Bearer token_type from provider', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'mock-access-token',
          token_type: 'mac',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await expect(
      services.oauthConnectService.exchangeCodeForTokens(
        'google',
        'auth-code',
        'code-verifier',
      ),
    ).rejects.toHaveProperty('code', 'OAUTH_TOKEN_EXCHANGE_FAILED');
  });

  test('should accept lowercase bearer token_type from provider', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'mock-access-token',
          token_type: 'bearer',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const tokens = await services.oauthConnectService.exchangeCodeForTokens(
      'google',
      'auth-code',
      'code-verifier',
    );

    expect(tokens.token_type).toBe('Bearer');
  });

  test('should map invalid JSON token responses to token exchange failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{invalid-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      services.oauthConnectService.exchangeCodeForTokens(
        'google',
        'auth-code',
        'code-verifier',
      ),
    ).rejects.toHaveProperty('code', 'OAUTH_TOKEN_EXCHANGE_FAILED');
  });
});

describe('OAuthConnectService - fetchUserInfo', () => {
  describe('GitHub field mapping', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        identity_providers: [
          github({
            id: 'github',
            enabled: true,
            display_name: 'GitHub',
            client_id: 'test-github-client-id',
            client_secret: 'test-github-client-secret',
            email_conflict_strategy: 'auto_link',
          }),
        ],
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should map GitHub-specific field names correctly', async () => {
      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        rawUserInfoResponse: {
          id: 12345,
          email: 'octocat@github.com',
          name: 'The Octocat',
          avatar_url: 'https://github.com/images/octocat.png',
        },
      });

      try {
        const userInfo = await services.oauthConnectService.fetchUserInfo(
          'github',
          oauthMock.tokens.access_token,
        );

        expect(userInfo.id).toBe('12345');
        expect(userInfo.email).toBe('octocat@github.com');
        expect(userInfo.name).toBe('The Octocat');
        expect(userInfo.picture).toBe('https://github.com/images/octocat.png');
      } finally {
        oauthMock.restore();
      }
    });

    test('should stringify numeric GitHub user ID', async () => {
      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        rawUserInfoResponse: {
          id: 98765432,
          email: 'numeric-id@github.com',
        },
      });

      try {
        const userInfo = await services.oauthConnectService.fetchUserInfo(
          'github',
          oauthMock.tokens.access_token,
        );

        expect(userInfo.id).toBe('98765432');
        expect(typeof userInfo.id).toBe('string');
      } finally {
        oauthMock.restore();
      }
    });

    test('should default email_verified to true when mapping is absent', async () => {
      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        rawUserInfoResponse: {
          id: 111,
          email: 'no-verified-field@github.com',
          // GitHub does not return email_verified
        },
      });

      try {
        const userInfo = await services.oauthConnectService.fetchUserInfo(
          'github',
          oauthMock.tokens.access_token,
        );

        expect(userInfo.email_verified).toBe(true);
      } finally {
        oauthMock.restore();
      }
    });

    test('should use verified primary email from GitHub email_url when user email is null', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url === 'https://api.github.com/user') {
          const authorization = new Headers(init?.headers).get('authorization');
          if (authorization !== 'Bearer github-access-token') {
            return new Response(JSON.stringify({ error: 'invalid_token' }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            });
          }

          return new Response(
            JSON.stringify({
              id: 333,
              email: null,
              name: 'Primary Email User',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url === 'https://api.github.com/user/emails') {
          const authorization = new Headers(init?.headers).get('authorization');
          if (authorization !== 'Bearer github-access-token') {
            return new Response(JSON.stringify({ error: 'invalid_token' }), {
              status: 401,
              headers: { 'content-type': 'application/json' },
            });
          }

          return new Response(
            JSON.stringify([
              {
                email: 'secondary@github.example',
                primary: false,
                verified: true,
              },
              {
                email: 'primary@github.example',
                primary: true,
                verified: true,
              },
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      });

      const userInfo = await services.oauthConnectService.fetchUserInfo(
        'github',
        'github-access-token',
      );

      expect(userInfo.email).toBe('primary@github.example');
      expect(userInfo.email_verified).toBe(true);
    });

    test('should fail closed when GitHub has no verified primary email', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url === 'https://api.github.com/user') {
          return new Response(
            JSON.stringify({
              id: 444,
              email: null,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        if (url === 'https://api.github.com/user/emails') {
          return new Response(
            JSON.stringify([
              {
                email: 'unverified-primary@github.example',
                primary: true,
                verified: false,
              },
              {
                email: 'verified-secondary@github.example',
                primary: false,
                verified: true,
              },
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      });

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'github',
          'github-access-token',
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should throw when mapped id field is missing from response', async () => {
      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        rawUserInfoResponse: {
          // 'id' field is missing — GitHub mapping expects 'id'
          sub: 'wrong-field-name',
          email: 'missing-id@github.com',
        },
      });

      try {
        await expect(
          services.oauthConnectService.fetchUserInfo(
            'github',
            oauthMock.tokens.access_token,
          ),
        ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
      } finally {
        oauthMock.restore();
      }
    });

    test('should throw when email is missing from response', async () => {
      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        rawUserInfoResponse: {
          id: 222,
          // email is missing
        },
      });

      try {
        await expect(
          services.oauthConnectService.fetchUserInfo(
            'github',
            oauthMock.tokens.access_token,
          ),
        ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
      } finally {
        oauthMock.restore();
      }
    });

    test('should map invalid JSON userinfo responses to userinfo failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{invalid-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'github',
          'unused-access-token',
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });
  });

  describe('Google field mapping', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        identity_providers: [
          google({
            id: 'google',
            enabled: true,
            display_name: 'Google',
            client_id: 'test-google-client-id',
            client_secret: 'test-google-client-secret',
            email_conflict_strategy: 'auto_link',
          }),
        ],
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should parse string email_verified "false" as false', async () => {
      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        rawUserInfoResponse: {
          sub: 'google-string-false',
          email: 'string-false@google.example',
          email_verified: 'false',
        },
      });

      try {
        const userInfo = await services.oauthConnectService.fetchUserInfo(
          'google',
          oauthMock.tokens.access_token,
        );

        expect(userInfo.email_verified).toBe(false);
      } finally {
        oauthMock.restore();
      }
    });
  });

  describe('Generic OAuth field mapping', () => {
    test('should support dotted paths in userinfo mappings', async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        identity_providers: [
          genericOAuth({
            id: 'generic-dotted',
            enabled: true,
            display_name: 'Generic Dotted',
            client_id: 'generic-dotted-client-id',
            client_secret: 'generic-dotted-client-secret',
            authorization_url: 'https://generic.example/authorize',
            token_url: 'https://generic.example/token',
            userinfo_url: 'https://generic.example/userinfo',
            scopes: ['openid', 'email', 'profile'],
            email_conflict_strategy: 'auto_link',
            userinfo_mapping: {
              id: 'account.id',
              email: 'profile.email',
              email_verified: 'profile.email_verified',
              name: 'profile.name',
              picture: 'profile.avatar.url',
            },
          }),
        ],
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://generic.example/token',
        userInfoUrl: 'https://generic.example/userinfo',
        rawUserInfoResponse: {
          account: { id: 'nested-user-id' },
          profile: {
            email: 'nested@example.com',
            email_verified: true,
            name: 'Nested User',
            avatar: { url: 'https://generic.example/avatar.png' },
          },
        },
      });

      try {
        const userInfo =
          await server.services.oauthConnectService.fetchUserInfo(
            'generic-dotted',
            oauthMock.tokens.access_token,
          );

        expect(userInfo).toEqual({
          id: 'nested-user-id',
          email: 'nested@example.com',
          email_verified: true,
          name: 'Nested User',
          picture: 'https://generic.example/avatar.png',
        });
      } finally {
        oauthMock.restore();
        await server.cleanup();
      }
    });

    test('should not mark generic provider email verified without explicit mapping', async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        identity_providers: [
          genericOAuth({
            id: 'generic-no-verified-mapping',
            enabled: true,
            display_name: 'Generic No Verified Mapping',
            client_id: 'generic-no-verified-client-id',
            client_secret: 'generic-no-verified-client-secret',
            authorization_url: 'https://generic.example/authorize',
            token_url: 'https://generic.example/token',
            userinfo_url: 'https://generic.example/userinfo',
            scopes: ['openid', 'email'],
            email_conflict_strategy: 'auto_link',
            userinfo_mapping: {
              id: 'sub',
              email: 'email',
            },
          }),
        ],
      });

      const oauthMock = mockOAuthProviderFetch({
        tokenUrl: 'https://generic.example/token',
        userInfoUrl: 'https://generic.example/userinfo',
        rawUserInfoResponse: {
          sub: 'generic-untrusted-email',
          email: 'untrusted@example.com',
        },
      });

      try {
        const userInfo =
          await server.services.oauthConnectService.fetchUserInfo(
            'generic-no-verified-mapping',
            oauthMock.tokens.access_token,
          );

        expect(userInfo.email_verified).toBe(false);
      } finally {
        oauthMock.restore();
        await server.cleanup();
      }
    });
  });

  describe('Apple ID token decoding', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
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
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should extract user info from ID token when userinfo_url is null', async () => {
      const idToken = await createTrustedAppleIdToken({
        sub: 'apple-user-001',
        email: 'user@icloud.com',
        email_verified: true,
        iss: 'https://appleid.apple.com',
        aud: 'test-apple-client-id',
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      const userInfo = await services.oauthConnectService.fetchUserInfo(
        'apple',
        'unused-access-token',
        idToken,
      );

      expect(userInfo.id).toBe('apple-user-001');
      expect(userInfo.email).toBe('user@icloud.com');
      expect(userInfo.email_verified).toBe(true);
    });

    test('should use configured Apple JWKS URL when verifying ID tokens', async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        identity_providers: [
          apple({
            id: 'apple-custom-jwks',
            enabled: true,
            display_name: 'Apple Custom JWKS',
            client_id: 'test-apple-custom-jwks-client-id',
            client_secret: 'test-apple-custom-jwks-client-secret',
            unsafe_jwks_url_for_tests: 'https://apple.test/keys',
            email_conflict_strategy: 'auto_link',
          }),
        ],
      });

      try {
        const idToken = await createTrustedAppleIdToken(
          {
            sub: 'apple-user-custom-jwks',
            email: 'custom-jwks@icloud.com',
            email_verified: true,
            iss: 'https://appleid.apple.com',
            aud: 'test-apple-custom-jwks-client-id',
            exp: Math.floor(Date.now() / 1000) + 60,
          },
          'https://apple.test/keys',
        );

        const userInfo =
          await server.services.oauthConnectService.fetchUserInfo(
            'apple-custom-jwks',
            'unused-access-token',
            idToken,
          );

        expect(userInfo.email).toBe('custom-jwks@icloud.com');
      } finally {
        await server.cleanup();
      }
    });

    test('should reject invalid Apple unsafe JWKS URL config', async () => {
      await expect(
        createTestApp({
          ...MINIMAL_TEST_CONFIG,
          identity_providers: [
            apple({
              id: 'apple-invalid-jwks',
              enabled: true,
              display_name: 'Apple Invalid JWKS',
              client_id: 'test-apple-invalid-jwks-client-id',
              client_secret: 'test-apple-invalid-jwks-client-secret',
              unsafe_jwks_url_for_tests: 'not-a-url',
              email_conflict_strategy: 'auto_link',
            }),
          ],
        }),
      ).rejects.toThrow();
    });

    test('should handle Apple ID token with email_verified as string "true"', async () => {
      const idToken = await createTrustedAppleIdToken({
        sub: 'apple-user-002',
        email: 'user2@icloud.com',
        email_verified: 'true',
        iss: 'https://appleid.apple.com',
        aud: 'test-apple-client-id',
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      const userInfo = await services.oauthConnectService.fetchUserInfo(
        'apple',
        'unused-access-token',
        idToken,
      );

      expect(userInfo.email_verified).toBe(true);
    });

    test('should reject Apple ID token signed by an untrusted key', async () => {
      const idToken = await createTrustedAppleIdToken({
        sub: 'apple-untrusted-key',
        email: 'untrusted@icloud.com',
        email_verified: true,
        iss: 'https://appleid.apple.com',
        aud: 'test-apple-client-id',
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ keys: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should throw when no ID token is provided for Apple', async () => {
      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          // no idToken
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should throw when ID token is missing sub claim', async () => {
      const idToken = await createTrustedAppleIdToken({
        // sub is missing
        email: 'nosub@icloud.com',
        email_verified: true,
        iss: 'https://appleid.apple.com',
        aud: 'test-apple-client-id',
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should throw when ID token is missing email claim', async () => {
      const idToken = await createTrustedAppleIdToken({
        sub: 'apple-user-noemail',
        // email is missing
        email_verified: true,
        iss: 'https://appleid.apple.com',
        aud: 'test-apple-client-id',
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should reject Apple ID token with wrong issuer', async () => {
      const idToken = await createTrustedAppleIdToken({
        sub: 'apple-wrong-issuer',
        email: 'wrong-issuer@icloud.com',
        email_verified: true,
        iss: 'https://example.com',
        aud: 'test-apple-client-id',
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should reject Apple ID token with wrong audience', async () => {
      const idToken = await createTrustedAppleIdToken({
        sub: 'apple-wrong-audience',
        email: 'wrong-audience@icloud.com',
        email_verified: true,
        iss: 'https://appleid.apple.com',
        aud: 'different-client-id',
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should reject expired Apple ID token', async () => {
      const idToken = await createAppleIdToken({
        sub: 'apple-expired',
        email: 'expired@icloud.com',
        email_verified: true,
        iss: 'https://appleid.apple.com',
        aud: 'test-apple-client-id',
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });
  });

  describe('Non-Apple ID token fallback', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        identity_providers: [
          {
            id: 'generic-no-userinfo',
            type: 'generic_oauth',
            enabled: true,
            display_name: 'Generic No Userinfo',
            client_id: 'generic-client-id',
            client_secret: 'generic-client-secret',
            authorization_url: 'https://generic.example/authorize',
            token_url: 'https://generic.example/token',
            userinfo_url: null,
            scopes: ['openid', 'email'],
            email_conflict_strategy: 'auto_link',
            userinfo_mapping: {
              id: 'sub',
              email: 'email',
              email_verified: 'email_verified',
            },
          },
          {
            id: 'generic-no-userinfo-jwks',
            type: 'generic_oauth',
            enabled: true,
            display_name: 'Generic No Userinfo JWKS',
            client_id: 'generic-jwks-client-id',
            client_secret: 'generic-jwks-client-secret',
            authorization_url: 'https://generic.example/authorize',
            token_url: 'https://generic.example/token',
            userinfo_url: null,
            jwks_url: 'https://generic.example/jwks',
            issuer: 'https://generic.example',
            scopes: ['openid', 'email'],
            email_conflict_strategy: 'auto_link',
            userinfo_mapping: {
              id: 'sub',
              email: 'email',
              email_verified: 'email_verified',
            },
          },
        ],
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should reject unsigned ID token for non-Apple provider without userinfo_url', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
        'base64url',
      );
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'generic-user',
          email: 'generic@example.com',
          email_verified: true,
        }),
      ).toString('base64url');
      const idToken = `${header}.${payload}.`;

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'generic-no-userinfo',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should verify signed ID token with expected issuer for generic provider without userinfo_url', async () => {
      const idToken = await createTrustedAppleIdToken(
        {
          sub: 'generic-jwks-user',
          email: 'generic-jwks@example.com',
          email_verified: true,
          iss: 'https://generic.example',
          aud: 'generic-jwks-client-id',
          exp: Math.floor(Date.now() / 1000) + 60,
        },
        'https://generic.example/jwks',
      );

      const userInfo = await services.oauthConnectService.fetchUserInfo(
        'generic-no-userinfo-jwks',
        'unused-access-token',
        idToken,
      );

      expect(userInfo).toEqual({
        id: 'generic-jwks-user',
        email: 'generic-jwks@example.com',
        email_verified: true,
      });
    });

    test('should reject signed ID token with wrong issuer for generic provider without userinfo_url', async () => {
      const idToken = await createTrustedAppleIdToken(
        {
          sub: 'generic-jwks-user',
          email: 'generic-jwks@example.com',
          email_verified: true,
          iss: 'https://evil.example',
          aud: 'generic-jwks-client-id',
          exp: Math.floor(Date.now() / 1000) + 60,
        },
        'https://generic.example/jwks',
      );

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'generic-no-userinfo-jwks',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });
  });
});

describe('OAuthConnectService - OAuth account linking', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      identity_providers: [
        google({
          id: 'google',
          enabled: true,
          display_name: 'Google',
          client_id: 'test-google-client-id',
          client_secret: 'test-google-client-secret',
          email_conflict_strategy: 'auto_link',
        }),
      ],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should reject linking the same provider account to a different user', async () => {
    const users = await withMikroContext(services, async () => {
      const firstUser = services.mikro.user.create({
        email: generateUniqueEmail('oauth-link-first'),
        password_hash: null,
      });
      firstUser.email_verified = true;

      const secondUser = services.mikro.user.create({
        email: generateUniqueEmail('oauth-link-second'),
        password_hash: null,
      });
      secondUser.email_verified = true;

      await services.mikro.em.persist([firstUser, secondUser]).flush();
      return {
        firstUserSub: firstUser.sub,
        secondUserSub: secondUser.sub,
      };
    });

    await withMikroContext(services, () =>
      services.oauthConnectService.linkOAuthAccount(
        users.firstUserSub,
        'google',
        MOCK_TOKENS,
        {
          id: 'shared-provider-account',
          email: generateUniqueEmail('oauth-link-provider'),
          email_verified: true,
        },
      ),
    );

    await expectApiError(
      withMikroContext(services, () =>
        services.oauthConnectService.linkOAuthAccount(
          users.secondUserSub,
          'google',
          MOCK_TOKENS,
          {
            id: 'shared-provider-account',
            email: generateUniqueEmail('oauth-link-provider'),
            email_verified: true,
          },
        ),
      ),
      'OAUTH_ACCOUNT_ALREADY_LINKED',
    );
  });

  test('should deterministically allow only one concurrent link for the same provider account', async () => {
    const users = await withMikroContext(services, async () => {
      const firstUser = services.mikro.user.create({
        email: generateUniqueEmail('oauth-link-race-first'),
        password_hash: null,
      });
      firstUser.email_verified = true;

      const secondUser = services.mikro.user.create({
        email: generateUniqueEmail('oauth-link-race-second'),
        password_hash: null,
      });
      secondUser.email_verified = true;

      await services.mikro.em.persist([firstUser, secondUser]).flush();
      return {
        firstUserSub: firstUser.sub,
        secondUserSub: secondUser.sub,
      };
    });

    const providerUserId = `shared-provider-account-${crypto.randomUUID()}`;
    const results = await Promise.allSettled([
      withMikroContext(services, () =>
        services.oauthConnectService.linkOAuthAccount(
          users.firstUserSub,
          'google',
          MOCK_TOKENS,
          {
            id: providerUserId,
            email: generateUniqueEmail('oauth-link-race-provider'),
            email_verified: true,
          },
        ),
      ),
      withMikroContext(services, () =>
        services.oauthConnectService.linkOAuthAccount(
          users.secondUserSub,
          'google',
          MOCK_TOKENS,
          {
            id: providerUserId,
            email: generateUniqueEmail('oauth-link-race-provider'),
            email_verified: true,
          },
        ),
      ),
    ]);

    const fulfilledCount = results.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    const rejectedCount = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);
  });
});
