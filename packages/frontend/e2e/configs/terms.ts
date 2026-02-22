import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Port configuration for the terms e2e test servers.
 */
export const E2E_TERMS_PORTS = {
  backend: 18084,
  frontend: 19084,
} as const;

/**
 * Terms e2e backend configuration.
 * - Email restricted to *@allowed.com (tests email pattern filtering)
 * - Explicit + implicit terms (tests consent UI)
 * - No SMTP, no 2FA (register goes directly to /profile)
 */
export const E2E_TERMS_CONFIG = {
  app: {
    host: `http://localhost:${E2E_TERMS_PORTS.backend}`,
    port: E2E_TERMS_PORTS.backend,
    cookie_secret:
      'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
    allowed_signup_emails: ['*@allowed.com'],
    signup_implicit_terms: {
      en: 'By signing up, you agree to receive marketing emails.',
    },
    frontend: {
      enabled: true,
      mode: 'proxy',
      path: `http://localhost:${E2E_TERMS_PORTS.frontend}`,
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
  users: [E2E_TEST_USER_CONFIG],
  clients: [E2E_TEST_CLIENT_CONFIG],
} as const satisfies AppConfigInput;
