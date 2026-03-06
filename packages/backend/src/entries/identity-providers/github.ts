import type {
  GithubOAuthSchema,
  ResolvedIdentityProvider,
} from '#backend/lib/schema.js';

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
