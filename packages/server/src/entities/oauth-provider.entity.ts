import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { OAuthProviderRepository } from '../repositories/oauth-provider.repository.ts';
import { BaseSchema } from './base.entity.ts';

export type OAuthProviderType = 'github' | 'google' | 'apple' | 'generic_oauth';
export type OAuthProviderResponseMode = 'query' | 'fragment' | 'form_post';
export type OAuthProviderEmailConflictStrategy = 'auto_link' | 'require_link';

export interface OAuthProviderUserinfoMapping {
  id: string;
  email: string;
  email_verified?: string | undefined;
  name?: string | undefined;
  picture?: string | undefined;
}

export const OAuthProviderEntitySchema = defineEntity({
  name: 'OAuthProviderEntity',
  tableName: 'oauth_provider',
  comment: 'Database-managed OAuth identity providers',
  extends: BaseSchema,
  repository: () => OAuthProviderRepository,
  properties: (p) => ({
    id: p.string().primary().comment('OAuth provider identifier'),
    type: p
      .string()
      .$type<OAuthProviderType>()
      .comment('OAuth provider implementation type'),
    issuer: p
      .string()
      .comment('Expected issuer for ID tokens verified with JWKS')
      .nullable()
      .default(null),
    displayName: p.string().comment('Display name shown to users'),
    iconUrl: p
      .string()
      .comment('Provider icon URL shown to users')
      .nullable()
      .default(null),
    clientId: p.string().comment('OAuth client ID from the provider'),
    clientSecretEncrypted: p
      .string()
      .comment('Encrypted OAuth client secret for token exchange'),
    scopes: p
      .json<string[]>()
      .comment('OAuth scopes to request from the provider')
      .default([]),
    authorizationUrl: p.string().comment('OAuth authorization endpoint URL'),
    tokenUrl: p.string().comment('OAuth token endpoint URL'),
    userinfoUrl: p
      .string()
      .comment('OAuth userinfo endpoint URL')
      .nullable()
      .default(null),
    jwksUrl: p
      .string()
      .comment('JWKS endpoint URL for ID token verification')
      .nullable()
      .default(null),
    emailUrl: p
      .string()
      .comment('Separate endpoint URL for fetching user email')
      .nullable()
      .default(null),
    responseMode: p
      .string()
      .$type<OAuthProviderResponseMode | null>()
      .comment('OAuth response mode for the authorization callback')
      .nullable()
      .default(null),
    emailConflictStrategy: p
      .string()
      .$type<OAuthProviderEmailConflictStrategy>()
      .comment('Strategy when a matching email already exists')
      .default('auto_link'),
    userinfoMapping: p
      .json<OAuthProviderUserinfoMapping>()
      .comment('Mapping of userinfo response fields to user attributes'),
    enabled: p
      .boolean()
      .comment('Whether this identity provider is enabled')
      .default(true),
  }),
});

export type IOAuthProviderEntity = InferEntity<
  typeof OAuthProviderEntitySchema
>;
