import { UserTotpRecoveryCodeRepository } from '@backend/repositories/user-totp-recovery-code.repository.js';
import {
  Entity,
  EntityRepositoryType,
  ManyToOne,
  type Opt,
  PrimaryKey,
  Property,
  type Ref,
  ref,
  t,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({
  tableName: 'user_totp_recovery_code',
  comment: 'One-time recovery codes for TOTP two-factor authentication',
  repository: () => UserTotpRecoveryCodeRepository,
})
export class UserTotpRecoveryCodeEntity extends BaseEntity {
  [EntityRepositoryType]?: UserTotpRecoveryCodeRepository;

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
    index: 'user_totp_recovery_code_user_id_idx',
  })
  public user: Ref<UserEntity>;

  @Property({
    type: t.string,
    name: 'code_hash',
    comment: 'Argon2 hashed recovery code',
    nullable: false,
  })
  public code_hash: string;

  @Property({
    type: t.boolean,
    name: 'used',
    comment: 'Whether this recovery code has been used',
    nullable: false,
    default: false,
  })
  public used: Opt<boolean> = false;

  @Property({
    type: t.datetime,
    name: 'used_at',
    comment: 'Timestamp when this recovery code was used',
    nullable: true,
    default: null,
  })
  public used_at: Date | null = null;

  public constructor(params: { userId: string; code_hash: string }) {
    super();
    this.user = ref(UserEntity, params.userId);
    this.code_hash = params.code_hash;
  }
}
