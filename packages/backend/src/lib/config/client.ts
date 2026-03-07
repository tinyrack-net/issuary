/**
 * OAuth/OIDC client configuration.
 * Defines applications that can authenticate through TinyAuth.
 */
export interface ClientConfig {
  id: string;
  name: string;
  logo_uri?: string | undefined;
  client_id: string;
  client_secret?: string | undefined;
  redirect_uris: string[];
  response_types: string[];
  grant_types: string[];
  scope: string;
}
