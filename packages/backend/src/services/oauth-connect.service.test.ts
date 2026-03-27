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
import { apple } from '../entrypoints/identity-providers/apple.ts';
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

/**
 * Tests for OAuthConnectService.authenticateWithOAuth()
 * Covers email_conflict_strategy (auto_link / require_link)
 * and email_verified validation.
 */

const MOCK_TOKENS = {
  access_token: 'mock-access-token',
  token_type: 'Bearer',
};

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

    test('should extract user info from ID token when userinfo_url is null', async () => {
      const { privateKey } = await generateKeyPair('RS256');
      const idToken = await new SignJWT({
        sub: 'apple-user-001',
        email: 'user@icloud.com',
        email_verified: true,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .sign(privateKey);

      const userInfo = await services.oauthConnectService.fetchUserInfo(
        'apple',
        'unused-access-token',
        idToken,
      );

      expect(userInfo.id).toBe('apple-user-001');
      expect(userInfo.email).toBe('user@icloud.com');
      expect(userInfo.email_verified).toBe(true);
    });

    test('should handle Apple ID token with email_verified as string "true"', async () => {
      const { privateKey } = await generateKeyPair('RS256');
      const idToken = await new SignJWT({
        sub: 'apple-user-002',
        email: 'user2@icloud.com',
        email_verified: 'true',
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .sign(privateKey);

      const userInfo = await services.oauthConnectService.fetchUserInfo(
        'apple',
        'unused-access-token',
        idToken,
      );

      expect(userInfo.email_verified).toBe(true);
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
      const { privateKey } = await generateKeyPair('RS256');
      const idToken = await new SignJWT({
        // sub is missing
        email: 'nosub@icloud.com',
        email_verified: true,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .sign(privateKey);

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });

    test('should throw when ID token is missing email claim', async () => {
      const { privateKey } = await generateKeyPair('RS256');
      const idToken = await new SignJWT({
        sub: 'apple-user-noemail',
        // email is missing
        email_verified: true,
      })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .sign(privateKey);

      await expect(
        services.oauthConnectService.fetchUserInfo(
          'apple',
          'unused-access-token',
          idToken,
        ),
      ).rejects.toHaveProperty('code', 'OAUTH_USERINFO_FAILED');
    });
  });
});
