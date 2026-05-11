import { defineEntity, type InferEntity, p } from '@mikro-orm/core';
import { UserRepository } from '../repositories/user.repository.ts';
import { BaseSchema } from './base.entity.ts';
import { UserOAuthEntitySchema } from './user-oauth.entity.ts';
import { UserPasskeyEntitySchema } from './user-passkey.entity.ts';
import { UserTotpEntitySchema } from './user-totp.entity.ts';
import { UserTotpRecoveryCodeEntitySchema } from './user-totp-recovery-code.entity.ts';

export const UserEntitySchema = defineEntity({
  name: 'UserEntity',
  tableName: 'user',
  comment: 'Registered users',
  extends: BaseSchema,
  repository: () => UserRepository,
  properties: {
    sub: p
      .string()
      .primary()
      .comment('Subject identifier')
      .onCreate(() => crypto.randomUUID()),
    email: p.string().comment('User email address'),
    email_verified: p
      .boolean()
      .comment("Whether the user's email has been verified")
      .default(false),
    password_hash: p
      .string()
      .comment('Hashed password for local authentication')
      .nullable()
      .lazy(),
    managed_by: p
      .string()
      .$type<'database' | 'config'>()
      .comment('Data source: config (from YAML) or database (runtime created)')
      .default('database'),
    role: p
      .string()
      .$type<'user' | 'admin'>()
      .comment('User role: user or admin')
      .default('user'),
    deleted_at: p
      .datetime()
      .comment(
        'Timestamp when the user requested account deletion (soft delete)',
      )
      .nullable(),
    oauthAccounts: () => p.oneToMany(UserOAuthEntitySchema).mappedBy('user'),
    passkeys: () => p.oneToMany(UserPasskeyEntitySchema).mappedBy('user'),
    totps: () => p.oneToMany(UserTotpEntitySchema).mappedBy('user'),
    totpRecoveryCodes: () =>
      p.oneToMany(UserTotpRecoveryCodeEntitySchema).mappedBy('user'),
  },
  indexes: [
    {
      name: 'user_email_unique',
      properties: ['email'],
      options: { unique: true },
    },
    {
      name: 'user_deleted_at_idx',
      properties: ['deleted_at'],
    },
  ],
});

export type IUserEntity = InferEntity<typeof UserEntitySchema>;

export class UserEntity extends UserEntitySchema.class {
  /**
   * Check if user has a password set
   */
  hasPassword(): boolean {
    return this.password_hash !== null && this.password_hash !== undefined;
  }
}

UserEntitySchema.setClass(UserEntity);
