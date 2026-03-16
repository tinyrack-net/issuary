import { createApp } from '#backend/entrypoints/app.js';
import { sqlite } from '#backend/entrypoints/database/sqlite/sqlite.js';
import type {
  EmailConfig,
  TinyAuthRuntimeConfigInput,
} from '#backend/lib/config/index.js';
import { TinyAuthRuntimeConfigSchema } from '#backend/lib/config/index.js';

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
 * import type { AppType } from '#backend/entrypoints/app.js';
 * import type { ServiceContainer } from '#backend/services/container.js';
 *
 * let app: AppType;
 * let services: ServiceContainer;
 * let cleanup: () => Promise<void>;
 *
 * beforeAll(async () => {
 *   ({ app, services, cleanup } = await createTestApp({
 *     ...MINIMAL_TEST_CONFIG,
 *     auth: {
 *       password: {
 *         totp: { enabled: true },
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
  database: sqlite({ path: './test.db', test: true }),
  logging: {
    level: 'silent',
  },
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
  },
} as const satisfies TinyAuthRuntimeConfigInput;

export interface TestEmailMessage {
  from?: string | undefined;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Create a deterministic in-memory email config for tests.
 * Call this in `beforeAll` for tests that need email functionality.
 */
export async function createTestEmailConfig(options?: {
  from?: string | undefined;
  sentMessages?: TestEmailMessage[] | undefined;
}): Promise<EmailConfig> {
  const sentMessages = options?.sentMessages;
  return {
    from: options?.from ?? 'no-reply@test.local',
    createTransport: async () => ({
      sendMail: async (message) => {
        if (sentMessages) {
          sentMessages.push(message);
        }
        return {
          accepted: [message.to],
          envelope: {
            from: message.from ?? options?.from ?? 'no-reply@test.local',
            to: [message.to],
          },
          messageId: `test-email-${String(sentMessages?.length ?? 0)}`,
        };
      },
    }),
  };
}

export async function createTestApp(config?: TinyAuthRuntimeConfigInput) {
  const resolvedConfig = TinyAuthRuntimeConfigSchema.parse(
    config ?? MINIMAL_TEST_CONFIG,
  );
  return createApp(resolvedConfig);
}
