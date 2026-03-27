import { envDefault } from './env-default.ts';

/**
 * Defaults template for standalone configuration.
 *
 * Every scalar field gets a `${TINYAUTH_*:-fallback}` pattern that is resolved
 * by `resolveEnvVariables()` before Zod parsing.  Required fields (secrets)
 * use `${TINYAUTH_*}` without a fallback so they resolve to an empty string
 * and fail validation unless the user sets the env var.
 *
 * Complex/structured fields (arrays, localized records) are excluded — they
 * must come from the YAML config file.
 *
 * Resolution-time defaults (FRONTEND_PROXY_UPSTREAM, FRONTEND_STATIC_PATH)
 * are not part of the YAML template but are referenced at config-resolution
 * time.  They are stripped before the YAML pipeline runs.
 */
export const STANDALONE_CONFIG_DEFAULTS = {
  FRONTEND_PROXY_UPSTREAM: 'http://localhost:8081',
  FRONTEND_STATIC_PATH: '/opt/tinyauth/frontend',
  server: {
    public_origin: envDefault(
      'TINYAUTH_PUBLIC_ORIGIN',
      'http://localhost:8080',
    ),
    listen_port: envDefault('TINYAUTH_LISTEN_PORT', '8080'),
    trust_proxy: envDefault('TINYAUTH_TRUST_PROXY', 'false'),
  },

  tokens: {
    access_token_ttl: envDefault('TINYAUTH_ACCESS_TOKEN_TTL', '3600'),
    refresh_token_ttl: envDefault('TINYAUTH_REFRESH_TOKEN_TTL', '2592000'),
    key_rotation: {
      enabled: envDefault('TINYAUTH_JWT_KEY_ROTATION_ENABLED', 'true'),
      interval_days: envDefault('TINYAUTH_JWT_KEY_ROTATION_DAYS', '30'),
      overlap_days: envDefault('TINYAUTH_JWT_KEY_OVERLAP_DAYS', '7'),
    },
  },

  security: {
    session_secret: envDefault('TINYAUTH_SESSION_SECRET'),
    hash_secret: envDefault('TINYAUTH_HASH_SECRET'),
    pbkdf2_iterations: envDefault('TINYAUTH_PBKDF2_ITERATIONS', '600000'),
  },

  database: {
    type: envDefault('TINYAUTH_DATABASE_TYPE', 'sqlite'),
    path: envDefault('TINYAUTH_DATABASE_PATH', '/opt/tinyauth/database.db'),
    test: envDefault('TINYAUTH_DATABASE_TEST', 'false'),
  },

  logging: {
    level: envDefault('TINYAUTH_LOG_LEVEL', 'info'),
    format: envDefault('TINYAUTH_LOG_FORMAT', 'pretty'),
  },

  auth: {
    password: {
      enabled: envDefault('TINYAUTH_PASSWORD_ENABLED', 'true'),
      two_factor: {
        enrollment_required: envDefault(
          'TINYAUTH_PASSWORD_2FA_ENROLLMENT_REQUIRED',
          'false',
        ),
      },
      totp: {
        enabled: envDefault('TINYAUTH_PASSWORD_TOTP_ENABLED', 'false'),
        issuer: envDefault('TINYAUTH_PASSWORD_TOTP_ISSUER', 'TinyAuth'),
      },
      policy: {
        min_length: envDefault('TINYAUTH_PASSWORD_MIN_LENGTH', '8'),
        max_length: envDefault('TINYAUTH_PASSWORD_MAX_LENGTH', '128'),
      },
    },
    passkey: {
      enabled: envDefault('TINYAUTH_PASSKEY_ENABLED', 'false'),
    },
  },

  frontend: {
    enabled: envDefault('TINYAUTH_FRONTEND_ENABLED', 'true'),
    mode: envDefault('TINYAUTH_FRONTEND_MODE', 'static'),
    html_variables: {},
  },

  registration: {
    enabled: envDefault('TINYAUTH_REGISTRATION_ENABLED', 'false'),
  },

  account_deletion: {
    enabled: envDefault('TINYAUTH_ACCOUNT_DELETION_ENABLED', 'false'),
    retention: envDefault('TINYAUTH_ACCOUNT_DELETION_RETENTION', '30d'),
  },

  openapi: {
    enabled: envDefault('TINYAUTH_OPENAPI_ENABLED', 'true'),
  },

  scheduler: {
    enabled: envDefault('TINYAUTH_SCHEDULER_ENABLED', 'true'),
    cron: envDefault('TINYAUTH_SCHEDULER_CRON', '0 2 * * *'),
  },

  cleanup: {
    revoked_tokens: {
      enabled: envDefault('TINYAUTH_CLEANUP_REVOKED_TOKENS_ENABLED', 'true'),
      retention: envDefault('TINYAUTH_CLEANUP_REVOKED_TOKENS_RETENTION', '0'),
    },
    oauth_codes: {
      enabled: envDefault('TINYAUTH_CLEANUP_OAUTH_CODES_ENABLED', 'true'),
      consumed_retention: envDefault(
        'TINYAUTH_CLEANUP_OAUTH_CODES_RETENTION',
        '24h',
      ),
    },
    email_verifications: {
      enabled: envDefault(
        'TINYAUTH_CLEANUP_EMAIL_VERIFICATIONS_ENABLED',
        'true',
      ),
      retention: envDefault(
        'TINYAUTH_CLEANUP_EMAIL_VERIFICATIONS_RETENTION',
        '0',
      ),
    },
    password_resets: {
      enabled: envDefault('TINYAUTH_CLEANUP_PASSWORD_RESETS_ENABLED', 'true'),
      retention: envDefault('TINYAUTH_CLEANUP_PASSWORD_RESETS_RETENTION', '0'),
    },
    pending_oauth_registrations: {
      enabled: envDefault(
        'TINYAUTH_CLEANUP_PENDING_OAUTH_REGISTRATIONS_ENABLED',
        'true',
      ),
      retention: envDefault(
        'TINYAUTH_CLEANUP_PENDING_OAUTH_REGISTRATIONS_RETENTION',
        '0',
      ),
    },
  },
};
