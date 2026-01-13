import { UserPasskeyRepository } from '@/repositories/user-passkey.repository.js';
import {
  Entity,
  EntityRepositoryType,
  Index,
  ManyToOne,
  type Opt,
  PrimaryKey,
  Property,
  type Rel,
  t,
} from '@mikro-orm/core';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({
  tableName: 'user_passkey',
  comment: 'User passkeys for WebAuthn authentication',
  repository: () => UserPasskeyRepository,
})
export class UserPasskeyEntity extends BaseEntity {
  [EntityRepositoryType]?: UserPasskeyRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  @ManyToOne(() => UserEntity, {
    name: 'user_id',
    comment: 'Reference to the user',
    nullable: false,
    deleteRule: 'cascade',
  })
  public user: Rel<UserEntity>;

  @Index({
    name: 'user_passkey_credential_id_unique',
    properties: ['credential_id'],
    options: { unique: true },
  })
  @Property({
    type: t.string,
    name: 'credential_id',
    comment: 'WebAuthn credential ID (base64url encoded)',
    nullable: false,
  })
  public credential_id: string;

  @Property({
    type: t.text,
    name: 'public_key',
    comment: 'Public key (base64url encoded)',
    nullable: false,
    hidden: true,
  })
  public public_key: string;

  @Property({
    type: t.bigint,
    name: 'counter',
    comment: 'Signature counter for replay attack prevention',
    nullable: false,
    default: 0,
  })
  public counter: Opt<number> = 0;

  @Property({
    type: t.string,
    name: 'device_type',
    comment: 'Credential device type: singleDevice or multiDevice',
    nullable: false,
    default: 'singleDevice',
  })
  public device_type: Opt<'singleDevice' | 'multiDevice'> = 'singleDevice';

  @Property({
    type: t.boolean,
    name: 'backed_up',
    comment: 'Whether the credential is backed up (synced passkey)',
    nullable: false,
    default: false,
  })
  public backed_up: Opt<boolean> = false;

  @Property({
    type: t.json,
    name: 'transports',
    comment:
      'Supported authenticator transports (usb, ble, nfc, internal, etc)',
    nullable: true,
    default: null,
  })
  public transports: AuthenticatorTransportFuture[] | null = null;

  @Property({
    type: t.string,
    name: 'name',
    comment: 'User-defined name for the passkey',
    nullable: true,
    default: null,
  })
  public name: string | null = null;

  @Property({
    type: t.string,
    name: 'aaguid',
    comment: 'Authenticator Attestation GUID for device identification',
    nullable: true,
    default: null,
  })
  public aaguid: string | null = null;

  public constructor(params: {
    user: UserEntity;
    credential_id: string;
    public_key: string;
    counter?: number;
    device_type?: 'singleDevice' | 'multiDevice';
    backed_up?: boolean;
    transports?: AuthenticatorTransportFuture[] | null;
    name?: string | null;
    aaguid?: string | null;
  }) {
    super();
    this.user = params.user;
    this.credential_id = params.credential_id;
    this.public_key = params.public_key;
    if (params.counter !== undefined) {
      this.counter = params.counter;
    }
    if (params.device_type !== undefined) {
      this.device_type = params.device_type;
    }
    if (params.backed_up !== undefined) {
      this.backed_up = params.backed_up;
    }
    if (params.transports !== undefined) {
      this.transports = params.transports;
    }
    if (params.name !== undefined) {
      this.name = params.name;
    }
    if (params.aaguid !== undefined) {
      this.aaguid = params.aaguid;
    }
  }
}
