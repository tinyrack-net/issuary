import { createApp } from '#backend/app.js';
import {
  type AppConfigInput,
  resolveConfig,
} from '#backend/lib/config/index.js';

/**
 * Minimal test configuration.
 * Contains only the essential fields required for tests to run:
 * - cookie_secret: Required by the app
 * - database.type: 'memory' for in-memory testing
 * - smtp.test: true for test email accounts
 *
 * Tests should spread this and add only the specific config they need.
 *
 * @example
 * ```typescript
 * import { createTestApp, MINIMAL_TEST_CONFIG } from '#backend/test-utils/setup.js';
 * import type { AppType } from '#backend/app.js';
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
 *       // Only add config this test actually needs:
 *       auth: {
 *         password: {
 *           totp: { enabled: true },
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
    cookie_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    allowed_signup_emails: ['*'],
  },
  logging: {
    level: 'silent',
    format: 'json',
  },
  database: {
    type: 'sqlite',
    test: true,
  },
  security: {
    hash_master_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
    pbkdf2_iterations: 1000,
  },
  smtp: {
    test: true,
  },
} as const satisfies AppConfigInput;

export async function createTestApp(options?: {
  config?: AppConfigInput | undefined;
}) {
  const resolvedConfig = await resolveConfig(
    options?.config ?? MINIMAL_TEST_CONFIG,
  );
  return createApp({ config: resolvedConfig });
}
