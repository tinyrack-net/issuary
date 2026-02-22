import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Port configuration for the email-verification e2e test servers.
 */
export const E2E_EMAIL_VERIFICATION_PORTS = {
  backend: 18082,
  frontend: 19082,
} as const;

/**
 * Email-verification backend configuration for e2e tests.
 * SMTP enabled so DB users require email verification.
 * No 2FA required — isolates email verification testing.
 */
export const E2E_EMAIL_VERIFICATION_CONFIG = {
  app: {
    host: `http://localhost:${E2E_EMAIL_VERIFICATION_PORTS.backend}`,
    port: E2E_EMAIL_VERIFICATION_PORTS.backend,
    cookie_secret:
      'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    allowed_signup_emails: ['*'],
    frontend: {
      enabled: true,
      mode: 'proxy',
      path: `http://localhost:${E2E_EMAIL_VERIFICATION_PORTS.frontend}`,
    },
  },
  logging: {
    level: 'silent',
    format: 'json',
  },
  database: {
    type: 'memory',
  },
  smtp: {
    test: true,
  },
  users: [E2E_TEST_USER_CONFIG],
  clients: [E2E_TEST_CLIENT_CONFIG],
} as const satisfies AppConfigInput;
