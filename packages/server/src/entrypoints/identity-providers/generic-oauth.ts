import type { IdentityProviderConfig } from '../../lib/config/index.ts';

export interface GenericOAuthConfig {
  id: string;
  enabled: boolean;
  display_name: string;
  icon_url?: string | undefined;
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  userinfo_url?: string | null | undefined;
  jwks_url?: string | undefined;
  issuer?: string | undefined;
  email_url?: string | undefined;
  scopes: string[];
  response_mode?: 'query' | 'fragment' | 'form_post' | undefined;
  email_conflict_strategy: 'auto_link' | 'require_link';
  userinfo_mapping: {
    id: string;
    email: string;
    email_verified?: string | undefined;
    name?: string | undefined;
    picture?: string | undefined;
  };
}

export function genericOAuth(
  config: GenericOAuthConfig,
): IdentityProviderConfig {
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
    jwks_url: config.jwks_url,
    issuer: config.issuer,
    email_url: config.email_url,
    scopes: config.scopes,
    response_mode: config.response_mode,
    email_conflict_strategy: config.email_conflict_strategy,
    userinfo_mapping: config.userinfo_mapping,
  };
}
