import type {
  GenericOAuthSchema,
  ResolvedIdentityProvider,
} from '#backend/lib/schema.js';

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
