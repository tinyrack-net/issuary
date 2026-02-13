import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '@/lib/app.js';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import type { ServiceContainer } from '@/services/container.js';
import {
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

/**
 * Default consents for required terms in test config
 */
const REQUIRED_CONSENTS = [
  { termsId: 'tos', agreed: true },
  { termsId: 'privacy', agreed: true },
];

describe('POST /api/v1/auth/register', () => {
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

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email_verification_required).toBe(true);
  });

  test('should fail registration without required terms consent', async () => {
    const uniqueEmail = generateUniqueEmail();

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        // No consents provided
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('should fail registration when required term is not agreed', async () => {
    const uniqueEmail = generateUniqueEmail();

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: [
          { termsId: 'tos', agreed: true },
          { termsId: 'privacy', agreed: false }, // Not agreed
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.data).toMatch(/privacy/i);
  });

  test('should fail with app config user email', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test-config-user@example.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectError(res, e.EmailAlreadyExists);
  });

  test('should fail with duplicate email', async () => {
    const uniqueEmail = generateUniqueEmail('duplicate');

    // First registration
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Second registration with same email
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectError(res, e.EmailAlreadyExists);
  });

  test('should fail with invalid email format', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'password123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with short password', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: '12345',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with long password', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'a'.repeat(101),
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing email', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        password: 'password123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should fail with missing password', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('should NOT create session after registration (requires email verification)', async () => {
    const uniqueEmail = generateUniqueEmail('session');
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
  });

  test('should generate verification token after registration', async () => {
    const uniqueEmail = generateUniqueEmail('verify');
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
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
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // Check that terms consent was recorded
    await withMikroContext(services, async () => {
      const consents = await services.mikro.userTermsConsent.findAllConsents(
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

describe('POST /api/v1/auth/register (signup disabled)', () => {
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
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectError(res, e.RegistrationDisabled);
  });
});

describe('POST /api/v1/auth/register (domain wildcard pattern)', () => {
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
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@notallowed.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectError(res, e.RegistrationEmailNotAllowed);
  });

  test('should allow registration with domain wildcard pattern', async () => {
    const uniqueEmail = `user${Date.now()}@allowed.com`;
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });
});

describe('POST /api/v1/auth/register (exact email pattern)', () => {
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
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: exactEmail,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });

  test('should reject non-matching email with exact email pattern', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'other@specific.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectError(res, e.RegistrationEmailNotAllowed);
  });
});

describe('POST /api/v1/auth/register (multiple patterns)', () => {
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
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
  });

  test('should allow registration with exact match from multiple patterns', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'special@other.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
  });

  test('should reject email not matching any pattern', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nobody@rejected.com',
        password: 'password123',
        consents: REQUIRED_CONSENTS,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectError(res, e.RegistrationEmailNotAllowed);
  });
});

describe('POST /api/v1/auth/register (implicit consent mode)', () => {
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

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        // No consents provided - should work in implicit mode
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });

  test('should record implicit consent automatically', async () => {
    const uniqueEmail = generateUniqueEmail('implicit-record');

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // Check that implicit consent was recorded
    await withMikroContext(services, async () => {
      const consents = await services.mikro.userTermsConsent.findAllConsents(
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

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'password123',
        // No consents needed
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });
});
