import { afterEach, describe, expect, test } from 'vitest';
import {
  mockJsonSuccess,
  queryFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import type { AppConfigs } from './config.ts';
import { appConfigQueryOptions } from './config.ts';

const baseConfig = {
  i18n: {
    supported_languages: ['en', 'ko'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    icon_url: 'https://example.com/icon.png',
    title: {
      en: 'Issuary',
    },
    subtitle: {
      en: 'Nice to meet you!',
    },
    login_method_description: {
      en: "Choose how you'd like to sign in.",
    },
  },
  registration: {
    public_registration: true,
    email_pattern_filter_enabled: false,
    email_verification_required: true,
    signup_notice: {},
  },
  database: {
    enabled: true,
  },
  email: {
    enabled: true,
  },
  admin: {
    enabled: true,
  },
  auth: {
    password: {
      enabled: true,
      two_factor: {
        enrollment_required: false,
      },
      totp: {
        enabled: true,
        issuer: '',
      },
      policy: {
        min_length: 8,
        max_length: 64,
      },
    },
    passkey: {
      enabled: true,
    },
  },
  identity_providers: [],
  account_deletion: {
    enabled: true,
    retention: 'P30D',
  },
} satisfies AppConfigs;

describe('appConfigQueryOptions.select', () => {
  test('exposes both available 2FA setup methods when TOTP and passkeys are enabled', () => {
    if (!appConfigQueryOptions.select) {
      throw new Error('Expected appConfigQueryOptions.select to be defined');
    }

    const config = appConfigQueryOptions.select(baseConfig);

    expect(config.available_2fa_setup_methods).toEqual(['totp', 'passkey']);
  });

  test('omits disabled 2FA methods from the derived list', () => {
    if (!appConfigQueryOptions.select) {
      throw new Error('Expected appConfigQueryOptions.select to be defined');
    }

    const config = appConfigQueryOptions.select({
      ...baseConfig,
      auth: {
        ...baseConfig.auth,
        password: {
          ...baseConfig.auth.password,
          totp: {
            ...baseConfig.auth.password.totp,
            enabled: false,
          },
        },
        passkey: {
          enabled: false,
        },
      },
    });

    expect(config.available_2fa_setup_methods).toEqual([]);
  });
});

describe('appConfigQueryOptions.queryFn', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('loads app config from the expected API endpoint', async () => {
    const fetchMock = mockJsonSuccess(baseConfig);

    if (typeof appConfigQueryOptions.queryFn !== 'function') {
      throw new Error('Expected appConfigQueryOptions.queryFn to be defined');
    }

    await expect(
      appConfigQueryOptions.queryFn(
        queryFunctionContext(appConfigQueryOptions.queryKey),
      ),
    ).resolves.toEqual(baseConfig);
    expect(fetchMock.requests).toHaveLength(1);
    expect(fetchMock.requests[0]?.url).toBe('/api/config');
    expect(fetchMock.requests[0]?.method).toBe('GET');
  });
});
