import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { EmailVerificationRepository } from '#backend/repositories/email-verification.repository.js';
import { BaseSchema } from './base.entity.js';
import { UserEntity } from './user.entity.js';

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
