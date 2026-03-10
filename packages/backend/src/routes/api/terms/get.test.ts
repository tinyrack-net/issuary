import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  createDbUserWithSession,
  createTestApp,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_TERMS_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

describe('GET /api/terms', () => {
  describe('Unauthenticated access', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        config: {
          ...MINIMAL_TEST_CONFIG,
          terms: [...TEST_TERMS_CONFIG],
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return terms list without authentication', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('terms');
      expect(body).toHaveProperty('pendingTerms');
      expect(Array.isArray(body.terms)).toBe(true);
      expect(Array.isArray(body.pendingTerms)).toBe(true);
      // Each term should have consentMode
      expect(body.terms[0]).toHaveProperty('consentMode');
    });

    test('should include all required terms in pendingTerms for unauthenticated user', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      const requiredTermIds = body.terms
        .filter((t: { required: boolean }) => t.required)
        .map((t: { id: string }) => t.id);

      // All required terms should be pending for unauthenticated users
      expect(body.pendingTerms).toEqual(
        expect.arrayContaining(requiredTermIds),
      );
      expect(body.pendingTerms.length).toBe(requiredTermIds.length);
    });

    test('should return null userConsent for unauthenticated user', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      for (const term of body.terms) {
        expect(term.userConsent).toBeNull();
      }
    });

    test('should return correct term structure', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.terms.length).toBeGreaterThan(0);

      const term = body.terms[0];
      expect(term).toHaveProperty('id');
      expect(term).toHaveProperty('required');
      expect(term).toHaveProperty('consentMode');
      expect(term).toHaveProperty('version');
      expect(term).toHaveProperty('title');
      expect(term).toHaveProperty('userConsent');
    });
  });

  describe('Language support', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        config: {
          ...MINIMAL_TEST_CONFIG,
          terms: [...TEST_TERMS_CONFIG],
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return Korean content with lang=ko', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({
        query: { lang: 'ko' },
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('이용약관');
    });

    test('should return English content with lang=en', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({
        query: { lang: 'en' },
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('Terms of Service');
    });

    test('should fallback to English for unsupported language', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({
        query: { lang: 'fr' },
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      // Should fallback to English when French is not available
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('Terms of Service');
    });

    test('should default to English when lang not provided', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('Terms of Service');
    });
  });

  describe('Authenticated access', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        config: {
          ...MINIMAL_TEST_CONFIG,
          terms: [...TEST_TERMS_CONFIG],
        },
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return empty pendingTerms after user consents', async () => {
      const email = generateUniqueEmail('terms-test');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );

      // Record consent for all required terms
      await withMikroContext(services, async () => {
        const terms = await services.termsService.getGlobalTerms();
        const requiredTerms = terms.filter((t) => t.required);

        await services.mikro.userTermsConsent.recordConsents(
          requiredTerms.map((term) => ({
            userSub,
            termsId: term.id,
            termsVersion: term.version,
            agreed: true,
            consentType: 'explicit' as const,
          })),
        );
      });

      const client = testClient(app);
      const res = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.pendingTerms).toEqual([]);
    });

    test('should return userConsent with consent details', async () => {
      const email = generateUniqueEmail('terms-consent');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );

      // Record consent
      await withMikroContext(services, async () => {
        await services.mikro.userTermsConsent.recordConsent({
          userSub,
          termsId: 'tos',
          termsVersion: '1.0.0',
          agreed: true,
          consentType: 'explicit',
        });
      });

      const client = testClient(app);
      const res = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      const body = await res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');

      expect(tosTerm?.userConsent).not.toBeNull();
      expect(tosTerm?.userConsent?.agreed).toBe(true);
      expect(tosTerm?.userConsent?.agreedVersion).toBe('1.0.0');
      expect(tosTerm?.userConsent?.consentType).toBe('explicit');
      expect(tosTerm?.userConsent?.requiresUpdate).toBe(false);
      expect(tosTerm?.userConsent?.agreedAt).toBeDefined();
    });

    test('should mark requiresUpdate when version changes', async () => {
      const email = generateUniqueEmail('terms-version');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );

      // Record consent to OLD version
      await withMikroContext(services, async () => {
        await services.mikro.userTermsConsent.recordConsent({
          userSub,
          termsId: 'tos',
          termsVersion: '0.9.0', // Old version
          agreed: true,
          consentType: 'explicit',
        });
      });

      const client = testClient(app);
      const res = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      const body = await res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');

      expect(tosTerm?.userConsent?.requiresUpdate).toBe(true);
      expect(tosTerm?.userConsent?.agreedVersion).toBe('0.9.0');
      // Should be in pending terms because version mismatch
      expect(body.pendingTerms).toContain('tos');
    });

    test('should include terms in pendingTerms when not yet consented', async () => {
      const email = generateUniqueEmail('terms-pending');
      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );

      const client = testClient(app);
      const res = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      const body = await res.json();
      // New user should have all required terms pending
      expect(body.pendingTerms.length).toBeGreaterThan(0);
      expect(body.pendingTerms).toContain('tos');
      expect(body.pendingTerms).toContain('privacy');
    });
  });

  describe('Consent mode', () => {
    describe('explicit mode (default)', () => {
      let app: AppType;
      let cleanup: () => Promise<void>;

      beforeAll(async () => {
        const server = await createTestApp({
          config: {
            ...MINIMAL_TEST_CONFIG,
            terms: [...TEST_TERMS_CONFIG],
          },
        });
        app = server.app;
        cleanup = server.cleanup;
      });

      afterAll(async () => {
        await cleanup();
      });

      test('should return explicit consent mode', async () => {
        const client = testClient(app);
        const res = await client.api.terms.$get({ query: {} });

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.terms[0]?.consentMode).toBe('explicit');
      });
    });

    describe('implicit mode', () => {
      let app: AppType;
      let cleanup: () => Promise<void>;

      beforeAll(async () => {
        const server = await createTestApp({
          config: {
            ...MINIMAL_TEST_CONFIG,
            app: {
              ...MINIMAL_TEST_CONFIG.app,
              signup_implicit_terms: {
                ko: '가입하시면 약관에 동의하는 것입니다.',
                en: 'By signing up you agree to our terms.',
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
        cleanup = server.cleanup;
      });

      afterAll(async () => {
        await cleanup();
      });

      test('should return implicit consent mode on term', async () => {
        const client = testClient(app);
        const res = await client.api.terms.$get({ query: {} });

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.terms[0]?.consentMode).toBe('implicit');
      });
    });
  });

  describe('Term flags', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        config: {
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
              id: 'privacy',
              required: true,
              consent_mode: 'explicit',
              version: '1.0.0',
              content: {
                en: {
                  title: 'Privacy',
                  type: 'link',
                  content: 'https://example.com/privacy',
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
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should correctly flag required vs optional terms', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      const marketingTerm = body.terms.find(
        (t: { id: string }) => t.id === 'marketing',
      );

      expect(tosTerm?.required).toBe(true);
      expect(marketingTerm?.required).toBe(false);
    });

    test('should correctly flag consentMode on terms', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      const marketingTerm = body.terms.find(
        (t: { id: string }) => t.id === 'marketing',
      );

      expect(marketingTerm?.consentMode).toBe('explicit');
    });

    test('should only include required terms in pendingTerms', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      // Marketing is optional, should not be in pending
      expect(body.pendingTerms).not.toContain('marketing');
      expect(body.pendingTerms).toContain('tos');
      expect(body.pendingTerms).toContain('privacy');
    });
  });

  describe('Term content', () => {
    let app: AppType;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        config: {
          ...MINIMAL_TEST_CONFIG,
          terms: [
            {
              id: 'with-link',
              required: true,
              consent_mode: 'explicit',
              version: '1.0.0',
              content: {
                en: {
                  title: 'Terms with Link',
                  type: 'link',
                  content: 'https://example.com/terms',
                },
              },
            },
            {
              id: 'with-text',
              required: true,
              consent_mode: 'explicit',
              version: '1.0.0',
              content: {
                en: {
                  title: 'Terms with Text',
                  type: 'text',
                  content: 'This is the full terms content inline.',
                },
              },
            },
          ],
        },
      });
      app = server.app;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return link type with URL content', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      const termWithLink = body.terms.find(
        (t: { id: string }) => t.id === 'with-link',
      );

      expect(termWithLink?.type).toBe('link');
      expect(termWithLink?.content).toBe('https://example.com/terms');
    });

    test('should return text type with text content', async () => {
      const client = testClient(app);
      const res = await client.api.terms.$get({ query: {} });

      expect(res.status).toBe(200);

      const body = await res.json();
      const termWithText = body.terms.find(
        (t: { id: string }) => t.id === 'with-text',
      );

      expect(termWithText?.type).toBe('text');
      expect(termWithText?.content).toBe(
        'This is the full terms content inline.',
      );
    });
  });

  describe('Edge cases', () => {
    describe('empty terms config', () => {
      let app: AppType;
      let cleanup: () => Promise<void>;

      beforeAll(async () => {
        const server = await createTestApp({
          config: {
            ...MINIMAL_TEST_CONFIG,
            terms: [],
          },
        });
        app = server.app;
        cleanup = server.cleanup;
      });

      afterAll(async () => {
        await cleanup();
      });

      test('should return empty terms array', async () => {
        const client = testClient(app);
        const res = await client.api.terms.$get({ query: {} });

        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.terms).toEqual([]);
        expect(body.pendingTerms).toEqual([]);
      });
    });

    describe('invalid session handling', () => {
      let app: AppType;
      let cleanup: () => Promise<void>;

      beforeAll(async () => {
        const server = await createTestApp({
          config: {
            ...MINIMAL_TEST_CONFIG,
            terms: [...TEST_TERMS_CONFIG],
          },
        });
        app = server.app;
        cleanup = server.cleanup;
      });

      afterAll(async () => {
        await cleanup();
      });

      test('should handle invalid session gracefully', async () => {
        const client = testClient(app);
        const res = await client.api.terms.$get(
          { query: {} },
          { headers: { Cookie: 'session=invalid-session-token' } },
        );

        // Should not throw, should treat as unauthenticated
        expect(res.status).toBe(200);

        const body = await res.json();
        for (const term of body.terms) {
          expect(term.userConsent).toBeNull();
        }
      });
    });
  });

  describe('Multiple consents history', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        config: {
          ...MINIMAL_TEST_CONFIG,
          terms: [...TEST_TERMS_CONFIG],
        },
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return latest consent when multiple exist', async () => {
      const email = generateUniqueEmail('terms-multi');
      const { sessionCookie, userSub } = await createDbUserWithSession(
        app,
        services,
        email,
        'password123!',
      );

      // Record multiple consents (simulating version upgrades)
      await withMikroContext(services, async () => {
        // Old consent
        await services.mikro.userTermsConsent.recordConsent({
          userSub,
          termsId: 'tos',
          termsVersion: '0.9.0',
          agreed: true,
          consentType: 'implicit',
        });

        // New consent
        await services.mikro.userTermsConsent.recordConsent({
          userSub,
          termsId: 'tos',
          termsVersion: '1.0.0',
          agreed: true,
          consentType: 'explicit',
        });
      });

      const client = testClient(app);
      const res = await client.api.terms.$get(
        { query: {} },
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      expect(res.status).toBe(200);

      const body = await res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');

      // Should return the latest consent
      expect(tosTerm?.userConsent?.agreedVersion).toBe('1.0.0');
      expect(tosTerm?.userConsent?.consentType).toBe('explicit');
      expect(tosTerm?.userConsent?.requiresUpdate).toBe(false);
    });
  });
});
