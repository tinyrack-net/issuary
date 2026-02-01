import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import type { ExternalAppConfig } from '@/lib/config/index.js';
import { createServer } from '@/server.js';

/**
 * Default test configuration.
 * This replaces config.test.yaml and is used as the base config for all tests.
 * Uses ExternalAppConfig format - will be resolved to InternalAppConfig by createServer.
 */
export const DEFAULT_TEST_CONFIG: ExternalAppConfig = {
  app: {
    name: 'Tinyrack Auth',
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
    supported_languages: ['ko', 'en', 'ja'],
    default_language: 'auto',
    fallback_language: 'ko',
    light_theme: 'light',
    dark_theme: 'dark',
    theme_mode: 'system',
    trust_proxy: false,
    signup_implicit_terms: {
      ko: '가입 시 약관에 동의하는 것으로 간주됩니다.',
      en: 'By signing up, you agree to our Terms.',
    },
  },
  admin: {
    enabled: true,
    port: 8081,
  },
  database: {
    type: 'memory',
  },
  smtp: {
    test: true,
  },
  basic_authentication_methods: {
    password: {
      enabled: true,
      email_verification: true,
      second_factor: {
        required: false,
      },
      totp: {
        enabled: false,
      },
    },
    passkey: {
      enabled: false,
      email_verification: true,
    },
  },
  oauth_authentication_methods: [
    {
      id: 'google',
      type: 'google',
      enabled: true,
      display_name: 'Google',
      client_id: 'test-google-client-id',
      client_secret: 'test-google-client-secret',
      email_conflict_strategy: 'auto_link',
    },
    {
      id: 'github',
      type: 'github',
      enabled: false,
      display_name: 'GitHub',
      client_id: 'test-github-client-id',
      client_secret: 'test-github-client-secret',
      email_conflict_strategy: 'auto_link',
    },
  ],
  account_deletion: {
    enabled: false,
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
    jwt_keys: {
      enabled: true,
    },
  },
  terms: [
    {
      id: 'tos',
      required: true,
      consent_mode: 'explicit',
      version: '1.0.0',
      content: {
        ko: {
          title: '이용약관',
          type: 'link',
          content: 'https://example.com/terms/ko',
        },
        en: {
          title: 'Terms of Service',
          type: 'link',
          content: 'https://example.com/terms/en',
        },
      },
    },
    {
      id: 'privacy',
      required: true,
      consent_mode: 'explicit',
      version: '1.0.0',
      content: {
        ko: {
          title: '개인정보처리방침',
          type: 'link',
          content: 'https://example.com/privacy/ko',
        },
        en: {
          title: 'Privacy Policy',
          type: 'link',
          content: 'https://example.com/privacy/en',
        },
      },
    },
  ],
  providers: [
    {
      id: 'test-config-oauth-client',
      name: 'My App',
      logo_uri: 'https://myapp.com/auth/callback',
      client_id: 'sdlk3n3dkj2',
      client_secret: 'sdlk3n3dkj2',
      redirect_uris: ['http://localhost:8080/callback'],
      response_types: ['code'],
      grant_types: ['authorization_code'],
      scope: 'openid profile email id_token',
    },
  ],
  users: [
    {
      id: 'test-config-user',
      email: 'test-config-user@example.com',
      password: 'changemelater',
      role: 'admin',
    },
  ],
};

/**
 * Global app instance for tests
 */
let appInstance: FastifyInstance | null = null;

/**
 * Options for setting up test server.
 */
export interface SetupTestServerOptions {
  /**
   * Full config to use instead of DEFAULT_TEST_CONFIG.
   * The caller is responsible for merging configs if needed.
   * Use `deepMerge` from `@/lib/config/index.js` to merge configs.
   *
   * @example
   * ```typescript
   * import { deepMerge } from '@/lib/config/index.js';
   * import { DEFAULT_TEST_CONFIG } from '@/test-utils/setup.js';
   *
   * const app = setupTestServer({
   *   config: deepMerge(DEFAULT_TEST_CONFIG, {
   *     app: {
   *       allowed_signup_emails: [],
   *     },
   *   }),
   * });
   * ```
   */
  config?: ExternalAppConfig;
}

/**
 * Setup and teardown Fastify server for tests.
 * Call this function in your test file to automatically set up and tear down the server.
 *
 * Uses DEFAULT_TEST_CONFIG as the configuration by default.
 * To customize config, use `deepMerge` to merge your overrides before passing.
 *
 * @param options - Optional configuration options for the test server
 *
 * @example
 * ```typescript
 * import { deepMerge } from '@/lib/config/index.js';
 * import { setupTestServer, DEFAULT_TEST_CONFIG } from '@/test-utils/setup.js';
 *
 * // Basic usage (uses DEFAULT_TEST_CONFIG)
 * const app = setupTestServer();
 *
 * // With custom config
 * const app = setupTestServer({
 *   config: deepMerge(DEFAULT_TEST_CONFIG, {
 *     app: {
 *       allowed_signup_emails: [],
 *     },
 *   }),
 * });
 *
 * describe('My Tests', () => {
 *   test('should work', async () => {
 *     const res = await app.inject({ method: 'GET', url: '/' });
 *     expect(res.statusCode).toBe(200);
 *   });
 * });
 * ```
 */
export function setupTestServer(
  options?: SetupTestServerOptions,
): FastifyInstance {
  beforeAll(async () => {
    const config = options?.config ?? DEFAULT_TEST_CONFIG;
    appInstance = await createServer({ config });
  });

  afterAll(async () => {
    if (appInstance) {
      await appInstance.close();
      appInstance = null;
    }
  });

  // Return a proxy that throws if accessed before initialization
  return new Proxy({} as FastifyInstance, {
    get(_target, prop) {
      if (!appInstance) {
        throw new Error(
          'Test server not initialized. Make sure tests run within beforeAll/afterAll hooks.',
        );
      }
      return appInstance[prop as keyof FastifyInstance];
    },
  });
}
