import { describe, expect, test } from 'vitest';
import type { InternalAppConfig } from '@/lib/config/index.js';
import {
  createDbUserWithSession,
  generateUniqueEmail,
  setupTestServer,
  withMikroContext,
} from '@/test-utils/index.js';

describe('GET /api/v1/terms', () => {
  describe('Unauthenticated access', () => {
    const app = setupTestServer();

    test('should return terms list without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body).toHaveProperty('consentMode', 'explicit');
      expect(body).toHaveProperty('terms');
      expect(body).toHaveProperty('pendingTerms');
      expect(Array.isArray(body.terms)).toBe(true);
      expect(Array.isArray(body.pendingTerms)).toBe(true);
    });

    test('should include all required terms in pendingTerms for unauthenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
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
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      for (const term of body.terms) {
        expect(term.userConsent).toBeNull();
      }
    });

    test('should return correct term structure', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.terms.length).toBeGreaterThan(0);

      const term = body.terms[0];
      expect(term).toHaveProperty('id');
      expect(term).toHaveProperty('required');
      expect(term).toHaveProperty('alwaysExplicit');
      expect(term).toHaveProperty('version');
      expect(term).toHaveProperty('title');
      expect(term).toHaveProperty('userConsent');
    });
  });

  describe('Language support', () => {
    const app = setupTestServer();

    test('should return Korean content with lang=ko', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms?lang=ko',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('이용약관');
    });

    test('should return English content with lang=en', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms?lang=en',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('Terms of Service');
    });

    test('should fallback to English for unsupported language', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms?lang=fr',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      // Should fallback to English when French is not available
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('Terms of Service');
    });

    test('should return localized implicit notice', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms?lang=ko',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.implicitNotice).toBe(
        '가입 시 약관에 동의하는 것으로 간주됩니다.',
      );
    });

    test('should default to English when lang not provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      expect(tosTerm?.title).toBe('Terms of Service');
    });
  });

  describe('Authenticated access', () => {
    const app = setupTestServer();

    test('should return empty pendingTerms after user consents', async () => {
      const email = generateUniqueEmail('terms-test');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Record consent for all required terms
      await withMikroContext(app, async () => {
        const terms = await app.termsService.getGlobalTerms();
        const requiredTerms = terms.filter((t) => t.required);

        await app.mikro.userTermsConsent.recordConsents(
          requiredTerms.map((term) => ({
            userId,
            termsId: term.id,
            termsVersion: term.version,
            agreed: true,
            consentType: 'explicit' as const,
          })),
        );
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.pendingTerms).toEqual([]);
    });

    test('should return userConsent with consent details', async () => {
      const email = generateUniqueEmail('terms-consent');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Record consent
      await withMikroContext(app, async () => {
        await app.mikro.userTermsConsent.recordConsent({
          userId,
          termsId: 'tos',
          termsVersion: '1.0.0',
          agreed: true,
          consentType: 'explicit',
        });
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
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
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Record consent to OLD version
      await withMikroContext(app, async () => {
        await app.mikro.userTermsConsent.recordConsent({
          userId,
          termsId: 'tos',
          termsVersion: '0.9.0', // Old version
          agreed: true,
          consentType: 'explicit',
        });
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
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
        email,
        'password123!',
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      // New user should have all required terms pending
      expect(body.pendingTerms.length).toBeGreaterThan(0);
      expect(body.pendingTerms).toContain('tos');
      expect(body.pendingTerms).toContain('privacy');
    });
  });

  describe('Consent mode', () => {
    describe('explicit mode (default)', () => {
      const app = setupTestServer();

      test('should return explicit consent mode', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/terms',
        });

        expect(res.statusCode).toBe(200);

        const body = res.json();
        expect(body.consentMode).toBe('explicit');
      });
    });

    describe('implicit mode', () => {
      const app = setupTestServer({
        configOverrides: {
          terms: {
            consent_mode: 'implicit',
            implicit_notice: {
              ko: '가입하시면 약관에 동의하는 것입니다.',
              en: 'By signing up you agree to our terms.',
            },
            global: [
              {
                id: 'tos',
                required: true,
                always_explicit: false,
                version: '1.0.0',
                content: {
                  en: { title: 'Terms', url: 'https://example.com/terms' },
                },
              },
            ],
          },
        } as Partial<InternalAppConfig>,
      });

      test('should return implicit consent mode', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/terms',
        });

        expect(res.statusCode).toBe(200);

        const body = res.json();
        expect(body.consentMode).toBe('implicit');
      });

      test('should return implicit notice text', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/terms?lang=en',
        });

        expect(res.statusCode).toBe(200);

        const body = res.json();
        expect(body.implicitNotice).toBe(
          'By signing up you agree to our terms.',
        );
      });
    });
  });

  describe('Term flags', () => {
    const app = setupTestServer({
      configOverrides: {
        terms: {
          consent_mode: 'explicit',
          global: [
            {
              id: 'tos',
              required: true,
              always_explicit: false,
              version: '1.0.0',
              content: {
                en: { title: 'Terms', url: 'https://example.com/terms' },
              },
            },
            {
              id: 'privacy',
              required: true,
              always_explicit: false,
              version: '1.0.0',
              content: {
                en: { title: 'Privacy', url: 'https://example.com/privacy' },
              },
            },
            {
              id: 'marketing',
              required: false,
              always_explicit: true,
              version: '1.0.0',
              content: {
                en: { title: 'Marketing', body: 'Receive marketing emails' },
              },
            },
          ],
        },
      } as Partial<InternalAppConfig>,
    });

    test('should correctly flag required vs optional terms', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');
      const marketingTerm = body.terms.find(
        (t: { id: string }) => t.id === 'marketing',
      );

      expect(tosTerm?.required).toBe(true);
      expect(marketingTerm?.required).toBe(false);
    });

    test('should correctly flag alwaysExplicit terms', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const marketingTerm = body.terms.find(
        (t: { id: string }) => t.id === 'marketing',
      );

      expect(marketingTerm?.alwaysExplicit).toBe(true);
    });

    test('should only include required terms in pendingTerms', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      // Marketing is optional, should not be in pending
      expect(body.pendingTerms).not.toContain('marketing');
      expect(body.pendingTerms).toContain('tos');
      expect(body.pendingTerms).toContain('privacy');
    });
  });

  describe('Term content', () => {
    const app = setupTestServer({
      configOverrides: {
        terms: {
          consent_mode: 'explicit',
          global: [
            {
              id: 'with-url',
              required: true,
              always_explicit: false,
              version: '1.0.0',
              content: {
                en: {
                  title: 'Terms with URL',
                  url: 'https://example.com/terms',
                },
              },
            },
            {
              id: 'with-body',
              required: true,
              always_explicit: false,
              version: '1.0.0',
              content: {
                en: {
                  title: 'Terms with Body',
                  body: 'This is the full terms content inline.',
                },
              },
            },
          ],
        },
      } as Partial<InternalAppConfig>,
    });

    test('should return URL when provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const termWithUrl = body.terms.find(
        (t: { id: string }) => t.id === 'with-url',
      );

      expect(termWithUrl?.url).toBe('https://example.com/terms');
    });

    test('should return body when provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const termWithBody = body.terms.find(
        (t: { id: string }) => t.id === 'with-body',
      );

      expect(termWithBody?.body).toBe('This is the full terms content inline.');
    });
  });

  describe('Edge cases', () => {
    describe('empty terms config', () => {
      const app = setupTestServer({
        configOverrides: {
          terms: {
            consent_mode: 'explicit',
            global: [],
          },
        } as Partial<InternalAppConfig>,
      });

      test('should return empty terms array', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/terms',
        });

        expect(res.statusCode).toBe(200);

        const body = res.json();
        expect(body.terms).toEqual([]);
        expect(body.pendingTerms).toEqual([]);
      });
    });

    describe('invalid session handling', () => {
      const app = setupTestServer();

      test('should handle invalid session gracefully', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/v1/terms',
          cookies: { session: 'invalid-session-token' },
        });

        // Should not throw, should treat as unauthenticated
        expect(res.statusCode).toBe(200);

        const body = res.json();
        for (const term of body.terms) {
          expect(term.userConsent).toBeNull();
        }
      });
    });
  });

  describe('Multiple consents history', () => {
    const app = setupTestServer();

    test('should return latest consent when multiple exist', async () => {
      const email = generateUniqueEmail('terms-multi');
      const { sessionCookie, userId } = await createDbUserWithSession(
        app,
        email,
        'password123!',
      );

      // Record multiple consents (simulating version upgrades)
      await withMikroContext(app, async () => {
        // Old consent
        await app.mikro.userTermsConsent.recordConsent({
          userId,
          termsId: 'tos',
          termsVersion: '0.9.0',
          agreed: true,
          consentType: 'implicit',
        });

        // New consent
        await app.mikro.userTermsConsent.recordConsent({
          userId,
          termsId: 'tos',
          termsVersion: '1.0.0',
          agreed: true,
          consentType: 'explicit',
        });
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/terms',
        cookies: { session: sessionCookie },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      const tosTerm = body.terms.find((t: { id: string }) => t.id === 'tos');

      // Should return the latest consent
      expect(tosTerm?.userConsent?.agreedVersion).toBe('1.0.0');
      expect(tosTerm?.userConsent?.consentType).toBe('explicit');
      expect(tosTerm?.userConsent?.requiresUpdate).toBe(false);
    });
  });
});
