import type { AuthorizationContextSearch } from '#frontend/libs/oauth-search.ts';
import {
  type AuthorizationContextResponse,
  getAuthorizationContextQueryOptions,
} from '#frontend/queries/authorization-context.ts';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';
import type { RouteTestQueryData } from '#frontend/test-utils/route-screen-renderer.tsx';

export const routeTestAppConfig = {
  i18n: {
    supported_languages: ['en'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    background_url: '',
    icon_url: '',
    title: {},
    subtitle: {},
  },
  registration: {
    public_registration: true,
    email_pattern_filter_enabled: false,
    email_verification_required: true,
    signup_notice: {},
  },
  database: {
    enabled: true,
  },
  email: {
    enabled: true,
  },
  admin: {
    enabled: true,
  },
  auth: {
    password: {
      enabled: true,
      two_factor: {
        enrollment_required: true,
      },
      totp: {
        enabled: true,
        issuer: 'Issuary',
      },
      policy: {
        min_length: 8,
        max_length: 64,
      },
    },
    passkey: {
      enabled: true,
    },
  },
  identity_providers: [],
  account_deletion: {
    enabled: true,
    retention: 'P30D',
  },
} satisfies AppConfigs;

export const routeTestUser = {
  managed_by: 'database',
  sub: 'user-1',
  email: 'alice@example.com',
  role: 'user',
  email_verified: true,
  email_verification_required: false,
  has_password: true,
  second_factor_required: false,
  totp_registered: false,
  totp_recovery_codes_missing: false,
  passkey_count: 0,
} satisfies SessionUser;

export const routeTestAuthorizationContext = {
  client: {
    id: 'client-1',
    clientId: 'client-web',
    name: 'Client Web',
  },
  redirect_uri: 'https://client.example/callback',
  redirect_origin: 'https://client.example',
  scopes: [
    {
      name: 'openid',
      description: 'Access your unique user identifier',
    },
  ],
} satisfies AuthorizationContextResponse;

export function appConfigQueryData(
  config: AppConfigs = routeTestAppConfig,
): RouteTestQueryData {
  return {
    queryKey: appConfigQueryOptions.queryKey,
    data: config,
  };
}

export function authorizationContextQueryData(
  search: AuthorizationContextSearch,
  data: AuthorizationContextResponse = routeTestAuthorizationContext,
): RouteTestQueryData {
  return {
    queryKey: getAuthorizationContextQueryOptions(search).queryKey,
    data,
  };
}
