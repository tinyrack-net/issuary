import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Creates a terms config focused on complete-registration mode.
 */
export function createTermsCompleteRegistrationConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '30d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
      signup_implicit_terms: {
        en: 'By signing up, you agree to analytics collection.',
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
    terms: [
      {
        id: 'tos',
        required: true,
        consent_mode: 'explicit',
        version: '1.0.0',
        content: {
          en: {
            title: 'Terms of Service',
            type: 'text',
            content: 'Test Terms of Service content for complete registration.',
          },
        },
      },
      {
        id: 'privacy',
        required: false,
        consent_mode: 'explicit',
        version: '1.0.0',
        content: {
          en: {
            title: 'Privacy Policy',
            type: 'text',
            content: 'Test Privacy Policy content for complete registration.',
          },
        },
      },
    ],
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
