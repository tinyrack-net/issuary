import { UserRepository } from '@backend/repositories/user.repository.js';
import {
  Collection,
  EntityRepositoryType,
  type EventArgs,
  type Opt,
  t,
} from '@mikro-orm/core';
import { hash, verify } from '@node-rs/argon2';
import { BaseEntity } from './base.entity.js';
import { UserOAuthEntity } from './user-oauth.entity.js';
import { UserPasskeyEntity } from './user-passkey.entity.js';
import { UserTotpEntity } from './user-totp.entity.js';
import { UserTotpRecoveryCodeEntity } from './user-totp-recovery-code.entity.js';
import {
  BeforeCreate,
  BeforeUpdate,
  Entity,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

@Entity({
  tableName: 'user',
  comment: 'Registered users',
  repository: () => UserRepository,
})
export class UserEntity extends BaseEntity {
  [EntityRepositoryType]?: UserRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  @Index({
    name: 'user_email_unique',
    properties: ['email'],
    options: { unique: true },
  })
  @Property({
    type: t.string,
    name: 'email',
    comment: 'User email address',
    nullable: false,
  })
  public email: string;

  @Property({
    type: t.boolean,
    name: 'email_verified',
    comment: "Whether the user's email has been verified",
    nullable: false,
    default: false,
  })
  public email_verified: Opt<boolean> = false;

  @Property({
    type: t.string,
    name: 'password_hash',
    comment: 'Hashed password for local authentication',
    nullable: true,
    lazy: true,
    hidden: true,
    default: null,
  })
  public password_hash: string | null = null;

  @Property({
    type: t.string,
    name: 'managed_by',
    comment: 'Data source: config (from YAML) or database (runtime created)',
    nullable: false,
    default: 'database',
  })
  public managed_by: Opt<'config' | 'database'> = 'database';

  @Property({
    type: t.string,
    name: 'role',
    comment: 'User role: user or admin',
    nullable: false,
    default: 'user',
  })
  public role: Opt<'user' | 'admin'> = 'user';

  @Index({
    name: 'user_deleted_at_idx',
    properties: ['deleted_at'],
  })
  @Property({
    type: t.datetime,
    name: 'deleted_at',
    comment: 'Timestamp when the user requested account deletion (soft delete)',
    nullable: true,
    default: null,
  })
  public deleted_at: Date | null = null;

  public constructor(params: {
    id?: string;
    email: string;
    password_hash?: string | null;
  }) {
    super();
    if (params.id) {
      this.id = params.id;
    }
    this.email = params.email;
    if (params.password_hash !== undefined) {
      this.password_hash = params.password_hash;
    }
  }

  @BeforeCreate()
  @BeforeUpdate()
  async hashPassword(args: EventArgs<UserEntity>) {
    // hash only if the password was changed
    const password = args.changeSet?.payload.password_hash;

    if (password) {
      this.password_hash = await hash(password as string);
    }
  }

  async verifyPassword(password: string) {
    if (!this.password_hash) {
      return false;
    }
    return verify(this.password_hash, password);
  }

  /**
   * Check if user has a password set
   */
  hasPassword(): boolean {
    return this.password_hash !== null;
  }

  @OneToMany(
    () => UserOAuthEntity,
    (userOAuth) => userOAuth.user,
  )
  public oauthAccounts = new Collection<UserOAuthEntity>(this);

  @OneToMany(
    () => UserPasskeyEntity,
    (passkey) => passkey.user,
  )
  public passkeys = new Collection<UserPasskeyEntity>(this);

  @OneToMany(
    () => UserTotpEntity,
    (totp) => totp.user,
  )
  public totps = new Collection<UserTotpEntity>(this);

  @OneToMany(
    () => UserTotpRecoveryCodeEntity,
    (recoveryCode) => recoveryCode.user,
  )
  public totpRecoveryCodes = new Collection<UserTotpRecoveryCodeEntity>(this);
}
