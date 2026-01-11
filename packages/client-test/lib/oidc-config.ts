import type { OIDCConfig } from '@/types/oidc';

export const oidcConfig: OIDCConfig = {
  issuer: 'http://localhost:8080',
  authorization_endpoint: 'http://localhost:8080/application/oauth/authorize',
  token_endpoint: 'http://localhost:8080/application/oauth/token',
  userinfo_endpoint: 'http://localhost:8080/application/oauth/userinfo',
  introspection_endpoint: 'http://localhost:8080/application/oauth/introspect',
  revocation_endpoint: 'http://localhost:8080/application/oauth/revoke',
  jwks_uri: 'http://localhost:8080/application/oauth/.well-known/jwks',
  openid_configuration_uri:
    'http://localhost:8080/application/oauth/.well-known/openid-configuration',

  client_id: 'sdlk3n3dkj2',
  client_secret: 'sdlk3n3dkj2',
  redirect_uri: 'http://localhost:3000/api/callback',

  scope: 'openid profile email',
  response_type: 'code',
};
