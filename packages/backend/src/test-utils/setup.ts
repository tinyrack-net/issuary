import type { AppConfigInput } from '@/lib/config/schemas/root.js';

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
 * import { createServer } from '@/server.js';
 * import { MINIMAL_TEST_CONFIG } from '@/test-utils/setup.js';
 *
 * let app: FastifyInstance;
 *
 * beforeAll(async () => {
 *   app = await createServer({
 *     config: {
 *       ...MINIMAL_TEST_CONFIG,
 *       // Only add config this test actually needs:
 *       auth: {
 *         password: {
 *           totp: { enabled: true },
 *         },
 *       },
 *     },
 *   });
 * });
 *
 * afterAll(async () => {
 *   await app.close();
 * });
 * ```
 */
export const MINIMAL_TEST_CONFIG = {
  app: {
    cookie_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    allowed_signup_emails: ['*'],
  },
  database: {
    type: 'memory',
  },
  smtp: {
    test: true,
  },
} as const satisfies AppConfigInput;
