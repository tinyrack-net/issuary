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
