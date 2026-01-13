import {
  Entity,
  EntityRepositoryType,
  ManyToOne,
  type Opt,
  PrimaryKey,
  Property,
  type Rel,
  t,
  Unique,
} from '@mikro-orm/core';
import { UserTotpRepository } from '@/repositories/user-totp.repository.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({
  tableName: 'user_totp',
  comment: 'User TOTP secrets for two-factor authentication',
  repository: () => UserTotpRepository,
})
@Unique({ properties: ['user'] })
export class UserTotpEntity extends BaseEntity {
  [EntityRepositoryType]?: UserTotpRepository;

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

  @Property({
    type: t.string,
    name: 'secret',
    comment: 'TOTP secret key (base32 encoded)',
    nullable: false,
    hidden: true,
  })
  public secret: string;

  @Property({
    type: t.boolean,
    name: 'verified',
    comment: 'Whether the TOTP setup has been verified',
    nullable: false,
    default: false,
  })
  public verified: Opt<boolean> = false;

  public constructor(params: { user: UserEntity; secret: string }) {
    super();
    this.user = params.user;
    this.secret = params.secret;
  }
}
