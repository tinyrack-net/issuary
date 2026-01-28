import { describe, expect, test } from 'vitest';
import type { DeepPartial, InternalAppConfig } from '@/lib/config/index.js';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  expectError,
  generateUniqueEmail,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';
import { DEFAULT_TEST_CONFIG } from '@/test-utils/setup.js';

const app = setupTestServer();

/**
 * Default consents for required terms in test config
 */
const REQUIRED_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
];

describe('POST /api/v1/auth/register', () => {
  test('should return 403 when signup is disabled (empty allowed_signup_emails)', async () => {
    const disabledApp = await createServer({
      baseConfig: DEFAULT_TEST_CONFIG,
      configOverrides: {
        app: {
          allowed_signup_emails: [],
        },
      },
    });

    const res = await disabledApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expectError(res, e.RegistrationDisabled);

    await disabledApp.close();
  });

  test('should return 403 when email is not in allowed patterns', async () => {
    const restrictedApp = await createServer({
      baseConfig: DEFAULT_TEST_CONFIG,
      configOverrides: {
        app: {
          allowed_signup_emails: ['*@allowed.com'],
        },
      },
    });

    const res = await restrictedApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'user@notallowed.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expectError(res, e.RegistrationEmailNotAllowed);

    await restrictedApp.close();
  });

  test('should allow registration with domain wildcard pattern', async () => {
    const restrictedApp = await createServer({
      baseConfig: DEFAULT_TEST_CONFIG,
      configOverrides: {
        app: {
          allowed_signup_emails: ['*@allowed.com'],
        },
      },
    });

    const uniqueEmail = `user${Date.now()}@allowed.com`;
    const res = await restrictedApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');

    await restrictedApp.close();
  });

  test('should allow registration with exact email pattern', async () => {
    const exactEmail = `exact${Date.now()}@specific.com`;
    const restrictedApp = await createServer({
      baseConfig: DEFAULT_TEST_CONFIG,
      configOverrides: {
        app: {
          allowed_signup_emails: [exactEmail],
        },
      },
    });

    const res = await restrictedApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: exactEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');

    await restrictedApp.close();
  });

  test('should reject non-matching email with exact email pattern', async () => {
    const restrictedApp = await createServer({
      baseConfig: DEFAULT_TEST_CONFIG,
      configOverrides: {
        app: {
          allowed_signup_emails: ['allowed@specific.com'],
        },
      },
    });

    const res = await restrictedApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'other@specific.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expectError(res, e.RegistrationEmailNotAllowed);

    await restrictedApp.close();
  });

  test('should allow registration with multiple patterns', async () => {
    const restrictedApp = await createServer({
      baseConfig: DEFAULT_TEST_CONFIG,
      configOverrides: {
        app: {
          allowed_signup_emails: ['*@company.com', 'special@other.com'],
        },
      },
    });

    // Test domain wildcard
    const email1 = `user${Date.now()}@company.com`;
    const res1 = await restrictedApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: email1,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });
    expect(res1.statusCode).toBe(200);

    // Test exact match
    const res2 = await restrictedApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'special@other.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });
    expect(res2.statusCode).toBe(200);

    // Test rejected email
    const res3 = await restrictedApp.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'nobody@rejected.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });
    expectError(res3, e.RegistrationEmailNotAllowed);

    await restrictedApp.close();
  });

  test('should register successfully with valid credentials and consents', async () => {
    const uniqueEmail = generateUniqueEmail();

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);
  });

  test('should fail registration without required terms consent', async () => {
    const uniqueEmail = generateUniqueEmail();

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        // No consents provided
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should fail registration when required term is not agreed', async () => {
    const uniqueEmail = generateUniqueEmail();

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: [
          { termsId: 'tos', agreed: true },
          { termsId: 'privacy', agreed: false }, // Not agreed
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toMatch(/privacy/i);
  });

  test('should fail with app config user email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test-config-user@example.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expectError(res, e.EmailAlreadyExists);
  });

  test('should fail with duplicate email', async () => {
    const uniqueEmail = generateUniqueEmail('duplicate');

    // First registration
    await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    // Second registration with same email
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expectError(res, e.EmailAlreadyExists);
  });

  test('should fail with invalid email format', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with short password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: '12345',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with long password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'a'.repeat(101),
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing email', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing password', async () => {
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('message');
  });

  test('should NOT create session after registration (requires email verification)', async () => {
    const uniqueEmail = generateUniqueEmail('session');
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.statusCode).toBe(200);
  });

  test('should generate verification token after registration', async () => {
    const uniqueEmail = generateUniqueEmail('verify');
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);

    // Check that verification token was created in database
    await withMikroContext(app, async () => {
      const user = await app.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      expect(user).toBeDefined();
      expect(user.email_verified).toBe(false);

      const verification = await app.mikro.emailVerification.findOneOrFail({
        user: user,
        verified: false,
      });
      expect(verification).toBeDefined();
      expect(verification?.token).toBeDefined();
    });
  });

  test('should record terms consent in database after registration', async () => {
    const uniqueEmail = generateUniqueEmail('terms');
    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Check that terms consent was recorded
    await withMikroContext(app, async () => {
      const consents = await app.mikro.userTermsConsent.findAllConsents(
        body.user.id,
      );

      expect(consents.length).toBe(2);

      const tosConsent = consents.find((c) => c.termsId === 'tos');
      expect(tosConsent).toBeDefined();
      expect(tosConsent?.agreed).toBe(true);
      expect(tosConsent?.consentType).toBe('explicit');

      const privacyConsent = consents.find((c) => c.termsId === 'privacy');
      expect(privacyConsent).toBeDefined();
      expect(privacyConsent?.agreed).toBe(true);
    });
  });
});

describe('POST /api/v1/auth/register (implicit consent mode)', () => {
  const app = setupTestServer({
    configOverrides: {
      app: {
        signup_implicit_terms: {
          en: 'By signing up, you agree to our Terms.',
        },
      },
      terms: [
        {
          id: 'tos',
          required: true,
          consent_mode: 'implicit',
          version: '1.0.0',
          content: {
            en: {
              title: 'Terms',
              type: 'link',
              content: 'https://example.com/terms',
            },
          },
        },
      ],
    } as DeepPartial<InternalAppConfig>,
  });

  test('should register without explicit consents in implicit mode', async () => {
    const uniqueEmail = generateUniqueEmail('implicit');

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        // No consents provided - should work in implicit mode
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');
  });

  test('should record implicit consent automatically', async () => {
    const uniqueEmail = generateUniqueEmail('implicit-record');

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Check that implicit consent was recorded
    await withMikroContext(app, async () => {
      const consents = await app.mikro.userTermsConsent.findAllConsents(
        body.user.id,
      );

      expect(consents.length).toBe(1);

      const tosConsent = consents.find((c) => c.termsId === 'tos');
      expect(tosConsent).toBeDefined();
      expect(tosConsent?.agreed).toBe(true);
      expect(tosConsent?.consentType).toBe('implicit');
    });
  });
});

describe('POST /api/v1/auth/register (no terms configured)', () => {
  const app = setupTestServer({
    configOverrides: {
      terms: [], // No terms
    } as DeepPartial<InternalAppConfig>,
  });

  test('should register without consents when no terms configured', async () => {
    const uniqueEmail = generateUniqueEmail('no-terms');

    const res = await app.inject({
      method: 'post',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'password123',
        // No consents needed
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('user');
  });
});
