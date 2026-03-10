import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import { genericOAuth } from '@tinyauth/backend/identity-providers/generic-oauth';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a mixed OAuth providers config for e2e tests.
 * Includes enabled, disabled, success, and denied provider variants.
 */
export function createOauthProvidersMixedConfig(
  backendPort: number,
  _frontendPort: number,
): TinyAuthConfigs {
  const host = `http://localhost:${backendPort}`;

  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host,
      port: backendPort,
      allowed_signup_emails: ['*@allowed.test'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
    },
    identity_providers: [
      genericOAuth({
        id: 'stub-success',
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
      }),
      genericOAuth({
        id: 'stub-denied',
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
      }),
      genericOAuth({
        id: 'stub-not-allowed',
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
      }),
      genericOAuth({
        id: 'stub-disabled',
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
      }),
    ],
  };
}
