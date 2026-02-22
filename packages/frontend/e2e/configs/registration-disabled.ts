import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Port configuration for the registration-disabled e2e test servers.
 */
export const E2E_REGISTRATION_DISABLED_PORTS = {
  backend: 18083,
  frontend: 19083,
} as const;

/**
 * Registration-disabled backend configuration for e2e tests.
 * allowed_signup_emails is empty, so public registration is blocked.
 */
export const E2E_REGISTRATION_DISABLED_CONFIG = {
  app: {
    host: `http://localhost:${E2E_REGISTRATION_DISABLED_PORTS.backend}`,
    port: E2E_REGISTRATION_DISABLED_PORTS.backend,
    cookie_secret:
      'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
    allowed_signup_emails: [],
    frontend: {
      enabled: true,
      mode: 'proxy',
      path: `http://localhost:${E2E_REGISTRATION_DISABLED_PORTS.frontend}`,
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
} as const satisfies AppConfigInput;
