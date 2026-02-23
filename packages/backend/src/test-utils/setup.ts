import type { AppConfigInput } from '@backend/lib/config/index.js';

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
 * import { createServer } from '@backend/server.js';
 * import { MINIMAL_TEST_CONFIG } from '@backend/test-utils/setup.js';
 * import type { AppType } from '@backend/app.js';
 * import type { ServiceContainer } from '@backend/services/container.js';
 *
 * let app: AppType;
 * let services: ServiceContainer;
 * let cleanup: () => Promise<void>;
 *
 * beforeAll(async () => {
 *   ({ app, services, cleanup } = await createServer({
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
    frontend: {
      enabled: false,
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
} as const satisfies AppConfigInput;
