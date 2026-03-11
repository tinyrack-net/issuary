import { describe, expect, test } from 'vitest';
import { sqlite } from '#backend/entrypoints/database/sqlite.js';
import { ACCOUNT_DELETION_CONFIG_DEFAULT } from './account-deletion.js';
import { AUTH_CONFIG_DEFAULT } from './auth.js';
import { BRANDING_CONFIG_DEFAULT } from './branding.js';
import { CLEANUP_CONFIG_DEFAULT } from './cleanup.js';
import { CLIENT_CONFIGS_DEFAULT } from './client.js';
import { I18N_CONFIG_DEFAULT } from './i18n.js';
import { IDENTITY_PROVIDER_CONFIGS_DEFAULT } from './identity-providers.js';
import { LOGGING_CONFIG_DEFAULT } from './logging.js';
import { REGISTRATION_CONFIG_DEFAULT } from './registration.js';
import {
  type TinyAuthRuntimeConfigInput,
  TinyAuthRuntimeConfigSchema,
} from './resolved.js';
import { SCHEDULER_CONFIG_DEFAULT } from './scheduler.js';
import { SECURITY_CONFIG_DEFAULT } from './security.js';
import { SERVER_CONFIG_DEFAULT } from './server.js';
import { TERMS_CONFIG_DEFAULT } from './terms.js';
import { TOKENS_CONFIG_DEFAULT } from './tokens.js';
import { USER_CONFIGS_DEFAULT } from './user.js';

const MINIMAL_INPUT_CONFIG = {
  database: sqlite({ path: './test.db', test: true }),
  security: {
    session_secret:
      '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
    hash_secret: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
  },
} satisfies TinyAuthRuntimeConfigInput;

describe('TinyAuthRuntimeConfigSchema', () => {
  test('parses the minimal unresolved config and applies omitted defaults', () => {
    const parsed = TinyAuthRuntimeConfigSchema.parse(MINIMAL_INPUT_CONFIG);

    expect(parsed.database).toBe(MINIMAL_INPUT_CONFIG.database);
    expect(parsed.server).toEqual(SERVER_CONFIG_DEFAULT);
    expect(parsed.tokens).toEqual(TOKENS_CONFIG_DEFAULT);
    expect(parsed.i18n).toEqual(I18N_CONFIG_DEFAULT);
    expect(parsed.branding).toEqual(BRANDING_CONFIG_DEFAULT);
    expect(parsed.registration).toEqual(REGISTRATION_CONFIG_DEFAULT);
    expect(parsed.account_deletion).toEqual(ACCOUNT_DELETION_CONFIG_DEFAULT);
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
    expect(parsed.email).toBeUndefined();
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
      account_deletion: {
        retention: '7d',
      },
      server: {
        public_origin: 'http://example.com',
      },
      branding: {
        title: {
          en: 'Custom',
        },
      },
    } satisfies TinyAuthRuntimeConfigInput;

    const parsed = TinyAuthRuntimeConfigSchema.parse(partialInput);

    expect(parsed.auth.password).toEqual({
      ...AUTH_CONFIG_DEFAULT.password,
      totp: {
        ...AUTH_CONFIG_DEFAULT.password.totp,
        enabled: true,
      },
    });
    expect(parsed.auth.passkey).toEqual(AUTH_CONFIG_DEFAULT.passkey);

    expect(parsed.account_deletion).toEqual({
      ...ACCOUNT_DELETION_CONFIG_DEFAULT,
      retention: '7d',
    });
    expect(parsed.cleanup.revoked_tokens).toEqual(
      CLEANUP_CONFIG_DEFAULT.revoked_tokens,
    );

    expect(parsed.server.public_origin).toBe('http://example.com');
    expect(parsed.server.listen_port).toBe(SERVER_CONFIG_DEFAULT.listen_port);
    expect(parsed.branding.title).toEqual({
      en: 'Custom',
    });
    expect(parsed.branding.subtitle).toEqual(BRANDING_CONFIG_DEFAULT.subtitle);
    expect(parsed.registration.allowed_email_patterns).toEqual(
      REGISTRATION_CONFIG_DEFAULT.allowed_email_patterns,
    );
  });
});
