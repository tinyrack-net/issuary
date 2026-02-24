import type { AppConfigInput } from '@tinyauth/backend/app';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a mixed OAuth providers config for e2e tests.
 * Includes enabled, disabled, success, and denied provider variants.
 */
export function createOauthProvidersMixedConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  const host = `http://localhost:${backendPort}`;

  return {
    app: {
      host,
      port: backendPort,
      cookie_secret:
        '77d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*@allowed.test'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
    identity_providers: [
      {
        id: 'stub-success',
        type: 'generic_oauth',
        enabled: true,
        display_name: 'Stub Success',
        icon_url: 'https://example.com/stub-success.svg',
        client_id: 'stub-success-client-id',
        client_secret: 'stub-success-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-success/authorize`,
        token_url: `${host}/test/oauth-stub/stub-success/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-success/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      },
      {
        id: 'stub-denied',
        type: 'generic_oauth',
        enabled: true,
        display_name: 'Stub Denied',
        icon_url: 'https://example.com/stub-denied.svg',
        client_id: 'stub-denied-client-id',
        client_secret: 'stub-denied-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-denied/authorize`,
        token_url: `${host}/test/oauth-stub/stub-denied/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-denied/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      },
      {
        id: 'stub-not-allowed',
        type: 'generic_oauth',
        enabled: true,
        display_name: 'Stub Not Allowed',
        icon_url: 'https://example.com/stub-not-allowed.svg',
        client_id: 'stub-not-allowed-client-id',
        client_secret: 'stub-not-allowed-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-not-allowed/authorize`,
        token_url: `${host}/test/oauth-stub/stub-not-allowed/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-not-allowed/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      },
      {
        id: 'stub-disabled',
        type: 'generic_oauth',
        enabled: false,
        display_name: 'Stub Disabled',
        icon_url: 'https://example.com/stub-disabled.svg',
        client_id: 'stub-disabled-client-id',
        client_secret: 'stub-disabled-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-disabled/authorize`,
        token_url: `${host}/test/oauth-stub/stub-disabled/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-disabled/userinfo`,
        scopes: ['openid', 'profile', 'email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
          name: 'name',
          picture: 'picture',
        },
      },
    ],
    logging: {
      level: 'silent',
      format: 'json',
    },
    database: {
      type: 'memory',
    },
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
