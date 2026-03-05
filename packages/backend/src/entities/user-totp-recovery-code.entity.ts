import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { UserTotpRecoveryCodeRepository } from '#backend/repositories/user-totp-recovery-code.repository.js';
import { BaseSchema } from './base.entity.js';
import { UserEntitySchema } from './user.entity.js';

export const UserTotpRecoveryCodeEntitySchema = defineEntity({
  name: 'UserTotpRecoveryCodeEntity',
  tableName: 'user_totp_recovery_code',
  comment: 'One-time recovery codes for TOTP two-factor authentication',
  extends: BaseSchema,
  repository: () => UserTotpRecoveryCodeRepository,
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
        .deleteRule('cascade')
        .index('user_totp_recovery_code_user_sub_idx'),
    code_hash: p.string().comment('Versioned recovery code hash'),
    used: p
      .boolean()
      .comment('Whether this recovery code has been used')
      .default(false),
    used_at: p
      .datetime()
      .comment('Timestamp when this recovery code was used')
      .nullable()
      .default(null),
  }),
});

export type IUserTotpRecoveryCodeEntity = InferEntity<
  typeof UserTotpRecoveryCodeEntitySchema
>;
