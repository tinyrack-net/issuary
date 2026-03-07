import type { IdentityProviderConfig } from '#backend/lib/config/index.js';

export interface GithubOAuthConfig {
  id: string;
  enabled: boolean;
  display_name?: string | undefined;
  icon_url?: string | undefined;
  client_id: string;
  client_secret: string;
  scopes?: string[] | undefined;
  email_conflict_strategy: 'auto_link' | 'require_link';
}

export function github(config: GithubOAuthConfig): IdentityProviderConfig {
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
