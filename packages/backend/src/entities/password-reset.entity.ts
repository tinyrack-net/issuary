import {
  Entity,
  EntityRepositoryType,
  Index,
  ManyToOne,
  type Opt,
  PrimaryKey,
  Property,
  t,
} from '@mikro-orm/core';
import { PasswordResetRepository } from '@/repositories/password-reset.repository.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({
  tableName: 'password_reset',
  comment: 'Password reset tokens for user password recovery',
  repository: () => PasswordResetRepository,
})
export class PasswordResetEntity extends BaseEntity {
  [EntityRepositoryType]?: PasswordResetRepository;

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
  })
  public user!: UserEntity;

  @Index({
    name: 'password_reset_token_idx',
    properties: ['token'],
    options: { unique: true },
  })
  @Property({
    type: t.string,
    name: 'token',
    comment: 'Unique password reset token',
    nullable: false,
  })
  public token!: string;

  @Property({
    type: t.datetime,
    name: 'expires_at',
    comment: 'Token expiration timestamp',
    nullable: false,
  })
  public expiresAt!: Date;

  @Property({
    type: t.boolean,
    name: 'used',
    comment: 'Whether the token has been used',
    nullable: false,
    default: false,
  })
  public used: Opt<boolean> = false;

  @Property({
    type: t.datetime,
    name: 'used_at',
    comment: 'Timestamp when the token was used',
    nullable: true,
    default: null,
  })
  public usedAt?: Date | null = null;
}
