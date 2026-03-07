import type { ResolvedIdentityProvider } from '#backend/lib/config/index.js';

export interface GoogleOAuthConfig {
  id: string;
  enabled: boolean;
  display_name?: string | undefined;
  icon_url?: string | undefined;
  client_id: string;
  client_secret: string;
  scopes?: string[] | undefined;
  email_conflict_strategy: 'auto_link' | 'require_link';
}

export function google(config: GoogleOAuthConfig): ResolvedIdentityProvider {
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
