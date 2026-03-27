import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { EmailVerificationRepository } from '../repositories/email-verification.repository.ts';
import { BaseSchema } from './base.entity.ts';
import { UserEntity } from './user.entity.ts';

export const EmailVerificationEntitySchema = defineEntity({
  name: 'EmailVerificationEntity',
  tableName: 'email_verification',
  comment: 'Email verification tokens for user registration',
  extends: BaseSchema,
  repository: () => EmailVerificationRepository,
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
        .index('email_verification_user_sub_idx'),
    token: p.string().comment('Unique verification token'),
    expiresAt: p.datetime().comment('Token expiration timestamp'),
    verified: p
      .boolean()
      .comment('Whether the token has been used')
      .default(false),
    verifiedAt: p
      .datetime()
      .comment('Timestamp when the email was verified')
      .nullable()
      .default(null),
  }),
  indexes: [
    {
      name: 'email_verification_token_idx',
      properties: ['token'],
      options: { unique: true },
    },
  ],
});

export type IEmailVerificationEntity = InferEntity<
  typeof EmailVerificationEntitySchema
>;
