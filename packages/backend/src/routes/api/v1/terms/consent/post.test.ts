import { describe, expect, test } from 'vitest';
import type { InternalAppConfig } from '@/lib/config/index.js';
import { e } from '@/schemas/error.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  expectError,
  generateUniqueEmail,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

describe('POST /api/v1/terms/consent', () => {
  describe('Authentication', () => {
    const app = setupTestServer();

    test('should return 401 when not authenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        payload: {
          consents: [{ termsId: 'tos', agreed: true }],
        },
      });

      expect(res.statusCode).toBe(401);
      expectError(res, e.Unauthorized);
    });

    test('should return 401 with invalid session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: 'invalid-session' },
        payload: {
          consents: [{ termsId: 'tos', agreed: true }],
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Validation', () => {
    const app = setupTestServer();

    test('should return 400 when consents array is empty', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('should return 400 when consents is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    test('should return 400 when termsId is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [{ agreed: true }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('should return 400 when agreed is missing', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [{ termsId: 'tos' }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('should return 400 when agreed is not boolean', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [{ termsId: 'tos', agreed: 'yes' }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('should return 400 when required term is not agreed', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: false }, // Required term not agreed
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      // ValidationError uses createErrorWithData, so the custom message is in 'data'
      expect(body.data).toMatch(/tos/i);
    });

    test('should return 400 when required term is missing from consents', async () => {
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            // Missing 'privacy' which is also required
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      // ValidationError uses createErrorWithData, so the custom message is in 'data'
      expect(body.data).toMatch(/privacy/i);
    });
  });

  describe('Successful consent recording', () => {
    const app = setupTestServer();

    test('should record consent and return success', async () => {
      const email = generateUniqueEmail('consent-success');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.recorded).toBe(2);
    });

    test('should store consent in database', async () => {
      const email = generateUniqueEmail('consent-db');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      // Verify in database
      await withMikroContext(app, async () => {
        const consents =
          await app.mikro.userTermsConsent.findAllConsents(userId);

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
        email,
        'password123!',
      );

      // Check pending before consent
      const beforeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });
      expect(beforeRes.json().pendingTerms.length).toBeGreaterThan(0);

      // Give consent
      await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      // Check pending after consent
      const afterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });
      expect(afterRes.json().pendingTerms).toEqual([]);
    });
  });

  describe('Optional terms', () => {
    const app = setupTestServer({
      configOverrides: {
        terms: {
          global: [
            {
              id: 'tos',
              required: true,
              consent_mode: 'explicit',
              version: '1.0.0',
              content: {
                en: { title: 'Terms', url: 'https://example.com/terms' },
              },
            },
            {
              id: 'marketing',
              required: false,
              consent_mode: 'explicit',
              version: '1.0.0',
              content: {
                en: { title: 'Marketing', body: 'Receive marketing emails' },
              },
            },
          ],
        },
      } as Partial<InternalAppConfig>,
    });

    test('should allow not agreeing to optional terms', async () => {
      const email = generateUniqueEmail('consent-optional');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'marketing', agreed: false }, // Optional, can decline
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recorded).toBe(2);
    });

    test('should record declined optional terms', async () => {
      const email = generateUniqueEmail('consent-decline');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'marketing', agreed: false },
          ],
        },
      });

      await withMikroContext(app, async () => {
        const consent = await app.mikro.userTermsConsent.findLatestConsent(
          userId,
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
        email,
        'password123!',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            // marketing term omitted - should be OK
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recorded).toBe(1);
    });
  });

  describe('Unknown terms handling', () => {
    const app = setupTestServer();

    test('should ignore unknown term IDs', async () => {
      const email = generateUniqueEmail('consent-unknown');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
            { termsId: 'nonexistent-term', agreed: true }, // Unknown
          ],
        },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      // Only 2 valid terms recorded
      expect(body.recorded).toBe(2);

      // Verify unknown term was not stored
      await withMikroContext(app, async () => {
        const consent = await app.mikro.userTermsConsent.findLatestConsent(
          userId,
          'nonexistent-term',
        );
        expect(consent).toBeNull();
      });
    });
  });

  describe('Version tracking', () => {
    const app = setupTestServer();

    test('should record the current term version', async () => {
      const email = generateUniqueEmail('consent-version');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      await withMikroContext(app, async () => {
        const consent = await app.mikro.userTermsConsent.findLatestConsent(
          userId,
          'tos',
        );

        expect(consent?.termsVersion).toBe('1.0.0');
      });
    });
  });

  describe('Re-consent after version update', () => {
    const app = setupTestServer();

    test('should create new consent record for new version', async () => {
      const email = generateUniqueEmail('consent-reconsent');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Record old version consent directly in DB
      await withMikroContext(app, async () => {
        await app.mikro.userTermsConsent.recordConsent({
          userId,
          termsId: 'tos',
          termsVersion: '0.9.0', // Old version
          agreed: true,
          consentType: 'explicit',
        });
      });

      // Record new consent
      await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      // Verify we have 2 consent records for 'tos'
      await withMikroContext(app, async () => {
        const consents = await app.mikro.userTermsConsent.find(
          { user: { id: userId }, terms: { id: 'tos' } },
          { orderBy: { agreedAt: 'DESC' } },
        );

        expect(consents.length).toBe(2);
        expect(consents[0]?.termsVersion).toBe('1.0.0'); // Latest
        expect(consents[1]?.termsVersion).toBe('0.9.0'); // Old
      });
    });

    test('should update pending terms after re-consent', async () => {
      const email = generateUniqueEmail('consent-pending-update');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Record old version consent
      await withMikroContext(app, async () => {
        await app.mikro.userTermsConsent.recordConsents([
          {
            userId,
            termsId: 'tos',
            termsVersion: '0.9.0',
            agreed: true,
            consentType: 'explicit',
          },
          {
            userId,
            termsId: 'privacy',
            termsVersion: '1.0.0', // Already current
            agreed: true,
            consentType: 'explicit',
          },
        ]);
      });

      // Check pending - should include 'tos' (version mismatch)
      const beforeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });
      expect(beforeRes.json().pendingTerms).toContain('tos');
      expect(beforeRes.json().pendingTerms).not.toContain('privacy');

      // Re-consent to tos
      await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      // Check pending - should be empty
      const afterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });
      expect(afterRes.json().pendingTerms).toEqual([]);
    });
  });

  describe('Consent mode affects consentType field', () => {
    describe('explicit consent_mode term', () => {
      const app = setupTestServer({
        configOverrides: {
          terms: {
            global: [
              {
                id: 'tos',
                required: true,
                consent_mode: 'explicit',
                version: '1.0.0',
                content: {
                  en: { title: 'Terms', url: 'https://example.com/terms' },
                },
              },
            ],
          },
        } as Partial<InternalAppConfig>,
      });

      test('should record consentType as explicit', async () => {
        const email = generateUniqueEmail('consent-explicit');
        const { sessionCookie, userId } = await createDbUserWithSession(
          app,
          email,
          'password123!',
        );

        await app.inject({
          method: 'POST',
          url: '/api/v1/terms/consent',
          cookies: { session: sessionCookie },
          payload: {
            consents: [{ termsId: 'tos', agreed: true }],
          },
        });

        await withMikroContext(app, async () => {
          const consent = await app.mikro.userTermsConsent.findLatestConsent(
            userId,
            'tos',
          );
          expect(consent?.consentType).toBe('explicit');
        });
      });
    });

    describe('implicit consent_mode term', () => {
      const app = setupTestServer({
        configOverrides: {
          terms: {
            global: [
              {
                id: 'tos',
                required: true,
                consent_mode: 'implicit',
                version: '1.0.0',
                content: {
                  en: { title: 'Terms', url: 'https://example.com/terms' },
                },
              },
            ],
          },
        } as Partial<InternalAppConfig>,
      });

      test('should record consentType as implicit', async () => {
        const email = generateUniqueEmail('consent-implicit');
        const { sessionCookie, userId } = await createDbUserWithSession(
          app,
          email,
          'password123!',
        );

        await app.inject({
          method: 'POST',
          url: '/api/v1/terms/consent',
          cookies: { session: sessionCookie },
          payload: {
            consents: [{ termsId: 'tos', agreed: true }],
          },
        });

        await withMikroContext(app, async () => {
          const consent = await app.mikro.userTermsConsent.findLatestConsent(
            userId,
            'tos',
          );
          expect(consent?.consentType).toBe('implicit');
        });
      });
    });
  });

  describe('Concurrent consent submissions', () => {
    const app = setupTestServer();

    test('should handle multiple rapid consent submissions', async () => {
      const email = generateUniqueEmail('consent-concurrent');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Submit consent multiple times rapidly
      const requests = Array(5)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/terms/consent',
            cookies: { session: sessionCookie },
            payload: {
              consents: [
                { termsId: 'tos', agreed: true },
                { termsId: 'privacy', agreed: true },
              ],
            },
          }),
        );

      const responses = await Promise.all(requests);

      // All should succeed
      for (const res of responses) {
        expect(res.statusCode).toBe(200);
      }

      // Verify multiple records exist
      await withMikroContext(app, async () => {
        const consents =
          await app.mikro.userTermsConsent.findAllConsents(userId);

        // Each submission creates 2 records (tos + privacy)
        expect(consents.length).toBe(10);
      });
    });
  });

  describe('Edge cases', () => {
    const app = setupTestServer();

    test('should handle very long user agent', async () => {
      const email = generateUniqueEmail('consent-long-ua');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      const longUserAgent = 'A'.repeat(512);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        headers: {
          'user-agent': longUserAgent,
        },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
    });

    test('should handle duplicate term IDs in request', async () => {
      const email = generateUniqueEmail('consent-duplicate');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'tos', agreed: true }, // Duplicate
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      expect(res.statusCode).toBe(200);

      // Should create records for all including duplicates
      // (business logic decision - may want to dedupe in future)
      await withMikroContext(app, async () => {
        const tosConsents = await app.mikro.userTermsConsent.find({
          user: { id: userId },
          terms: { id: 'tos' },
        });
        // 2 records for tos (duplicates allowed)
        expect(tosConsents.length).toBe(2);
      });
    });

    test('should handle config user consent', async () => {
      // Config users should also be able to consent
      const sessionCookie = await createAuthenticatedSession(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);
    });
  });

  describe('Empty terms configuration', () => {
    const app = setupTestServer({
      configOverrides: {
        terms: {
          consent_mode: 'explicit',
          global: [],
        },
      } as Partial<InternalAppConfig>,
    });

    test('should succeed with empty consents when no terms configured', async () => {
      const email = generateUniqueEmail('consent-empty-config');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // With no required terms, any consent array should work
      // But we need at least 1 item due to validation
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [{ termsId: 'any', agreed: true }],
        },
      });

      expect(res.statusCode).toBe(200);
      // Unknown term ignored
      expect(res.json().recorded).toBe(0);
    });
  });

  describe('Integration with GET /api/v1/terms', () => {
    const app = setupTestServer();

    test('should show consent in GET response after POST', async () => {
      const email = generateUniqueEmail('consent-integration');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Initial state - no consent
      const beforeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });

      const beforeBody = beforeRes.json();
      const tosBefore = beforeBody.terms.find(
        (t: { id: string }) => t.id === 'tos',
      );
      expect(tosBefore?.userConsent).toBeNull();

      // Record consent
      await app.inject({
        method: 'POST',
        url: '/api/v1/terms/consent',
        cookies: { session: sessionCookie },
        payload: {
          consents: [
            { termsId: 'tos', agreed: true },
            { termsId: 'privacy', agreed: true },
          ],
        },
      });

      // After state - consent recorded
      const afterRes = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });

      const afterBody = afterRes.json();
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
