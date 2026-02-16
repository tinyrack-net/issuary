import { PasswordResetRepository } from '@backend/repositories/password-reset.repository.js';
import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';
import { UserEntity } from './user.entity.js';

export const PasswordResetEntitySchema = defineEntity({
  name: 'PasswordResetEntity',
  tableName: 'password_reset',
  comment: 'Password reset tokens for user password recovery',
  extends: BaseSchema,
  repository: () => PasswordResetRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    user: () =>
      p
        .manyToOne(UserEntity)
        .ref()
        .comment('Reference to the user')
        .index('password_reset_user_id_idx'),
    token: p.string().comment('Unique password reset token'),
    expiresAt: p.datetime().comment('Token expiration timestamp'),
    used: p.boolean().comment('Whether the token has been used').default(false),
    usedAt: p
      .datetime()
      .comment('Timestamp when the token was used')
      .nullable()
      .default(null),
  }),
  indexes: [
    {
      name: 'password_reset_token_idx',
      properties: ['token'],
      options: { unique: true },
    },
  ],
});

export type IPasswordResetEntity = InferEntity<
  typeof PasswordResetEntitySchema
>;
