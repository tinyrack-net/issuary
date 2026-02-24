import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { UserConsentRepository } from '#backend/repositories/user-consent.repository.js';
import { BaseSchema } from './base.entity.js';
import { OAuthClientEntitySchema } from './oauth-client.entity.js';
import { UserEntitySchema } from './user.entity.js';

/**
 * UserConsentEntity stores user consent decisions for OAuth clients.
 *
 * When a user grants consent to an OAuth client for specific scopes,
 * this entity records that decision. Future authorization requests
 * from the same client with the same or subset of scopes can skip
 * the consent screen (unless prompt=consent is specified).
 */
export const UserConsentEntitySchema = defineEntity({
  name: 'UserConsentEntity',
  tableName: 'user_consent',
  comment: 'User consent decisions for OAuth clients',
  extends: BaseSchema,
  repository: () => UserConsentRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    user: () =>
      p
        .manyToOne(UserEntitySchema)
        .comment('Reference to the user who granted consent')
        .index('user_consent_user_sub_index'),
    client: () =>
      p
        .manyToOne(OAuthClientEntitySchema)
        .comment('Reference to the OAuth client that received consent')
        .index('user_consent_client_id_index'),
    scopes: p
      .json<string[]>()
      .comment('List of scopes the user has consented to')
      .default([]),
    granted_at: p
      .datetime()
      .comment('Timestamp when consent was first granted')
      .onCreate(() => new Date()),
    revoked_at: p
      .datetime()
      .comment('Timestamp when consent was revoked (null if active)')
      .nullable(),
  }),
  uniques: [
    {
      name: 'user_consent_unique',
      properties: ['user', 'client'],
    },
  ],
});

export type IUserConsentEntity = InferEntity<typeof UserConsentEntitySchema>;

export class UserConsentEntity extends UserConsentEntitySchema.class {
  /**
   * Check if consent covers all requested scopes
   */
  public hasScopes(requestedScopes: string[]): boolean {
    if (this.revoked_at) {
      return false;
    }
    return requestedScopes.every((scope) => this.scopes.includes(scope));
  }
}

UserConsentEntitySchema.setClass(UserConsentEntity);
