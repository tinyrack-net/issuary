import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_TERMS_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

describe('POST /api/terms/consent', () => {
  describe('Authentication', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
        users: [TEST_USER_CONFIG],
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return 401 when not authenticated', async () => {
      const client = testClient(app);

      const res = await client.api.terms.consent.$post({
        json: {
          consents: [{ termsId: 'tos', agreed: true }],
        },
      });

      expect(res.status).toBe(401);
      await expectError(res, e.Unauthorized);
    });

    test('should return 401 with invalid session', async () => {
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [{ termsId: 'tos', agreed: true }],
          },
        },
        { headers: { Cookie: 'session=invalid-session' } },
      );

      expect(res.status).toBe(401);
    });
  });

  describe('Validation', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
        users: [TEST_USER_CONFIG],
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return 400 when consents array is empty', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when consents is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          // @ts-expect-error testing validation with invalid input
          json: {},
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when termsId is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            // @ts-expect-error testing validation with invalid input
            consents: [{ agreed: true }],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when agreed is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            // @ts-expect-error testing validation with invalid input
            consents: [{ termsId: 'tos' }],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when agreed is not boolean', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            // @ts-expect-error testing validation with invalid input
            consents: [{ termsId: 'tos', agreed: 'yes' }],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(400);
    });

    test('should return 400 when required term is not agreed', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: false }, // Required term not agreed
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res, 400);
      expect(body.code).toBe('VALIDATION_ERROR');
      // ValidationError uses createErrorWithData, so the custom message is in 'data'
      expect(body.data).toMatch(/tos/i);
    });

    test('should return 400 when required term is missing from consents', async () => {
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              // Missing 'privacy' which is also required
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res, 400);
      expect(body.code).toBe('VALIDATION_ERROR');
      // ValidationError uses createErrorWithData, so the custom message is in 'data'
      expect(body.data).toMatch(/privacy/i);
    });
  });

  describe('Successful consent recording', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should record consent and return success', async () => {
      const email = generateUniqueEmail('consent-success');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.ok).toBe(true);
      expect(body.recorded).toBe(2);
    });

    test('should store consent in database', async () => {
      const email = generateUniqueEmail('consent-db');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Verify in database
      await withMikroContext(services, async () => {
        const consents =
          await services.mikro.userTermsConsent.findAllConsents(userSub);

        expect(consents.length).toBe(2);

        const tosConsent = consents.find((c) => c.termsId === 'tos');
        expect(tosConsent).toBeDefined();
        expect(tosConsent?.agreed).toBe(true);
        expect(tosConsent?.termsVersion).toBe('1.0.0');
        expect(tosConsent?.consentType).toBe('explicit');
      });
    });

    test('should clear pending terms after consent', async () => {
      const email = generateUniqueEmail('consent-pending');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      // Check pending before consent
      const beforeRes = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const beforeBody = await beforeRes.json();
      expect(beforeBody.pendingTerms.length).toBeGreaterThan(0);

      // Give consent
      await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Check pending after consent
      const afterRes = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const afterBody = await afterRes.json();
      expect(afterBody.pendingTerms).toEqual([]);
    });
  });

  describe('Optional terms', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [
          {
            id: 'tos',
            required: true,
            consent_mode: 'explicit',
            version: '1.0.0',
            content: {
              en: {
                title: 'Terms',
                type: 'link',
                content: 'https://example.com/terms',
              },
            },
          },
          {
            id: 'marketing',
            required: false,
            consent_mode: 'explicit',
            version: '1.0.0',
            content: {
              en: {
                title: 'Marketing',
                type: 'text',
                content: 'Receive marketing emails',
              },
            },
          },
        ],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should allow not agreeing to optional terms', async () => {
      const email = generateUniqueEmail('consent-optional');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'marketing', agreed: false }, // Optional, can decline
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.recorded).toBe(2);
    });

    test('should record declined optional terms', async () => {
      const email = generateUniqueEmail('consent-decline');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'marketing', agreed: false },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await withMikroContext(services, async () => {
        const consent = await services.mikro.userTermsConsent.findLatestConsent(
          userSub,
          'marketing',
        );

        expect(consent).not.toBeNull();
        expect(consent?.agreed).toBe(false);
      });
    });

    test('should allow omitting optional terms', async () => {
      const email = generateUniqueEmail('consent-omit');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              // marketing term omitted - should be OK
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.recorded).toBe(1);
    });
  });

  describe('Unknown terms handling', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should ignore unknown term IDs', async () => {
      const email = generateUniqueEmail('consent-unknown');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
              {
                termsId: 'nonexistent-term',
                agreed: true,
              }, // Unknown
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      // Only 2 valid terms recorded
      expect(body.recorded).toBe(2);

      // Verify unknown term was not stored
      await withMikroContext(services, async () => {
        const consent = await services.mikro.userTermsConsent.findLatestConsent(
          userSub,
          'nonexistent-term',
        );
        expect(consent).toBeNull();
      });
    });
  });

  describe('Version tracking', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should record the current term version', async () => {
      const email = generateUniqueEmail('consent-version');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await withMikroContext(services, async () => {
        const consent = await services.mikro.userTermsConsent.findLatestConsent(
          userSub,
          'tos',
        );

        expect(consent?.termsVersion).toBe('1.0.0');
      });
    });
  });

  describe('Re-consent after version update', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should create new consent record for new version', async () => {
      const email = generateUniqueEmail('consent-reconsent');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      // Record old version consent directly in DB
      await withMikroContext(services, async () => {
        await services.mikro.userTermsConsent.recordConsent({
          userSub,
          termsId: 'tos',
          termsVersion: '0.9.0', // Old version
          agreed: true,
          consentType: 'explicit',
        });
      });

      // Record new consent
      await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Verify we have 2 consent records for 'tos'
      await withMikroContext(services, async () => {
        const consents = await services.mikro.userTermsConsent.find(
          {
            user: { sub: userSub },
            terms: { id: 'tos' },
          },
          { orderBy: { agreedAt: 'DESC' } },
        );

        expect(consents.length).toBe(2);
        expect(consents[0]?.termsVersion).toBe('1.0.0'); // Latest
        expect(consents[1]?.termsVersion).toBe('0.9.0'); // Old
      });
    });

    test('should update pending terms after re-consent', async () => {
      const email = generateUniqueEmail('consent-pending-update');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      // Record old version consent
      await withMikroContext(services, async () => {
        await services.mikro.userTermsConsent.recordConsents([
          {
            userSub,
            termsId: 'tos',
            termsVersion: '0.9.0',
            agreed: true,
            consentType: 'explicit',
          },
          {
            userSub,
            termsId: 'privacy',
            termsVersion: '1.0.0', // Already current
            agreed: true,
            consentType: 'explicit',
          },
        ]);
      });

      // Check pending - should include 'tos' (version mismatch)
      const beforeRes = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const beforeBody = await beforeRes.json();
      expect(beforeBody.pendingTerms).toContain('tos');
      expect(beforeBody.pendingTerms).not.toContain('privacy');

      // Re-consent to tos
      await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // Check pending - should be empty
      const afterRes = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      const afterBody = await afterRes.json();
      expect(afterBody.pendingTerms).toEqual([]);
    });
  });

  describe('Consent mode affects consentType field', () => {
    describe('explicit consent_mode term', () => {
      let app: AppType;
      let services: ServiceContainer;
      let cleanup: () => Promise<void>;

      beforeAll(async () => {
        const server = await createTestApp({
          ...MINIMAL_TEST_CONFIG,
          terms: [
            {
              id: 'tos',
              required: true,
              consent_mode: 'explicit',
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
        });
        app = server.app;
        services = server.services;
        cleanup = server.cleanup;
      });

      afterAll(async () => {
        await cleanup();
      });

      test('should record consentType as explicit', async () => {
        const email = generateUniqueEmail('consent-explicit');
        const { sessionCookie, userSub } = await createDbUserWithSession(
          app,
          services,
          email,
          'password123!',
        );
        const client = testClient(app);

        await client.api.terms.consent.$post(
          {
            json: {
              consents: [{ termsId: 'tos', agreed: true }],
            },
          },
          { headers: { Cookie: `session=${sessionCookie}` } },
        );

        await withMikroContext(services, async () => {
          const consent =
            await services.mikro.userTermsConsent.findLatestConsent(
              userSub,
              'tos',
            );
          expect(consent?.consentType).toBe('explicit');
        });
      });
    });

    describe('implicit consent_mode term', () => {
      let app: AppType;
      let services: ServiceContainer;
      let cleanup: () => Promise<void>;

      beforeAll(async () => {
        const server = await createTestApp({
          ...MINIMAL_TEST_CONFIG,
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
        });
        app = server.app;
        services = server.services;
        cleanup = server.cleanup;
      });

      afterAll(async () => {
        await cleanup();
      });

      test('should record consentType as implicit', async () => {
        const email = generateUniqueEmail('consent-implicit');
        const { sessionCookie, userSub } = await createDbUserWithSession(
          app,
          services,
          email,
          'password123!',
        );
        const client = testClient(app);

        await client.api.terms.consent.$post(
          {
            json: {
              consents: [{ termsId: 'tos', agreed: true }],
            },
          },
          { headers: { Cookie: `session=${sessionCookie}` } },
        );

        await withMikroContext(services, async () => {
          const consent =
            await services.mikro.userTermsConsent.findLatestConsent(
              userSub,
              'tos',
            );
          expect(consent?.consentType).toBe('implicit');
        });
      });
    });
  });

  describe('Concurrent consent submissions', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should handle multiple rapid consent submissions', async () => {
      const email = generateUniqueEmail('consent-concurrent');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      // Submit consent multiple times rapidly
      const requests = Array(5)
        .fill(null)
        .map(() =>
          client.api.terms.consent.$post(
            {
              json: {
                consents: [
                  { termsId: 'tos', agreed: true },
                  { termsId: 'privacy', agreed: true },
                ],
              },
            },
            { headers: { Cookie: `session=${sessionCookie}` } },
          ),
        );

      const responses = await Promise.all(requests);

      // All should succeed
      for (const res of responses) {
        expect(res.status).toBe(200);
      }

      // Verify multiple records exist
      await withMikroContext(services, async () => {
        const consents =
          await services.mikro.userTermsConsent.findAllConsents(userSub);

        // Each submission creates 2 records (tos + privacy)
        expect(consents.length).toBe(10);
      });
    });
  });

  describe('Edge cases', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
        users: [TEST_USER_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should handle very long user agent', async () => {
      const email = generateUniqueEmail('consent-long-ua');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );

      const longUserAgent = 'A'.repeat(512);

      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        {
          headers: {
            Cookie: `session=${sessionCookie}`,
            'User-Agent': longUserAgent,
          },
        },
      );

      expect(res.status).toBe(200);
    });

    test('should handle duplicate term IDs in request', async () => {
      const email = generateUniqueEmail('consent-duplicate');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'tos', agreed: true }, // Duplicate
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      // Should create records for all including duplicates
      // (business logic decision - may want to dedupe in future)
      await withMikroContext(services, async () => {
        const tosConsents = await services.mikro.userTermsConsent.find({
          user: { sub: userSub },
          terms: { id: 'tos' },
        });
        // 2 records for tos (duplicates allowed)
        expect(tosConsents.length).toBe(2);
      });
    });

    test('should handle config user consent', async () => {
      // Config users should also be able to consent
      const sessionCookie = await createAuthenticatedSession(app);
      const client = testClient(app);

      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      expect(body.ok).toBe(true);
    });
  });

  describe('Empty terms configuration', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should succeed with empty consents when no terms configured', async () => {
      const email = generateUniqueEmail('consent-empty-config');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      // With no required terms, any consent array should work
      // But we need at least 1 item due to validation
      const res = await client.api.terms.consent.$post(
        {
          json: {
            consents: [{ termsId: 'any', agreed: true }],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(res);
      // Unknown term ignored
      expect(body.recorded).toBe(0);
    });
  });

  describe('Integration with GET /api/terms', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        terms: [...TEST_TERMS_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should show consent in GET response after POST', async () => {
      const email = generateUniqueEmail('consent-integration');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );
      const client = testClient(app);

      // Initial state - no consent
      const beforeRes = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const beforeBody = await beforeRes.json();
      const tosBefore = beforeBody.terms.find(
        (t: { id: string }) => t.id === 'tos',
      );
      expect(tosBefore?.userConsent).toBeNull();

      // Record consent
      await client.api.terms.consent.$post(
        {
          json: {
            consents: [
              { termsId: 'tos', agreed: true },
              { termsId: 'privacy', agreed: true },
            ],
          },
        },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      // After state - consent recorded
      const afterRes = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const afterBody = await afterRes.json();
      const tosAfter = afterBody.terms.find(
        (t: { id: string }) => t.id === 'tos',
      );

      expect(tosAfter?.userConsent).not.toBeNull();
      expect(tosAfter?.userConsent?.agreed).toBe(true);
      expect(tosAfter?.userConsent?.agreedVersion).toBe('1.0.0');
      expect(tosAfter?.userConsent?.requiresUpdate).toBe(false);
    });
  });
});
