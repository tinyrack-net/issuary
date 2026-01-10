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
import { EmailVerificationRepository } from '@/repositories/email-verification.repository.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({
  tableName: 'email_verification',
  comment: 'Email verification tokens for user registration',
  repository: () => EmailVerificationRepository,
})
export class EmailVerificationEntity extends BaseEntity {
  [EntityRepositoryType]?: EmailVerificationRepository;

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
    name: 'email_verification_token_idx',
    properties: ['token'],
    options: { unique: true },
  })
  @Property({
    type: t.string,
    name: 'token',
    comment: 'Unique verification token',
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
    name: 'verified',
    comment: 'Whether the token has been used',
    nullable: false,
    default: false,
  })
  public verified: Opt<boolean> = false;

  @Property({
    type: t.datetime,
    name: 'verified_at',
    comment: 'Timestamp when the email was verified',
    nullable: true,
    default: null,
  })
  public verifiedAt?: Date | null = null;
}
