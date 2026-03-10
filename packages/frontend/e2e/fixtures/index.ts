import type { TinyAuthConfigs } from '@tinyauth/backend/config';
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
};

export const E2E_TEST_SECURITY_CONFIG = {
  hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
  pbkdf2_iterations: 1000,
} as const;

export const E2E_BASE_APP_CONFIG = {
  jwt_access_token_ttl: 3600,
  jwt_refresh_token_ttl: 2592000,
  jwt_key_rotation_enabled: true,
  jwt_key_rotation_days: 30,
  jwt_key_overlap_days: 7,
  supported_languages: ['ko', 'en', 'ja'] as ('ko' | 'en' | 'ja')[],
  default_language: 'auto' as 'auto' | 'ko' | 'en' | 'ja',
  fallback_language: 'ko' as 'ko' | 'en' | 'ja',
  light_theme: 'light' as const,
  dark_theme: 'dark' as const,
  theme_mode: 'system' as const,
  background_url:
    'https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=2071',
  trust_proxy: false as const,
  signup_implicit_terms: {} as Record<string, string>,
  title: { ko: 'Tinyauth', en: 'Tinyauth', ja: 'Tinyauth' },
  subtitle: {
    ko: '가볍고 빠른 인증 솔루션',
    en: 'Lightweight identity provider for your apps',
    ja: '軽量でシンプルな認証ソリューション',
  },
  account_deletion: false,
} satisfies Partial<TinyAuthConfigs['app']>;

export const E2E_BASE_AUTH_CONFIG: TinyAuthConfigs['auth'] = {
  password: {
    enabled: true,
    email_verification: true,
    second_factor: { required: false },
    totp: { enabled: false, issuer: 'Tinyrack' },
    policy: { min_length: 8, max_length: 100 },
  },
  passkey: { enabled: false, email_verification: true },
};

export const E2E_BASE_CONFIG: Omit<TinyAuthConfigs, 'app'> = {
  security: E2E_TEST_SECURITY_CONFIG,
  logging: { level: 'silent', format: 'json' },
  database: sqlite({ path: './test.db', test: true }),
  auth: E2E_BASE_AUTH_CONFIG,
  cleanup: {
    revoked_tokens: { enabled: true, retention: '0' },
    oauth_codes: { enabled: true, consumed_retention: '24h' },
    email_verifications: { enabled: true, retention: '0' },
    password_resets: { enabled: true, retention: '0' },
    deleted_users: { enabled: true, retention: '30d' },
    pending_oauth_registrations: { enabled: true, retention: '0' },
    jwt_keys: { enabled: true },
  },
  scheduler: { enabled: true, cron: '0 2 * * *' },
  terms: [],
  clients: [E2E_TEST_CLIENT_CONFIG],
  users: [E2E_TEST_USER_CONFIG],
  identity_providers: [],
};
