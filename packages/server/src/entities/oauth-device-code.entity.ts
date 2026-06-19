import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { OAuthDeviceCodeRepository } from '../repositories/oauth-device-code.repository.ts';
import { BaseSchema } from './base.entity.ts';
import { OAuthClientEntitySchema } from './oauth-client.entity.ts';
import { UserEntity } from './user.entity.ts';

export const OAuthDeviceCodeEntitySchema = defineEntity({
  name: 'OAuthDeviceCodeEntity',
  tableName: 'oauth_device_code',
  comment: 'Issued OAuth device authorization grants',
  extends: BaseSchema,
  repository: () => OAuthDeviceCodeRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .onCreate(() => crypto.randomUUID()),
    deviceCodeHash: p
      .string()
      .comment('Hash of the issued device_code')
      .unique(),
    userCodeHash: p
      .string()
      .comment('Hash of the user-facing verification code')
      .unique(),
    client: () =>
      p
        .manyToOne(OAuthClientEntitySchema)
        .comment(
          'Reference to the OAuth client that requested the device code',
        ),
    scope: p
      .json<string[]>()
      .comment('Scopes requested by the device authorization request')
      .default([]),
    expiresAt: p.datetime().comment('Absolute expiry timestamp for the code'),
    authorizedUser: () =>
      p
        .manyToOne(UserEntity)
        .comment('User that approved the device authorization request')
        .nullable(),
    authorizedAt: p
      .datetime()
      .comment('Timestamp when the user approved the request')
      .nullable(),
    consumedAt: p
      .datetime()
      .comment('Timestamp when the device code was exchanged')
      .nullable(),
  }),
  indexes: [
    {
      name: 'oauth_device_code_device_hash_idx',
      properties: ['deviceCodeHash'],
    },
    {
      name: 'oauth_device_code_user_hash_idx',
      properties: ['userCodeHash'],
    },
    {
      name: 'oauth_device_code_expired_at_idx',
      properties: ['expiresAt'],
    },
  ],
});

export type IOAuthDeviceCodeEntity = InferEntity<
  typeof OAuthDeviceCodeEntitySchema
>;
