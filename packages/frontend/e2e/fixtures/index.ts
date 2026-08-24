import type {
  IssuaryRuntimeConfig,
  IssuaryRuntimeConfigInput,
} from '@tinyrack/issuary-server/config';
import { sqlite } from '@tinyrack/issuary-server/database/sqlite';

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
 * Config-based OAuth client definition for tests that exercise
 * authorization, consent, or token exchange flows.
 */
export const E2E_TEST_CLIENT_CONFIG = {
  id: 'e2e-test-oauth-client',
  name: 'E2E Test App',
  client_id: E2E_TEST_CLIENT.clientId,
  client_secret: E2E_TEST_CLIENT.clientSecret,
  redirect_uris: [E2E_TEST_CLIENT.redirectUri],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  scope: 'openid profile email offline_access',
} satisfies NonNullable<IssuaryRuntimeConfigInput['clients']>[number];

export type TestEmailConfig =
  | { test: true }
  | NonNullable<IssuaryRuntimeConfig['email']>;

export type E2EConfigInput = Omit<IssuaryRuntimeConfigInput, 'email'> & {
  email?: TestEmailConfig;
};

export const E2E_BASE_CONFIG: Omit<E2EConfigInput, 'server' | 'email'> = {
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    pbkdf2_iterations: 1000,
  },
  logging: { level: 'silent' },
  database: sqlite({ path: './test.db', test: true }),
};

/**
 * Creates the minimum backend config every e2e server needs:
 * a concrete public origin and the worker-specific backend port.
 */
export function createTestConfig(
  backendPort: number,
  overrides: Partial<E2EConfigInput> = {},
) {
  const { server, ...restOverrides } = overrides;

  return {
    ...restOverrides,
    server: {
      public_origin: `http://localhost:${backendPort}`,
      listen_port: backendPort,
      ...(server ?? {}),
    },
  };
}
