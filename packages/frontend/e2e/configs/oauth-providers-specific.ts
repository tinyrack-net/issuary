import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Creates a config with provider-specific OAuth stubs for e2e tests.
 * Uses generic_oauth type to point at local stub endpoints that mimic
 * real provider behaviors (GitHub field mapping, Apple form_post + ID token,
 * Google standard OIDC).
 */
export function createOauthProvidersSpecificConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  const host = `http://localhost:${backendPort}`;

  return {
    app: {
      host,
      port: backendPort,
      cookie_secret:
        '88d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
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
        id: 'github-stub',
        type: 'generic_oauth',
        enabled: true,
        display_name: 'GitHub Stub',
        icon_url: 'https://example.com/github-stub.svg',
        client_id: 'github-stub-client-id',
        client_secret: 'github-stub-client-secret',
        authorization_url: `${host}/test/oauth-stub/github-stub/authorize`,
        token_url: `${host}/test/oauth-stub/github-stub/token`,
        userinfo_url: `${host}/test/oauth-stub/github-stub/userinfo`,
        scopes: ['user:email'],
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'id',
          email: 'email',
          name: 'name',
          picture: 'avatar_url',
        },
      },
      {
        id: 'apple-stub',
        type: 'generic_oauth',
        enabled: true,
        display_name: 'Apple Stub',
        icon_url: 'https://example.com/apple-stub.svg',
        client_id: 'apple-stub-client-id',
        client_secret: 'apple-stub-client-secret',
        authorization_url: `${host}/test/oauth-stub/apple-stub/authorize`,
        token_url: `${host}/test/oauth-stub/apple-stub/token`,
        scopes: ['openid', 'email', 'name'],
        response_mode: 'form_post',
        email_conflict_strategy: 'auto_link',
        userinfo_mapping: {
          id: 'sub',
          email: 'email',
          email_verified: 'email_verified',
        },
      },
      {
        id: 'google-stub',
        type: 'generic_oauth',
        enabled: true,
        display_name: 'Google Stub',
        icon_url: 'https://example.com/google-stub.svg',
        client_id: 'google-stub-client-id',
        client_secret: 'google-stub-client-secret',
        authorization_url: `${host}/test/oauth-stub/google-stub/authorize`,
        token_url: `${host}/test/oauth-stub/google-stub/token`,
        userinfo_url: `${host}/test/oauth-stub/google-stub/userinfo`,
        scopes: ['openid', 'email', 'profile'],
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
