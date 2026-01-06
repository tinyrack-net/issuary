import {
  BeforeCreate,
  BeforeUpdate,
  Collection,
  Entity,
  EntityRepositoryType,
  type EventArgs,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
  t,
} from '@mikro-orm/core';
import { hash, verify } from 'argon2';
import { UserRepository } from '@/repositories/user.repository.js';
import { BaseEntity } from './base.entity.js';
import { UserOAuthEntity } from './user-oauth.entity.js';

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
  public email_verified = false;

  @Property({
    type: t.string,
    name: 'password_hash',
    comment: 'Hashed password for local authentication',
    nullable: false,
    lazy: true,
  })
  public password_hash: string;

  @Property({
    type: t.boolean,
    name: 'editable',
    comment: 'Whether the user account is editable',
    nullable: false,
    default: true,
  })
  public editable: boolean = true;

  @Property({
    type: t.string,
    name: 'totp_secret',
    comment: 'TOTP secret for two-factor authentication',
    nullable: true,
    lazy: true,
    default: null,
  })
  public totp_secret?: string | null = null;

  @Property({
    type: t.json,
    name: 'totp_backup_codes',
    comment: 'Backup codes for two-factor authentication',
    nullable: true,
    lazy: true,
    default: null,
  })
  public totp_backup_codes?: string[] | null = null;

  public constructor({
    email,
    password_hash,
  }: {
    id?: string;
    email: string;
    password_hash: string;
  }) {
    super();
    this.email = email;
    this.password_hash = password_hash;
  }

  @BeforeCreate()
  @BeforeUpdate()
  async hashPassword(args: EventArgs<UserEntity>) {
    // hash only if the password was changed
    const password = args.changeSet?.payload.password_hash;

    if (password) {
      this.password_hash = await hash(password);
    }
  }

  async verifyPassword(password: string) {
    return verify(this.password_hash, password);
  }

  @OneToMany(
    () => UserOAuthEntity,
    (userOAuth) => userOAuth.user,
  )
  public oauthAccounts = new Collection<UserOAuthEntity>(this);
}
