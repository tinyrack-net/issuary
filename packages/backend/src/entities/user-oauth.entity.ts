import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  type RequiredNullable,
  t,
} from '@mikro-orm/core';
import { UserOAuthRepository } from '@/repositories/user-oauth.repository.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({
  tableName: 'user_oauth',
  comment: 'OAuth accounts linked to users',
  repository: () => UserOAuthRepository,
})
export class UserOAuthEntity extends BaseEntity {
  @PrimaryKey({
    type: t.bigint,
    name: 'id',
    comment: 'Primary key as auto-incrementing bigint',
    nullable: false,
    autoincrement: true,
  })
  public id!: string;

  @ManyToOne({
    entity: () => UserEntity,
    nullable: false,
    name: 'user_id',
    comment: 'Reference to the user',
  })
  public user!: UserEntity;

  @Property({
    type: t.string,
    name: 'provider_name',
    comment: 'Name of the OAuth provider (e.g., google, facebook)',
    nullable: false,
  })
  public provider_name!: string;

  @Property({
    type: t.string,
    name: 'provider_user_id',
    comment: 'Unique user ID from the OAuth provider',
    nullable: false,
  })
  public provider_user_id!: string;

  @Property({
    type: t.string,
    name: 'access_token',
    comment: 'OAuth access token',
    nullable: false,
  })
  public access_token!: string;

  @Property({
    type: t.string,
    name: 'refresh_token',
    comment: 'OAuth refresh token',
    nullable: false,
  })
  public refresh_token!: string;

  @Property({
    type: t.datetime,
    name: 'expires_at',
    comment: 'Access token expiry timestamp',
    nullable: true,
  })
  public expires_at: RequiredNullable<Date> = null;
}
