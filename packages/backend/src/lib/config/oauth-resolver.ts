import type { AppConfigAuthMethodOAuth } from './schemas/auth-oauth.js';

/**
 * Well-known OAuth providers with pre-configured endpoints.
 * Users only need to provide client_id and client_secret for these.
 */
export const WELL_KNOWN_OAUTH_PROVIDERS = {
  google: {
    authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
    default_scopes: ['openid', 'email', 'profile'],
    // Google returns: sub, email, email_verified, name, picture, given_name, family_name
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
      name: 'name',
      picture: 'picture',
    },
  },
  github: {
    authorization_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    userinfo_url: 'https://api.github.com/user',
    email_url: 'https://api.github.com/user/emails', // GitHub requires separate call for emails
    default_scopes: ['user:email'],
    // GitHub returns: id, login, name, email, avatar_url
    userinfo_mapping: {
      id: 'id',
      email: 'email',
      name: 'name',
      picture: 'avatar_url',
    },
  },
  apple: {
    authorization_url: 'https://appleid.apple.com/auth/authorize',
    token_url: 'https://appleid.apple.com/auth/token',
    // Apple uses ID token, not userinfo endpoint
    userinfo_url: null,
    default_scopes: ['openid', 'email', 'name'],
    response_mode: 'form_post',
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
    },
  },
} as const;

export type WellKnownOAuthProvider = keyof typeof WELL_KNOWN_OAUTH_PROVIDERS;

export interface ResolvedOAuthConfig {
  id: string;
  type: 'github' | 'google' | 'apple' | 'generic_oauth';
  display_name: string;
  icon_url?: string;
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  userinfo_url: string | null;
  email_url?: string;
  scopes: string[];
  response_mode?: string;
  email_conflict_strategy: 'auto_link' | 'require_link';
  userinfo_mapping: {
    id: string;
    email: string;
    email_verified?: string;
    name?: string;
    picture?: string;
  };
}

/**
 * Helper function to get resolved OAuth config with well-known provider defaults.
 * Resolves well-known provider endpoints and merges with user config.
 */
export function resolveOAuthConfig(
  config: AppConfigAuthMethodOAuth,
): ResolvedOAuthConfig {
  // Get well-known provider config if applicable
  const wellKnown =
    config.type !== 'generic_oauth'
      ? WELL_KNOWN_OAUTH_PROVIDERS[config.type]
      : null;

  // For generic_oauth, use provided values; for well-known providers, merge with defaults
  if (config.type === 'generic_oauth') {
    const result: ResolvedOAuthConfig = {
      id: config.id,
      type: config.type,
      display_name: config.display_name,
      client_id: config.client_id,
      client_secret: config.client_secret,
      authorization_url: config.authorization_url,
      token_url: config.token_url,
      userinfo_url: config.userinfo_url ?? null,
      scopes: config.scopes,
      email_conflict_strategy: config.email_conflict_strategy,
      userinfo_mapping: {
        id: config.userinfo_mapping.id,
        email: config.userinfo_mapping.email,
      },
    };

    if (config.icon_url) result.icon_url = config.icon_url;
    if (config.email_url) result.email_url = config.email_url;
    if (config.response_mode) result.response_mode = config.response_mode;
    if (config.userinfo_mapping.email_verified) {
      result.userinfo_mapping.email_verified =
        config.userinfo_mapping.email_verified;
    }
    if (config.userinfo_mapping.name) {
      result.userinfo_mapping.name = config.userinfo_mapping.name;
    }
    if (config.userinfo_mapping.picture) {
      result.userinfo_mapping.picture = config.userinfo_mapping.picture;
    }

    return result;
  }

  // Well-known provider (github, google, apple)
  const scopes = config.scopes || [...(wellKnown?.default_scopes ?? [])];
  const emailUrl = (wellKnown as { email_url?: string })?.email_url;
  const responseMode =
    config.type === 'apple'
      ? config.response_mode ||
        (wellKnown as { response_mode?: string })?.response_mode
      : undefined;

  const result: ResolvedOAuthConfig = {
    id: config.id,
    type: config.type,
    display_name: config.display_name || config.id,
    client_id: config.client_id,
    client_secret: config.client_secret,
    authorization_url: wellKnown?.authorization_url || '',
    token_url: wellKnown?.token_url || '',
    userinfo_url: wellKnown?.userinfo_url ?? null,
    scopes,
    email_conflict_strategy: config.email_conflict_strategy,
    userinfo_mapping: {
      id: wellKnown?.userinfo_mapping?.id || 'sub',
      email: wellKnown?.userinfo_mapping?.email || 'email',
    },
  };

  if (config.icon_url) result.icon_url = config.icon_url;
  if (emailUrl) result.email_url = emailUrl;
  if (responseMode) result.response_mode = responseMode;

  const emailVerified = (
    wellKnown?.userinfo_mapping as { email_verified?: string } | undefined
  )?.email_verified;
  const userName = (
    wellKnown?.userinfo_mapping as { name?: string } | undefined
  )?.name;
  const userPicture = (
    wellKnown?.userinfo_mapping as { picture?: string } | undefined
  )?.picture;

  if (emailVerified) result.userinfo_mapping.email_verified = emailVerified;
  if (userName) result.userinfo_mapping.name = userName;
  if (userPicture) result.userinfo_mapping.picture = userPicture;

  return result;
}
