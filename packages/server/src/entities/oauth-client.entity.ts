import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { OAuthClientRepository } from '../repositories/oauth-client.repository.ts';
import { BaseSchema } from './base.entity.ts';
import { OAuthCodeEntitySchema } from './oauth-code.entity.ts';
import { OAuthDeviceCodeEntitySchema } from './oauth-device-code.entity.ts';
import { RevokedTokenEntitySchema } from './revoked-token.entity.ts';
import { UserConsentEntitySchema } from './user-consent.entity.ts';

export const OAuthClientEntitySchema = defineEntity({
  name: 'OAuthClientEntity',
  tableName: 'oauth_client',
  comment: 'Registered OAuth clients',
  extends: BaseSchema,
  repository: () => OAuthClientRepository,
  properties: (p) => ({
    id: p
      .string()
      .primary()
      .comment('Config/internal client identifier')
      .onCreate(() => crypto.randomUUID()),
    clientId: p.string().comment('Public client identifier'),
    clientSecretHash: p
      .string()
      .comment('Hash of the client secret (null for public clients using PKCE)')
      .nullable()
      .lazy(),
    name: p.string().comment('Human-readable name of the OAuth client'),
    grantTypes: p
      .json<string[]>()
      .comment('Allowed OAuth grant types for the client')
      .default([]),
    responseTypes: p
      .json<string[]>()
      .comment('Allowed OAuth response types for the client')
      .default([]),
    scopes: p
      .json<string[]>()
      .comment('Allowed OAuth scopes for the client')
      .default([]),
    redirectUris: p
      .json<string[]>()
      .comment('Registered redirect URIs for the client')
      .default([]),
    postLogoutRedirectUris: p
      .json<string[]>()
      .comment('Registered post-logout redirect URIs for the client')
      .default([]),
    webOrigins: p
      .json<string[]>()
      .comment('Registered browser origins for OAuth CORS requests')
      .default([]),
    enabled: p
      .boolean()
      .comment('Whether the OAuth client is enabled')
      .default(true),
    managed_by: p
      .string()
      .$type<'database' | 'config'>()
      .comment('Data source: config (from YAML) or database (runtime created)')
      .default('database'),
    logoUri: p
      .string()
      .comment('Logo URI for the OAuth client')
      .nullable()
      .default(null),
    codes: () => p.oneToMany(OAuthCodeEntitySchema).mappedBy('client'),
    deviceCodes: () =>
      p.oneToMany(OAuthDeviceCodeEntitySchema).mappedBy('client'),
    consents: () => p.oneToMany(UserConsentEntitySchema).mappedBy('client'),
    revokedTokens: () =>
      p.oneToMany(RevokedTokenEntitySchema).mappedBy('client'),
  }),
  indexes: [
    {
      name: 'client_client_id_unique',
      properties: ['clientId'],
      options: { unique: true },
    },
  ],
});

export type IOAuthClientEntity = InferEntity<typeof OAuthClientEntitySchema>;
