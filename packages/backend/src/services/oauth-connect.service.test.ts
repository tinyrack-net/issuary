import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

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
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: ['*'],
        },
        identity_providers: [
          {
            id: 'google',
            type: 'google',
            enabled: true,
            display_name: 'Google',
            client_id: 'test-google-client-id',
            client_secret: 'test-google-client-secret',
            email_conflict_strategy: 'auto_link',
          },
        ],
      },
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
      const user = services.mikro.user.create({
        email,
        password_hash: 'test-password',
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
      services.oauthConnectService.getLinkedAccounts(result.user.id),
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
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: ['*'],
        },
        identity_providers: [
          {
            id: 'google',
            type: 'google',
            enabled: true,
            display_name: 'Google',
            client_id: 'test-google-client-id',
            client_secret: 'test-google-client-secret',
            email_conflict_strategy: 'require_link',
          },
        ],
      },
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
      const user = services.mikro.user.create({
        email,
        password_hash: 'test-password',
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
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: ['*'],
        },
        identity_providers: [
          {
            id: 'google',
            type: 'google',
            enabled: true,
            display_name: 'Google',
            client_id: 'test-google-client-id',
            client_secret: 'test-google-client-secret',
            email_conflict_strategy: 'auto_link',
          },
        ],
      },
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
