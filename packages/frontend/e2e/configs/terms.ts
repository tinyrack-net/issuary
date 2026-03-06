import type { ResolvedAppConfig } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a terms e2e backend configuration.
 * - Email restricted to *@allowed.com (tests email pattern filtering)
 * - Explicit + implicit terms (tests consent UI)
 * - No SMTP, no 2FA (register goes directly to /profile)
 */
export function createTermsConfig(
  backendPort: number,
  _frontendPort: number,
): ResolvedAppConfig {
  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
      allowed_signup_emails: ['*@allowed.com'],
      signup_implicit_terms: {
        en: 'By signing up, you agree to receive marketing emails.',
      },
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
            content: 'Test Terms of Service content for e2e testing.',
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
            content: 'Test Privacy Policy content for e2e testing.',
          },
        },
      },
    ],
  };
}
