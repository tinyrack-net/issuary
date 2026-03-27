import { defineEntity, type InferEntity } from '@mikro-orm/core';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { UserPasskeyRepository } from '../repositories/user-passkey.repository.ts';
import { BaseSchema } from './base.entity.ts';
import { UserEntity } from './user.entity.ts';

export const UserPasskeyEntitySchema = defineEntity({
  name: 'UserPasskeyEntity',
  tableName: 'user_passkey',
  comment: 'User passkeys for WebAuthn authentication',
  extends: BaseSchema,
  repository: () => UserPasskeyRepository,
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
        .deleteRule('cascade')
        .index('user_passkey_user_sub_idx'),
    credential_id: p
      .string()
      .comment('WebAuthn credential ID (base64url encoded)'),
    public_key: p.text().comment('Public key (base64url encoded)').hidden(),
    counter: p
      .integer()
      .comment('Signature counter for replay attack prevention')
      .default(0),
    device_type: p
      .string()
      .$type<'singleDevice' | 'multiDevice'>()
      .comment('Credential device type: singleDevice or multiDevice')
      .default('singleDevice'),
    backed_up: p
      .boolean()
      .comment('Whether the credential is backed up (synced passkey)')
      .default(false),
    transports: p
      .json<AuthenticatorTransportFuture[] | null>()
      .comment(
        'Supported authenticator transports (usb, ble, nfc, internal, etc)',
      )
      .nullable()
      .default(null),
    name: p
      .string()
      .comment('User-defined name for the passkey')
      .nullable()
      .default(null),
    aaguid: p
      .string()
      .comment('Authenticator Attestation GUID for device identification')
      .nullable()
      .default(null),
  }),
  indexes: [
    {
      name: 'user_passkey_credential_id_unique',
      properties: ['credential_id'],
      options: { unique: true },
    },
  ],
});

export type IUserPasskeyEntity = InferEntity<typeof UserPasskeyEntitySchema>;
