import type { StandaloneConfigInput } from '@tinyauth/standalone/config';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_SECURITY_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a UI-focused backend configuration for e2e tests.
 * Custom branding, single-language mode, and fixed theme mode.
 */
export function createUiBrandingLocaleThemeConfig(
  backendPort: number,
  frontendPort: number,
): StandaloneConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '66d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
      light_theme: 'light',
      dark_theme: 'dark',
      theme_mode: 'light',
      background_url: 'https://example.com/e2e-background.jpg',
      icon_url: 'https://example.com/e2e-icon.svg',
      title: {
        en: 'E2E Brand Title',
      },
      subtitle: {
        en: 'E2E Brand Subtitle',
      },
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
    security: E2E_TEST_SECURITY_CONFIG,
    logging: {
      level: 'silent',
      format: 'json',
    },
    database: {
      type: 'sqlite',
      test: true,
    },
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
