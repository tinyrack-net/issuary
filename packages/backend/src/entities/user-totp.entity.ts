import { UserTotpRepository } from '@backend/repositories/user-totp.repository.js';
import {
  EntityRepositoryType,
  type Opt,
  type Ref,
  ref,
  t,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

@Entity({
  tableName: 'user_totp',
  comment: 'User TOTP secrets for two-factor authentication',
  repository: () => UserTotpRepository,
})
@Unique({ properties: ['user'], name: 'user_totp_user_unique' })
export class UserTotpEntity extends BaseEntity {
  [EntityRepositoryType]?: UserTotpRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  @ManyToOne({
    entity: () => UserEntity,
    name: 'user_id',
    comment: 'Reference to the user',
    nullable: false,
    deleteRule: 'cascade',
    ref: true,
  })
  public user: Ref<UserEntity>;

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

  @Property({
    type: t.boolean,
    name: 'recovery_confirmed',
    comment: 'Whether the user has confirmed saving recovery codes',
    nullable: false,
    default: false,
  })
  public recovery_confirmed: Opt<boolean> = false;

  public constructor(params: { userId: string; secret: string }) {
    super();
    this.user = ref(UserEntity, params.userId);
    this.secret = params.secret;
  }
}
