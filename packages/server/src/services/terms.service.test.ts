import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createTestApp,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

const SERVICE_TEST_TERMS = [
  {
    id: 'tos',
    required: true,
    consent_mode: 'explicit' as const,
    version: '2.0.0',
    content: {
      en: {
        title: 'Terms of Service',
        type: 'link' as const,
        content: 'https://example.com/terms',
      },
    },
  },
  {
    id: 'privacy',
    required: true,
    consent_mode: 'implicit' as const,
    version: '1.1.0',
    content: {
      en: {
        title: 'Privacy Policy',
        type: 'link' as const,
        content: 'https://example.com/privacy',
      },
    },
  },
] as const;

describe('TermsService', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      terms: [...SERVICE_TEST_TERMS],
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('getGlobalTermsWithConsent falls back to English and marks outdated consents as pending', async () => {
    const userSub = await createTestUser(services);

    await withMikroContext(services, async () => {
      await services.mikro.userTermsConsent.recordConsent({
        userSub,
        termsId: 'tos',
        termsVersion: '1.0.0',
        agreed: true,
        consentType: 'explicit',
      });
    });

    const localizedTerms = await withMikroContext(services, async () =>
      services.termsService.getGlobalTermsWithConsent(userSub, 'fr'),
    );
    const tosTerm = localizedTerms.find((term) => term.id === 'tos');

    expect(tosTerm?.title).toBe('Terms of Service');
    expect(tosTerm?.userConsent?.agreedVersion).toBe('1.0.0');
    expect(tosTerm?.userConsent?.requiresUpdate).toBe(true);
    expect(
      services.termsService.getPendingFromLocalizedTerms(localizedTerms),
    ).toEqual(['tos', 'privacy']);
  });

  test('validateAndRecordConsents reports missing required explicit terms without persisting records', async () => {
    const userSub = await createTestUser(services);

    const result = await withMikroContext(services, async () =>
      services.termsService.validateAndRecordConsents({
        userSub,
        consents: [],
      }),
    );

    expect(result.validation).toEqual({
      valid: false,
      missingTerms: ['tos'],
    });
    expect(result.records).toEqual([]);

    await expect(
      withMikroContext(services, async () =>
        services.mikro.userTermsConsent.findAllConsents(userSub),
      ),
    ).resolves.toEqual([]);
  });

  test('validateAndRecordConsents records explicit and implicit consents in one pass', async () => {
    const userSub = await createTestUser(services);

    const result = await withMikroContext(services, async () =>
      services.termsService.validateAndRecordConsents({
        userSub,
        consents: [{ termsId: 'tos', agreed: true }],
      }),
    );

    expect(result.validation).toEqual({
      valid: true,
      missingTerms: [],
    });
    expect(result.records).toHaveLength(2);

    const tosConsent = result.records.find(
      (record) => record.termsId === 'tos',
    );
    const privacyConsent = result.records.find(
      (record) => record.termsId === 'privacy',
    );

    expect(tosConsent?.consentType).toBe('explicit');
    expect(tosConsent?.termsVersion).toBe('2.0.0');
    expect(privacyConsent?.agreed).toBe(true);
    expect(privacyConsent?.consentType).toBe('implicit');
    expect(privacyConsent?.termsVersion).toBe('1.1.0');
  });
  test('a rejected current-version required term remains pending in both representations', async () => {
    const userSub = await createTestUser(services);
    await withMikroContext(services, async () => {
      const terms = await services.termsService.getGlobalTerms();
      await services.termsService.recordConsents({
        userSub,
        terms,
        consents: terms.map((term) => ({ termsId: term.id, agreed: false })),
      });
      const pending =
        await services.termsService.getPendingRequiredTerms(userSub);
      expect(pending).toEqual(expect.arrayContaining(['tos', 'privacy']));
      const localized = await services.termsService.getGlobalTermsWithConsent(
        userSub,
        'en',
      );
      expect(
        services.termsService.getPendingFromLocalizedTerms(localized),
      ).toEqual(pending);
    });
  });
});
