import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Creates a system-theme and multi-language config for e2e tests.
 */
export function createThemeSystemMultilangConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '88d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      supported_languages: ['ko', 'en'],
      default_language: 'ko',
      fallback_language: 'en',
      light_theme: 'cupcake',
      dark_theme: 'forest',
      theme_mode: 'system',
      title: {
        en: 'Theme System Title',
      },
      subtitle: {
        en: 'Theme System Subtitle',
      },
      signup_implicit_terms: {
        en: 'Theme system <strong>implicit terms</strong> notice.',
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
