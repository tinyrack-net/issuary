import { describe, expect, test } from 'vitest';
import { sqlite } from '#backend/entrypoints/database/sqlite.js';
import { APP_CONFIG_DEFAULT } from './app.js';
import { AUTH_CONFIG_DEFAULT } from './auth.js';
import { CLEANUP_CONFIG_DEFAULT } from './cleanup.js';
import { CLIENT_CONFIGS_DEFAULT } from './client.js';
import { IDENTITY_PROVIDER_CONFIGS_DEFAULT } from './identity-providers.js';
import { LOGGING_CONFIG_DEFAULT } from './logging.js';
import {
  TinyAuthConfigsSchema,
  type TinyAuthInputConfigs,
} from './resolved.js';
import { SCHEDULER_CONFIG_DEFAULT } from './scheduler.js';
import { SECURITY_CONFIG_DEFAULT } from './security.js';
import { TERMS_CONFIG_DEFAULT } from './terms.js';
import { USER_CONFIGS_DEFAULT } from './user.js';

const MINIMAL_INPUT_CONFIG = {
  database: sqlite({ path: './test.db', test: true }),
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
  },
} satisfies TinyAuthInputConfigs;

describe('TinyAuthConfigsSchema', () => {
  test('parses the minimal unresolved config and applies omitted defaults', () => {
    const parsed = TinyAuthConfigsSchema.parse(MINIMAL_INPUT_CONFIG);

    expect(parsed.database).toBe(MINIMAL_INPUT_CONFIG.database);
    expect(parsed.app).toEqual(APP_CONFIG_DEFAULT);
    expect(parsed.logging).toEqual(LOGGING_CONFIG_DEFAULT);
    expect(parsed.auth).toEqual(AUTH_CONFIG_DEFAULT);
    expect(parsed.security).toEqual({
      ...MINIMAL_INPUT_CONFIG.security,
      pbkdf2_iterations: SECURITY_CONFIG_DEFAULT.pbkdf2_iterations,
    });
    expect(parsed.cleanup).toEqual(CLEANUP_CONFIG_DEFAULT);
    expect(parsed.scheduler).toEqual(SCHEDULER_CONFIG_DEFAULT);
    expect(parsed.terms).toEqual(TERMS_CONFIG_DEFAULT);
    expect(parsed.clients).toEqual(CLIENT_CONFIGS_DEFAULT);
    expect(parsed.users).toEqual(USER_CONFIGS_DEFAULT);
    expect(parsed.identity_providers).toEqual(
      IDENTITY_PROVIDER_CONFIGS_DEFAULT,
    );
    expect(parsed.mail).toBeUndefined();
    expect(parsed.frontend).toBeUndefined();
  });

  test('applies nested defaults when only part of a subtree is provided', () => {
    const partialInput = {
      ...MINIMAL_INPUT_CONFIG,
      auth: {
        password: {
          totp: {
            enabled: true,
          },
        },
      },
      cleanup: {
        deleted_users: {
          retention: '7d',
        },
      },
      app: {
        host: 'http://example.com',
        title: {
          en: 'Custom',
        },
      },
    } satisfies TinyAuthInputConfigs;

    const parsed = TinyAuthConfigsSchema.parse(partialInput);

    expect(parsed.auth.password).toEqual({
      ...AUTH_CONFIG_DEFAULT.password,
      totp: {
        ...AUTH_CONFIG_DEFAULT.password.totp,
        enabled: true,
      },
    });
    expect(parsed.auth.passkey).toEqual(AUTH_CONFIG_DEFAULT.passkey);

    expect(parsed.cleanup.deleted_users).toEqual({
      ...CLEANUP_CONFIG_DEFAULT.deleted_users,
      retention: '7d',
    });
    expect(parsed.cleanup.revoked_tokens).toEqual(
      CLEANUP_CONFIG_DEFAULT.revoked_tokens,
    );
    expect(parsed.cleanup.jwt_keys).toEqual(CLEANUP_CONFIG_DEFAULT.jwt_keys);

    expect(parsed.app.host).toBe('http://example.com');
    expect(parsed.app.port).toBe(APP_CONFIG_DEFAULT.port);
    expect(parsed.app.title).toEqual({
      en: 'Custom',
    });
    expect(parsed.app.subtitle).toEqual(APP_CONFIG_DEFAULT.subtitle);
    expect(parsed.app.allowed_signup_emails).toEqual(
      APP_CONFIG_DEFAULT.allowed_signup_emails,
    );
  });
});
