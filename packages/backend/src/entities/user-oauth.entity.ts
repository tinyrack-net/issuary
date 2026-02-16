import { UserOAuthRepository } from '@backend/repositories/user-oauth.repository.js';
import {
  defineEntity,
  type InferEntity,
  type RequiredNullable,
} from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';
import { UserEntity } from './user.entity.js';

export const UserOAuthEntitySchema = defineEntity({
  name: 'UserOAuthEntity',
  tableName: 'user_oauth',
  comment: 'OAuth accounts linked to users',
  extends: BaseSchema,
  repository: () => UserOAuthRepository,
  properties: (p) => ({
    id: p.bigint().primary().comment('Primary key as auto-incrementing bigint'),
    user: () =>
      p
        .manyToOne(UserEntity)
        .ref()
        .comment('Reference to the user')
        .index('user_oauth_user_id_idx'),
    provider_name: p
      .string()
      .comment('Name of the OAuth provider (e.g., google, facebook)'),
    provider_user_id: p
      .string()
      .comment('Unique user ID from the OAuth provider'),
    access_token: p.string().comment('OAuth access token'),
    refresh_token: p.string().comment('OAuth refresh token'),
    expires_at: p
      .datetime()
      .comment('Access token expiry timestamp')
      .nullable()
      .$type<RequiredNullable<Date>>(),
  }),
  uniques: [
    {
      name: 'user_oauth_provider_unique',
      properties: ['provider_name', 'provider_user_id'],
    },
  ],
  indexes: [
    {
      name: 'user_oauth_user_provider_idx',
      properties: ['user', 'provider_name'],
    },
  ],
});

export type IUserOAuthEntity = InferEntity<typeof UserOAuthEntitySchema>;
