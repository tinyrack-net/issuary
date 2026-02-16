import { OAuthClientRepository } from '@backend/repositories/oauth-client.repository.js';
import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';
import { OAuthCodeEntitySchema } from './oauth-code.entity.js';
import { RevokedTokenEntitySchema } from './revoked-token.entity.js';
import { UserConsentEntitySchema } from './user-consent.entity.js';

export const OAuthClientEntitySchema = defineEntity({
  name: 'OAuthClientEntity',
  tableName: 'oauth_client',
  comment: 'Registered OAuth clients',
  extends: BaseSchema,
  repository: () => OAuthClientRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    clientId: p.string().comment('Public client identifier'),
    clientSecretHash: p
      .string()
      .comment('Hash of the client secret (null for public clients using PKCE)')
      .nullable()
      .lazy(true, false),
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
