import { UserTotpRepository } from '@backend/repositories/user-totp.repository.js';
import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { BaseSchema } from './base.entity.js';
import { UserEntitySchema } from './user.entity.js';

export const UserTotpEntitySchema = defineEntity({
  name: 'UserTotpEntity',
  tableName: 'user_totp',
  comment: 'User TOTP secrets for two-factor authentication',
  extends: BaseSchema,
  repository: () => UserTotpRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    user: () =>
      p
        .manyToOne(UserEntitySchema)
        .comment('Reference to the user')
        .deleteRule('cascade'),
    secret: p.string().comment('TOTP secret key (base32 encoded)').hidden(),
    verified: p
      .boolean()
      .comment('Whether the TOTP setup has been verified')
      .default(false),
    recovery_confirmed: p
      .boolean()
      .comment('Whether the user has confirmed saving recovery codes')
      .default(false),
  }),
  uniques: [
    {
      name: 'user_totp_user_unique',
      properties: ['user'],
    },
  ],
});

export type IUserTotpEntity = InferEntity<typeof UserTotpEntitySchema>;
