import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Creates a UI-focused backend configuration for e2e tests.
 * Custom branding, single-language mode, and fixed theme mode.
 */
export function createUiBrandingLocaleThemeConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
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
    logging: {
      level: 'silent',
      format: 'json',
    },
    database: {
      type: 'memory',
    },
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
