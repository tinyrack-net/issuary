import { envDefault } from './env-default.ts';

/**
 * Defaults template for standalone configuration.
 *
 * Every scalar field gets a `${ISSUARY_*:-fallback}` pattern that is resolved
 * by `resolveEnvVariables()` before Zod parsing.  Required fields (secrets)
 * use `${ISSUARY_*}` without a fallback so they resolve to an empty string
 * and fail validation unless the user sets the env var.
 *
 * Complex/structured fields (arrays, localized records) are excluded — they
 * must come from the YAML config file.
 *
 */
export const STANDALONE_CONFIG_DEFAULTS = {
  server: {
    public_origin: envDefault('ISSUARY_PUBLIC_ORIGIN', 'http://localhost:8080'),
    listen_port: envDefault('ISSUARY_LISTEN_PORT', '8080'),
    trust_proxy: envDefault('ISSUARY_TRUST_PROXY', 'false'),
  },

  tokens: {
    access_token_ttl: envDefault('ISSUARY_ACCESS_TOKEN_TTL', '3600'),
    refresh_token_ttl: envDefault('ISSUARY_REFRESH_TOKEN_TTL', '2592000'),
    key_rotation: {
      enabled: envDefault('ISSUARY_JWT_KEY_ROTATION_ENABLED', 'true'),
      interval_days: envDefault('ISSUARY_JWT_KEY_ROTATION_DAYS', '30'),
      overlap_days: envDefault('ISSUARY_JWT_KEY_OVERLAP_DAYS', '7'),
    },
  },

  security: {
    session_secret: envDefault('ISSUARY_SESSION_SECRET'),
    hash_secret: envDefault('ISSUARY_HASH_SECRET'),
    pbkdf2_iterations: envDefault('ISSUARY_PBKDF2_ITERATIONS', '600000'),
  },

  database: {
    type: envDefault('ISSUARY_DATABASE_TYPE', 'sqlite'),
    path: envDefault('ISSUARY_DATABASE_PATH', '/opt/issuary/database.db'),
    test: envDefault('ISSUARY_DATABASE_TEST', 'false'),
    debug: envDefault('ISSUARY_DATABASE_DEBUG', 'false'),
  },

  logging: {
    level: envDefault('ISSUARY_LOG_LEVEL', 'info'),
    format: envDefault('ISSUARY_LOG_FORMAT', 'pretty'),
  },

  auth: {
    password: {
      enabled: envDefault('ISSUARY_PASSWORD_ENABLED', 'true'),
      two_factor: {
        enrollment_required: envDefault(
          'ISSUARY_PASSWORD_2FA_ENROLLMENT_REQUIRED',
          'false',
        ),
      },
      totp: {
        enabled: envDefault('ISSUARY_PASSWORD_TOTP_ENABLED', 'false'),
        issuer: envDefault('ISSUARY_PASSWORD_TOTP_ISSUER', 'Issuary'),
      },
      policy: {
        min_length: envDefault('ISSUARY_PASSWORD_MIN_LENGTH', '8'),
        max_length: envDefault('ISSUARY_PASSWORD_MAX_LENGTH', '128'),
      },
    },
    passkey: {
      enabled: envDefault('ISSUARY_PASSKEY_ENABLED', 'false'),
    },
  },

  admin: {
    enabled: envDefault('ISSUARY_ADMIN_ENABLED', 'false'),
  },

  registration: {
    enabled: envDefault('ISSUARY_REGISTRATION_ENABLED', 'false'),
  },

  account_deletion: {
    enabled: envDefault('ISSUARY_ACCOUNT_DELETION_ENABLED', 'false'),
    retention: envDefault('ISSUARY_ACCOUNT_DELETION_RETENTION', '30d'),
  },

  openapi: {
    enabled: envDefault('ISSUARY_OPENAPI_ENABLED', 'true'),
  },

  scheduler: {
    enabled: envDefault('ISSUARY_SCHEDULER_ENABLED', 'true'),
    mode: envDefault('ISSUARY_SCHEDULER_MODE', 'croner'),
    cleanup_cron: envDefault('ISSUARY_SCHEDULER_CLEANUP_CRON', '0 2 * * *'),
    poll_interval_ms: envDefault('ISSUARY_SCHEDULER_POLL_INTERVAL_MS', '5000'),
    lock_ttl_ms: envDefault('ISSUARY_SCHEDULER_LOCK_TTL_MS', '60000'),
    background_retry_delay_ms: envDefault(
      'ISSUARY_SCHEDULER_BACKGROUND_RETRY_DELAY_MS',
      '1000',
    ),
    background_max_attempts: envDefault(
      'ISSUARY_SCHEDULER_BACKGROUND_MAX_ATTEMPTS',
      '3',
    ),
    background_retention_ms: envDefault(
      'ISSUARY_SCHEDULER_BACKGROUND_RETENTION_MS',
      String(7 * 24 * 60 * 60 * 1000),
    ),
    instance_id: envDefault('ISSUARY_SCHEDULER_INSTANCE_ID', ''),
  },

  cleanup: {
    revoked_tokens: {
      enabled: envDefault('ISSUARY_CLEANUP_REVOKED_TOKENS_ENABLED', 'true'),
      retention: envDefault('ISSUARY_CLEANUP_REVOKED_TOKENS_RETENTION', '0'),
    },
    oauth_codes: {
      enabled: envDefault('ISSUARY_CLEANUP_OAUTH_CODES_ENABLED', 'true'),
      consumed_retention: envDefault(
        'ISSUARY_CLEANUP_OAUTH_CODES_RETENTION',
        '24h',
      ),
    },
    email_verifications: {
      enabled: envDefault(
        'ISSUARY_CLEANUP_EMAIL_VERIFICATIONS_ENABLED',
        'true',
      ),
      retention: envDefault(
        'ISSUARY_CLEANUP_EMAIL_VERIFICATIONS_RETENTION',
        '0',
      ),
    },
    password_resets: {
      enabled: envDefault('ISSUARY_CLEANUP_PASSWORD_RESETS_ENABLED', 'true'),
      retention: envDefault('ISSUARY_CLEANUP_PASSWORD_RESETS_RETENTION', '0'),
    },
    pending_oauth_registrations: {
      enabled: envDefault(
        'ISSUARY_CLEANUP_PENDING_OAUTH_REGISTRATIONS_ENABLED',
        'true',
      ),
      retention: envDefault(
        'ISSUARY_CLEANUP_PENDING_OAUTH_REGISTRATIONS_RETENTION',
        '0',
      ),
    },
  },
};
