import type { ResolvedAppConfig } from '@tinyauth/backend/config';
import { genericOAuth } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

const OAUTH_EXISTING_PENDING_EMAIL = 'oauth-stub-existing-pending@allowed.test';

/**
 * Creates an OAuth + terms configuration for e2e matrix coverage.
 * Covers:
 * - Password registration with explicit + implicit terms
 * - OAuth existing-user login vs new-user complete-registration branching
 */
export function createOauthProvidersTermsConfig(
  backendPort: number,
  _frontendPort: number,
): ResolvedAppConfig {
  const host = `http://localhost:${backendPort}`;

  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host,
      port: backendPort,
      cookie_secret:
        '99d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*@allowed.test'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
      signup_implicit_terms: {
        en: 'By signing up, you agree to product analytics tracking.',
      },
    },
    identity_providers: [
      genericOAuth({
        id: 'stub-new-user',
        enabled: true,
        display_name: 'Stub New User',
        icon_url: 'https://example.com/stub-new-user.svg',
        client_id: 'stub-new-user-client-id',
        client_secret: 'stub-new-user-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-new-user/authorize`,
        token_url: `${host}/test/oauth-stub/stub-new-user/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-new-user/userinfo`,
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
        id: 'stub-new-user-oidc',
        enabled: true,
        display_name: 'Stub New User OIDC',
        icon_url: 'https://example.com/stub-new-user-oidc.svg',
        client_id: 'stub-new-user-oidc-client-id',
        client_secret: 'stub-new-user-oidc-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-new-user-oidc/authorize`,
        token_url: `${host}/test/oauth-stub/stub-new-user-oidc/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-new-user-oidc/userinfo`,
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
        id: 'stub-existing-pending',
        enabled: true,
        display_name: 'Stub Existing Pending',
        icon_url: 'https://example.com/stub-existing-pending.svg',
        client_id: 'stub-existing-pending-client-id',
        client_secret: 'stub-existing-pending-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-existing-pending/authorize`,
        token_url: `${host}/test/oauth-stub/stub-existing-pending/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-existing-pending/userinfo`,
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
        id: 'stub-existing-complete',
        enabled: true,
        display_name: 'Stub Existing Complete',
        icon_url: 'https://example.com/stub-existing-complete.svg',
        client_id: 'stub-existing-complete-client-id',
        client_secret: 'stub-existing-complete-client-secret',
        authorization_url: `${host}/test/oauth-stub/stub-existing-complete/authorize`,
        token_url: `${host}/test/oauth-stub/stub-existing-complete/token`,
        userinfo_url: `${host}/test/oauth-stub/stub-existing-complete/userinfo`,
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
    terms: [
      {
        id: 'tos',
        required: true,
        consent_mode: 'explicit',
        version: '1.0.0',
        content: {
          en: {
            title: 'Terms of Service',
            type: 'text',
            content: 'Test Terms of Service content for oauth providers terms.',
          },
        },
      },
      {
        id: 'privacy',
        required: false,
        consent_mode: 'explicit',
        version: '1.0.0',
        content: {
          en: {
            title: 'Privacy Policy',
            type: 'text',
            content: 'Test Privacy Policy content for oauth providers terms.',
          },
        },
      },
      {
        id: 'analytics',
        required: true,
        consent_mode: 'implicit',
        version: '1.0.0',
        content: {
          en: {
            title: 'Analytics Terms',
            type: 'text',
            content: 'Implicit analytics terms for oauth providers terms.',
          },
        },
      },
    ],
    users: [
      E2E_TEST_USER_CONFIG,
      {
        sub: 'oauth-existing-pending',
        email: OAUTH_EXISTING_PENDING_EMAIL,
        password: 'changemelater',
        role: 'admin',
      },
    ],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
