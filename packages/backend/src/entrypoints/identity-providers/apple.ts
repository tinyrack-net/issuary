import type { IdentityProviderConfig } from '../../lib/config/index.ts';

export interface AppleOAuthConfig {
  id: string;
  enabled: boolean;
  display_name?: string | undefined;
  icon_url?: string | undefined;
  client_id: string;
  client_secret: string;
  scopes?: string[] | undefined;
  response_mode?: 'query' | 'fragment' | 'form_post' | undefined;
  email_conflict_strategy: 'auto_link' | 'require_link';
}

export function apple(config: AppleOAuthConfig): IdentityProviderConfig {
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
