import type {
  TinyAuthRuntimeConfig,
  TinyAuthRuntimeConfigInput,
} from '@tinyauth/backend/config';
import { sqlite } from '@tinyauth/backend/database/sqlite';

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
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
} satisfies NonNullable<TinyAuthRuntimeConfigInput['clients']>[number];

type TestServerConfig = {
  public_origin?: string;
  listen_port?: number;
  trust_proxy?: boolean | string | string[] | number;
};

type TestI18nConfig = {
  supported_languages?: readonly string[];
  default_language?: string;
  fallback_language?: string;
};

type TestBrandingConfig = {
  light_theme?: string;
  dark_theme?: string;
  theme_mode?: string;
  background_url?: string;
  icon_url?: string;
  title?: Record<string, string>;
  subtitle?: Record<string, string>;
};

type TestRegistrationConfig = {
  enabled?: boolean;
  allowed_email_patterns?: readonly string[];
  email_verification_required?: boolean;
  signup_notice?: Record<string, string>;
};

type TestAccountDeletionConfig = {
  enabled?: boolean;
  retention?: string;
};

export type TestEmailConfig =
  | { test: true }
  | NonNullable<TinyAuthRuntimeConfig['email']>;

export type E2EConfigInput = {
  [key: string]: unknown;
  server?: TestServerConfig;
  i18n?: TestI18nConfig;
  branding?: TestBrandingConfig;
  registration?: TestRegistrationConfig;
  account_deletion?: TestAccountDeletionConfig;
  email?: TestEmailConfig;
  html_variables?: Record<string, string>;
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

type TestConfigInput = {
  [key: string]: unknown;
  server?: TestServerConfig;
  i18n?: TestI18nConfig;
  branding?: TestBrandingConfig;
  registration?: TestRegistrationConfig;
  account_deletion?: TestAccountDeletionConfig;
  email?: TestEmailConfig;
};

type TestConfigResult = {
  [key: string]: unknown;
  server: TestServerConfig;
  i18n?: TestI18nConfig;
  branding?: TestBrandingConfig;
  registration?: TestRegistrationConfig;
  account_deletion?: TestAccountDeletionConfig;
  email?: TestEmailConfig;
};

/**
 * Creates the minimum backend config every e2e server needs:
 * a concrete public origin and the worker-specific backend port.
 */
export function createTestConfig(
  backendPort: number,
  overrides: TestConfigInput = {},
) {
  const { server, ...restOverrides } = overrides;

  return {
    ...restOverrides,
    server: {
      public_origin: `http://localhost:${backendPort}`,
      listen_port: backendPort,
      ...(server ?? {}),
    },
  } satisfies TestConfigResult;
}
