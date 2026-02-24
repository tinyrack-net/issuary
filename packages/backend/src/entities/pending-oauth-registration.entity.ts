import { PendingOAuthRegistrationRepository } from '@backend/repositories/pending-oauth-registration.repository.js';
import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';

/**
 * Stores pending OAuth registration data server-side.
 *
 * When a new OAuth user needs to accept explicit terms before
 * registration completes, the OAuth tokens and user info are
 * persisted here instead of in the session cookie (which has a
 * ~4 KB size limit). The session only holds a lightweight lookup
 * token that references this record.
 */
export const PendingOAuthRegistrationEntitySchema = defineEntity({
  name: 'PendingOAuthRegistrationEntity',
  tableName: 'pending_oauth_registration',
  comment:
    'Server-side store for pending OAuth registrations awaiting terms consent',
  extends: BaseSchema,
  repository: () => PendingOAuthRegistrationRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    token: p
      .string()
      .comment('Unique lookup token stored in the session cookie')
      .unique(),
    providerId: p.string().comment('OAuth provider identifier'),
    accessToken: p
      .text()
      .comment('OAuth access token from the provider')
      .lazy(),
    refreshToken: p
      .text()
      .comment('OAuth refresh token from the provider')
      .nullable()
      .lazy(),
    expiresIn: p
      .integer()
      .comment('Token expiration duration in seconds')
      .nullable(),
    tokenType: p.string().comment('OAuth token type (e.g. Bearer)'),
    userInfo: p
      .json<{
        id: string;
        email: string;
        email_verified: boolean;
        name?: string | undefined;
        picture?: string | undefined;
      }>()
      .comment('Normalized user info from the OAuth provider'),
    returnUrl: p
      .string()
      .comment('URL to redirect to after registration completes')
      .nullable(),
    expiresAt: p
      .datetime()
      .comment('Absolute expiry timestamp for this pending registration'),
  }),
  indexes: [
    {
      name: 'pending_oauth_reg_token_idx',
      properties: ['token'],
      options: { unique: true },
    },
    {
      name: 'pending_oauth_reg_expires_at_idx',
      properties: ['expiresAt'],
    },
  ],
});

export type IPendingOAuthRegistrationEntity = InferEntity<
  typeof PendingOAuthRegistrationEntitySchema
>;
