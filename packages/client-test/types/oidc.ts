export interface OIDCConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  introspection_endpoint: string;
  revocation_endpoint: string;
  jwks_uri?: string;
  openid_configuration_uri?: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scope: string;
  response_type: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface IDTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface PKCEPair {
  code_verifier: string;
  code_challenge: string;
}

export interface AuthState {
  state: string;
  code_verifier: string;
  nonce: string;
}

export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  iss?: string;
}

/**
 * OpenID Provider Configuration
 * https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
export interface OpenIDConfiguration {
  // Required
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];

  // Recommended
  userinfo_endpoint?: string;
  scopes_supported?: string[];
  claims_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];

  // Optional
  introspection_endpoint?: string;
  revocation_endpoint?: string;
  service_documentation?: string;
  ui_locales_supported?: string[];
}

/**
 * JSON Web Key (JWK)
 * https://datatracker.ietf.org/doc/html/rfc7517
 */
export interface JWK {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  // RSA
  n?: string;
  e?: string;
  // EC
  crv?: string;
  x?: string;
  y?: string;
}

/**
 * JSON Web Key Set (JWKS)
 * https://datatracker.ietf.org/doc/html/rfc7517#section-5
 */
export interface JWKS {
  keys: JWK[];
}
