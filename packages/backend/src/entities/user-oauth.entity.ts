import {
  Entity,
  EntityRepositoryType,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  type Ref,
  type RequiredNullable,
  ref,
  t,
  Unique,
} from '@mikro-orm/core';
import { UserOAuthRepository } from '@/repositories/user-oauth.repository.js';
import { BaseEntity } from './base.entity.js';
import { UserEntity } from './user.entity.js';

@Entity({
  tableName: 'user_oauth',
  comment: 'OAuth accounts linked to users',
  repository: () => UserOAuthRepository,
})
@Unique({
  properties: ['provider_name', 'provider_user_id'],
  name: 'user_oauth_provider_unique',
})
@Index({
  properties: ['user', 'provider_name'],
  name: 'user_oauth_user_provider_idx',
})
export class UserOAuthEntity extends BaseEntity {
  [EntityRepositoryType]?: UserOAuthRepository;

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
    ref: true,
    index: 'user_oauth_user_id_idx',
  })
  public user: Ref<UserEntity>;

  @Property({
    type: t.string,
    name: 'provider_name',
    comment: 'Name of the OAuth provider (e.g., google, facebook)',
    nullable: false,
  })
  public provider_name: string;

  @Property({
    type: t.string,
    name: 'provider_user_id',
    comment: 'Unique user ID from the OAuth provider',
    nullable: false,
  })
  public provider_user_id: string;

  @Property({
    type: t.string,
    name: 'access_token',
    comment: 'OAuth access token',
    nullable: false,
  })
  public access_token: string;

  @Property({
    type: t.string,
    name: 'refresh_token',
    comment: 'OAuth refresh token',
    nullable: false,
  })
  public refresh_token: string;

  @Property({
    type: t.datetime,
    name: 'expires_at',
    comment: 'Access token expiry timestamp',
    nullable: true,
  })
  public expires_at: RequiredNullable<Date> = null;

  public constructor(params: {
    userId: string;
    provider_name: string;
    provider_user_id: string;
    access_token: string;
    refresh_token: string;
    expires_at?: Date | null;
  }) {
    super();
    this.user = ref(UserEntity, params.userId);
    this.provider_name = params.provider_name;
    this.provider_user_id = params.provider_user_id;
    this.access_token = params.access_token;
    this.refresh_token = params.refresh_token;
    this.expires_at = params.expires_at ?? null;
  }
}
