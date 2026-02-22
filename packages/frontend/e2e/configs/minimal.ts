import type { AppConfigInput } from '@tinyauth/backend/app';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '../fixtures/index.js';

/**
 * Port configuration for the minimal e2e test servers.
 */
export const E2E_MINIMAL_PORTS = {
  backend: 18080,
  frontend: 19080,
} as const;

/**
 * Minimal backend configuration for e2e tests.
 * Standard password auth, no 2FA, in-memory database.
 */
export const E2E_MINIMAL_CONFIG = {
  app: {
    host: `http://localhost:${E2E_MINIMAL_PORTS.backend}`,
    port: E2E_MINIMAL_PORTS.backend,
    cookie_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    allowed_signup_emails: ['*'],
    frontend: {
      enabled: true,
      mode: 'proxy',
      path: `http://localhost:${E2E_MINIMAL_PORTS.frontend}`,
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
