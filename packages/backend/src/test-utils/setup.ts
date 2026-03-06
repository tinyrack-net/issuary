import { type CreateAppOptions, createApp } from '#backend/entries/app.js';
import { sqlite } from '#backend/entries/database/sqlite.js';
import type { ResolvedAppConfig } from '#backend/lib/config/index.js';
import type { MailConfigRuntime } from '#backend/lib/config/schema.js';

/**
 * Minimal test configuration as a fully resolved config.
 * Contains all Zod defaults explicitly spelled out so that
 * no `resolveConfig` call is needed in tests.
 *
 * Tests should spread this and add only the specific config they need.
 *
 * @example
 * ```typescript
 * import { createTestApp, MINIMAL_TEST_CONFIG } from '#backend/test-utils/setup.js';
 * import type { AppType } from '#backend/entries/app.js';
 * import type { ServiceContainer } from '#backend/services/container.js';
 *
 * let app: AppType;
 * let services: ServiceContainer;
 * let cleanup: () => Promise<void>;
 *
 * beforeAll(async () => {
 *   ({ app, services, cleanup } = await createTestApp({
 *     config: {
 *       ...MINIMAL_TEST_CONFIG,
 *       auth: {
 *         ...MINIMAL_TEST_CONFIG.auth,
 *         password: {
 *           ...MINIMAL_TEST_CONFIG.auth.password,
 *           totp: { ...MINIMAL_TEST_CONFIG.auth.password.totp, enabled: true },
 *         },
 *       },
 *     },
 *   }));
 * });
 *
 * afterAll(async () => {
 *   await cleanup();
 * });
 * ```
 */
export const MINIMAL_TEST_CONFIG = {
  app: {
    host: 'http://localhost:8080',
    port: 8080,
    cookie_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    jwt_access_token_ttl: 3600,
    jwt_refresh_token_ttl: 2592000,
    jwt_key_rotation_enabled: true,
    jwt_key_rotation_days: 30,
    jwt_key_overlap_days: 7,
    allowed_signup_emails: ['*'],
    supported_languages: ['en', 'ko', 'ja'],
    default_language: 'auto',
    fallback_language: 'en',
    light_theme: 'light',
    dark_theme: 'dark',
    theme_mode: 'system',
    background_url:
      'https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&auto=format&fit=crop&q=80&w=2071',
    trust_proxy: false,
    signup_implicit_terms: {},
    title: {
      ko: 'Tinyauth',
      en: 'Tinyauth',
      ja: 'Tinyauth',
    },
    subtitle: {
      ko: '가볍고 빠른 인증 솔루션',
      en: 'Lightweight identity provider for your apps',
      ja: '軽量でシンプルな認証ソリューション',
    },
    account_deletion: false,
  },
  database: sqlite({ path: './test.db', test: true }),
  logging: {
    level: 'silent' as const,
    format: 'json' as const,
    http_log_proxy: false,
  },
  auth: {
    password: {
      enabled: true,
      email_verification: true,
      second_factor: {
        required: false,
      },
      totp: {
        enabled: false,
        issuer: 'Tinyrack',
      },
      policy: {
        min_length: 12,
        max_length: 256,
      },
    },
    passkey: {
      enabled: false,
      email_verification: true,
    },
  },
  security: {
    hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    pbkdf2_iterations: 1000,
  },
  cleanup: {
    revoked_tokens: {
      enabled: true,
      retention: '0',
    },
    oauth_codes: {
      enabled: true,
      consumed_retention: '24h',
    },
    email_verifications: {
      enabled: true,
      retention: '0',
    },
    password_resets: {
      enabled: true,
      retention: '0',
    },
    deleted_users: {
      enabled: true,
      retention: '30d',
    },
    pending_oauth_registrations: {
      enabled: true,
      retention: '0',
    },
    jwt_keys: {
      enabled: true,
    },
  },
  scheduler: {
    enabled: true,
    cron: '0 2 * * *',
  },
  terms: [],
  clients: [],
  users: [],
  identity_providers: [],
} as const satisfies ResolvedAppConfig;

/**
 * Create a resolved SMTP config using nodemailer's test account.
 * Call this in `beforeAll` for tests that need email functionality.
 */
export async function createTestMailConfig(): Promise<MailConfigRuntime> {
  const { default: nm } = await import('nodemailer');
  const { nodemailer } = await import('#backend/entries/mail/nodemailer.js');
  const testAccount = await nm.createTestAccount();
  return nodemailer({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    user: testAccount.user,
    password: testAccount.pass,
    from: testAccount.user,
    test: true,
  });
}

export async function createTestApp(options?: CreateAppOptions) {
  return createApp(options ?? { config: MINIMAL_TEST_CONFIG });
}
