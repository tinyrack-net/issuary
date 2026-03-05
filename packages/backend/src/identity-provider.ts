import type {
  AppleOAuthSchema,
  GenericOAuthSchema,
  GithubOAuthSchema,
  GoogleOAuthSchema,
} from './lib/config/schema.js';

export interface ResolvedIdentityProvider {
  id: string;
  type: 'github' | 'google' | 'apple' | 'generic_oauth';
  enabled: boolean;
  display_name: string;
  icon_url?: string | undefined;
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  userinfo_url: string | null;
  email_url?: string | undefined;
  scopes: string[];
  response_mode?: string | undefined;
  email_conflict_strategy: 'auto_link' | 'require_link';
  userinfo_mapping: {
    id: string;
    email: string;
    email_verified?: string | undefined;
    name?: string | undefined;
    picture?: string | undefined;
  };
}

export function github(
  config: Omit<GithubOAuthSchema, 'type'>,
): ResolvedIdentityProvider {
  return {
    id: config.id,
    type: 'github',
    enabled: config.enabled,
    display_name: config.display_name || config.id,
    icon_url: config.icon_url,
    client_id: config.client_id,
    client_secret: config.client_secret,
    authorization_url: 'https://github.com/login/oauth/authorize',
    token_url: 'https://github.com/login/oauth/access_token',
    userinfo_url: 'https://api.github.com/user',
    email_url: 'https://api.github.com/user/emails',
    scopes: config.scopes || ['user:email'],
    email_conflict_strategy: config.email_conflict_strategy,
    userinfo_mapping: {
      id: 'id',
      email: 'email',
      name: 'name',
      picture: 'avatar_url',
    },
  };
}

export function google(
  config: Omit<GoogleOAuthSchema, 'type'>,
): ResolvedIdentityProvider {
  return {
    id: config.id,
    type: 'google',
    enabled: config.enabled,
    display_name: config.display_name || config.id,
    icon_url: config.icon_url,
    client_id: config.client_id,
    client_secret: config.client_secret,
    authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: config.scopes || ['openid', 'email', 'profile'],
    email_conflict_strategy: config.email_conflict_strategy,
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
      name: 'name',
      picture: 'picture',
    },
  };
}

export function apple(
  config: Omit<AppleOAuthSchema, 'type'>,
): ResolvedIdentityProvider {
  return {
    id: config.id,
    type: 'apple',
    enabled: config.enabled,
    display_name: config.display_name || config.id,
    icon_url: config.icon_url,
    client_id: config.client_id,
    client_secret: config.client_secret,
    authorization_url: 'https://appleid.apple.com/auth/authorize',
    token_url: 'https://appleid.apple.com/auth/token',
    userinfo_url: null,
    scopes: config.scopes || ['openid', 'email', 'name'],
    response_mode: config.response_mode || 'form_post',
    email_conflict_strategy: config.email_conflict_strategy,
    userinfo_mapping: {
      id: 'sub',
      email: 'email',
      email_verified: 'email_verified',
    },
  };
}

export function genericOAuth(
  config: Omit<GenericOAuthSchema, 'type'>,
): ResolvedIdentityProvider {
  return {
    id: config.id,
    type: 'generic_oauth',
    enabled: config.enabled,
    display_name: config.display_name,
    icon_url: config.icon_url,
    client_id: config.client_id,
    client_secret: config.client_secret,
    authorization_url: config.authorization_url,
    token_url: config.token_url,
    userinfo_url: config.userinfo_url ?? null,
    email_url: config.email_url,
    scopes: config.scopes,
    response_mode: config.response_mode,
    email_conflict_strategy: config.email_conflict_strategy,
    userinfo_mapping: config.userinfo_mapping,
  };
}
