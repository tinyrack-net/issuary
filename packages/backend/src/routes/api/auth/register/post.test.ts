import type { AppType } from '@backend/app.js';
import { e } from '@backend/schemas/error.js';
import { createServer } from '@backend/server.js';
import type { ServiceContainer } from '@backend/services/container.js';
import {
  assertJsonBody,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@backend/test-utils/index.js';
import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

/**
 * Default consents for required terms in test config
 */
const REQUIRED_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
];

describe('POST /api/auth/register', () => {
  let app: AppType;
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
        users: [TEST_USER_CONFIG],
        terms: TEST_TERMS_CONFIG,
      },
    });
    app = server.app;
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should register successfully with valid credentials and consents', async () => {
    const uniqueEmail = generateUniqueEmail();
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    const body = await assertJsonBody(res);
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);
  });

  test('should fail registration without required terms consent', async () => {
    const uniqueEmail = generateUniqueEmail();
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
        // No consents provided
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should fail registration when required term is not agreed', async () => {
    const uniqueEmail = generateUniqueEmail();
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: [
          { termsId: 'tos', agreed: true },
          { termsId: 'privacy', agreed: false },
        ],
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toMatch(/privacy/i);
  });

  test('should fail with app config user email', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'test-config-user@example.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    await expectError(res, e.EmailAlreadyExists);
  });

  test('should fail with duplicate email', async () => {
    const uniqueEmail = generateUniqueEmail('duplicate');
    const client = testClient(app);

    // First registration
    await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    // Second registration with same email
    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    await expectError(res, e.EmailAlreadyExists);
  });

  test('should fail with invalid email format', async () => {
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: 'not-an-email',
        password: 'password123',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should fail with short password', async () => {
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: 'test@example.com',
        password: '12345',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should fail with long password', async () => {
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: 'test@example.com',
        password: 'a'.repeat(101),
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should fail with missing email', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      // @ts-expect-error testing validation with invalid input
      json: {
        password: 'password123',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should fail with missing password', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      // @ts-expect-error testing validation with invalid input
      json: {
        email: 'test@example.com',
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body).toHaveProperty('error');
    expect(body.success).toBe(false);
  });

  test('should NOT create session after registration (requires email verification)', async () => {
    const uniqueEmail = generateUniqueEmail('session');
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.status).toBe(200);
  });

  test('should generate verification token after registration', async () => {
    const uniqueEmail = generateUniqueEmail('verify');
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    const body = await assertJsonBody(res);
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);

    // Check that verification token was created in database
    await withMikroContext(services, async () => {
      const user = await services.mikro.user.findOneOrFail({
        email: uniqueEmail,
      });
      expect(user).toBeDefined();
      expect(user.email_verified).toBe(false);

      const verification = await services.mikro.emailVerification.findOneOrFail(
        {
          user: user,
          verified: false,
        },
      );
      expect(verification).toBeDefined();
      expect(verification?.token).toBeDefined();
    });
  });

  test('should record terms consent in database after registration', async () => {
    const uniqueEmail = generateUniqueEmail('terms');
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    const body = await assertJsonBody(res);

    // Check that terms consent was recorded
    await withMikroContext(services, async () => {
      const consents = await services.mikro.userTermsConsent.findAllConsents(
        body.user.sub,
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

describe('POST /api/auth/register (signup disabled)', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: [],
        },
        terms: TEST_TERMS_CONFIG,
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should return 403 when signup is disabled (empty allowed_signup_emails)', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'test@example.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    await expectError(res, e.RegistrationDisabled);
  });
});

describe('POST /api/auth/register (domain wildcard pattern)', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: ['*@allowed.com'],
        },
        terms: TEST_TERMS_CONFIG,
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should return 403 when email is not in allowed patterns', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'user@notallowed.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    await expectError(res, e.RegistrationEmailNotAllowed);
  });

  test('should allow registration with domain wildcard pattern', async () => {
    const uniqueEmail = `user${Date.now()}@allowed.com`;
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });
});

describe('POST /api/auth/register (exact email pattern)', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;
  const exactEmail = 'exact-allowed@specific.com';

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: [exactEmail],
        },
        terms: TEST_TERMS_CONFIG,
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should allow registration with exact email pattern', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: exactEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });

  test('should reject non-matching email with exact email pattern', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'other@specific.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });

    await expectError(res, e.RegistrationEmailNotAllowed);
  });
});

describe('POST /api/auth/register (multiple patterns)', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: ['*@company.com', 'special@other.com'],
        },
        terms: TEST_TERMS_CONFIG,
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should allow registration with domain wildcard from multiple patterns', async () => {
    const email = `user${Date.now()}@company.com`;
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });
    expect(res.status).toBe(200);
  });

  test('should allow registration with exact match from multiple patterns', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'special@other.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });
    expect(res.status).toBe(200);
  });

  test('should reject email not matching any pattern', async () => {
    const client = testClient(app);

    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: 'nobody@rejected.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      },
    });
    await expectError(res, e.RegistrationEmailNotAllowed);
  });
});

describe('POST /api/auth/register (implicit consent mode)', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: ['*'],
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
      },
    });
    app = server.app;
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should register without explicit consents in implicit mode', async () => {
    const uniqueEmail = generateUniqueEmail('implicit');
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
        // No consents provided - should work in implicit mode
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });

  test('should record implicit consent automatically', async () => {
    const uniqueEmail = generateUniqueEmail('implicit-record');
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
      },
    });

    const body = await assertJsonBody(res);

    // Check that implicit consent was recorded
    await withMikroContext(services, async () => {
      const consents = await services.mikro.userTermsConsent.findAllConsents(
        body.user.sub,
      );

      expect(consents.length).toBe(1);

      const tosConsent = consents.find((c) => c.termsId === 'tos');
      expect(tosConsent).toBeDefined();
      expect(tosConsent?.agreed).toBe(true);
      expect(tosConsent?.consentType).toBe('implicit');
    });
  });
});

describe('POST /api/auth/register (no terms configured)', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        app: {
          ...MINIMAL_TEST_CONFIG.app,
          allowed_signup_emails: ['*'],
        },
        terms: [],
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should register without consents when no terms configured', async () => {
    const uniqueEmail = generateUniqueEmail('no-terms');
    const client = testClient(app);

    // @ts-expect-error testing validation with invalid input
    const res = await client.api.auth.register.$post({
      json: {
        email: uniqueEmail,
        password: 'password123',
        // No consents needed
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });
});

describe('POST /api/auth/register (password disabled)', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createServer({
      config: {
        ...MINIMAL_TEST_CONFIG,
        users: [TEST_USER_CONFIG],
        auth: {
          password: {
            enabled: false,
          },
        },
        terms: TEST_TERMS_CONFIG,
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('should return validation error when password auth is disabled', async () => {
    const client = testClient(app);
    const res = await client.api.auth.register.$post({
      header: { 'accept-language': 'en' },
      json: {
        email: generateUniqueEmail('password-disabled'),
        password: TEST_USER_CONFIG.password,
        consents: REQUIRED_CONSENTS,
      },
    });

    const body = await assertJsonBody(res, 400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toBe('Password authentication is disabled');
  });
});
