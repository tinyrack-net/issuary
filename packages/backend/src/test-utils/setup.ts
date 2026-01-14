import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import type { AppConfig, DeepPartial } from '@/lib/config/index.js';
import { createServer } from '@/server.js';

/**
 * Default test configuration.
 * This replaces config.test.yaml and is used as the base config for all tests.
 */
export const DEFAULT_TEST_CONFIG: AppConfig = {
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
    public_registration: true,
    supported_languages: ['ko', 'en', 'ja'],
    default_language: 'auto',
    fallback_language: 'ko',
    light_theme: 'light',
    dark_theme: 'dark',
    theme_mode: 'system',
  },
  admin: {
    enabled: true,
    port: 8081,
  },
  database: {
    type: 'memory',
  },
  smtp: {
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    user: 'test@ethereal.email',
    password: 'test',
    from: 'test@ethereal.email',
    test: true,
  },
  basic_authentication_methods: {
    password: {
      enabled: true,
      email_verification: true,
      totp: {
        enabled: false,
        required: false,
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
    retention_period: '30d',
  },
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
   * Custom config file path.
   * If provided, this takes precedence over baseConfig.
   */
  configPath?: string;
  /**
   * Base config to use instead of DEFAULT_TEST_CONFIG.
   * Useful for completely replacing the test config.
   */
  baseConfig?: AppConfig;
  /**
   * Partial config to override loaded values.
   * Useful for testing different configuration scenarios.
   *
   * @example
   * ```typescript
   * const app = setupTestServer({
   *   configOverrides: {
   *     app: {
   *       public_registration: false,
   *     },
   *   },
   * });
   * ```
   */
  configOverrides?: DeepPartial<AppConfig>;
}

/**
 * Setup and teardown Fastify server for tests.
 * Call this function in your test file to automatically set up and tear down the server.
 *
 * Uses DEFAULT_TEST_CONFIG as the base configuration by default.
 * You can override specific values using configOverrides.
 *
 * @param options - Optional configuration options for the test server
 *
 * @example
 * ```typescript
 * import { setupTestServer } from '@/test-utils/setup.js';
 *
 * // Basic usage (uses DEFAULT_TEST_CONFIG)
 * const app = setupTestServer();
 *
 * // With config overrides
 * const app = setupTestServer({
 *   configOverrides: {
 *     app: {
 *       public_registration: false,
 *     },
 *   },
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
    appInstance = await createServer({
      ...(options?.configPath && { configPath: options.configPath }),
      // Use provided baseConfig or default to DEFAULT_TEST_CONFIG
      baseConfig: options?.baseConfig ?? DEFAULT_TEST_CONFIG,
      ...(options?.configOverrides && {
        configOverrides: options.configOverrides,
      }),
    }).start();
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
