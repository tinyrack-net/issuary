import { describe, expect, test } from 'vitest';
import type { AppConfigs } from './config.js';
import { appConfigQueryOptions } from './config.js';

const baseConfig = {
  i18n: {
    supported_languages: ['en', 'ko'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    light_theme: 'light',
    dark_theme: 'dark',
    theme_mode: 'system',
    background_url: 'https://example.com/background.png',
    icon_url: 'https://example.com/icon.png',
    title: {
      en: 'TinyAuth',
    },
    subtitle: {
      en: 'Sign in',
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
