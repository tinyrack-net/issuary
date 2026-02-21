import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Test user credentials for e2e tests.
 */
export const E2E_TEST_USER = {
  email: 'e2e-test-user@example.com',
  password: 'changemelater',
} as const;

/**
 * Config-based test user definition.
 */
export const E2E_TEST_USER_CONFIG = {
  sub: 'e2e-test-user',
  email: E2E_TEST_USER.email,
  password: E2E_TEST_USER.password,
  role: 'admin',
} as const;

/**
 * Test OAuth client credentials for e2e tests.
 */
export const E2E_TEST_CLIENT = {
  clientId: 'e2e-test-client-id',
  clientSecret: 'e2e-test-client-secret',
  redirectUri: 'http://localhost:18080/callback',
} as const;

/**
 * Config-based test OAuth client definition.
 */
export const E2E_TEST_CLIENT_CONFIG = {
  id: 'e2e-test-oauth-client',
  name: 'E2E Test App',
  client_id: E2E_TEST_CLIENT.clientId,
  client_secret: E2E_TEST_CLIENT.clientSecret,
  redirect_uris: [E2E_TEST_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
} as const;

/**
 * Port configuration for e2e test servers.
 */
export const E2E_PORTS = {
  backend: 18080,
  vite: 19080,
} as const;

/**
 * Minimal backend configuration for e2e tests.
 * Uses in-memory SQLite, silent logging, and proxy mode
 * to forward frontend requests to the Vite dev server.
 */
export const E2E_BACKEND_CONFIG = {
  app: {
    host: `http://localhost:${E2E_PORTS.backend}`,
    port: E2E_PORTS.backend,
    cookie_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    allowed_signup_emails: ['*'],
    frontend: {
      enabled: true,
      mode: 'proxy',
      path: `http://localhost:${E2E_PORTS.vite}`,
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
