import { UserConsentRepository } from '@backend/repositories/user-consent.repository.js';
import {
  EntityRepositoryType,
  type Opt,
  type Ref,
  ref,
  t,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity.js';
import { OAuthClientEntity } from './oauth-client.entity.js';
import { UserEntity } from './user.entity.js';
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';

/**
 * UserConsentEntity stores user consent decisions for OAuth clients.
 *
 * When a user grants consent to an OAuth client for specific scopes,
 * this entity records that decision. Future authorization requests
 * from the same client with the same or subset of scopes can skip
 * the consent screen (unless prompt=consent is specified).
 */
@Entity({
  tableName: 'user_consent',
  comment: 'User consent decisions for OAuth clients',
  repository: () => UserConsentRepository,
})
@Unique({ properties: ['user', 'client'], name: 'user_consent_unique' })
export class UserConsentEntity extends BaseEntity {
  [EntityRepositoryType]?: UserConsentRepository;

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
    comment: 'Reference to the user who granted consent',
    nullable: false,
    ref: true,
    index: 'user_consent_user_id_index',
  })
  public user: Ref<UserEntity>;

  @ManyToOne({
    entity: () => OAuthClientEntity,
    name: 'client_id',
    comment: 'Reference to the OAuth client that received consent',
    nullable: false,
    ref: true,
    index: 'user_consent_client_id_index',
  })
  public client: Ref<OAuthClientEntity>;

  @Property({
    type: t.json,
    name: 'scopes',
    comment: 'List of scopes the user has consented to',
    nullable: false,
    default: [],
  })
  public scopes: string[] = [];

  @Property({
    type: t.datetime,
    name: 'granted_at',
    comment: 'Timestamp when consent was first granted',
    nullable: false,
  })
  public granted_at: Opt<Date> = new Date();

  @Property({
    type: t.datetime,
    name: 'revoked_at',
    comment: 'Timestamp when consent was revoked (null if active)',
    nullable: true,
  })
  public revoked_at?: Date | null = null;

  public constructor(params: {
    userId: string;
    clientId: string;
    scopes: string[];
  }) {
    super();
    this.user = ref(UserEntity, params.userId);
    this.client = ref(OAuthClientEntity, params.clientId);
    this.scopes = params.scopes;
  }

  /**
   * Check if consent covers all requested scopes
   */
  public hasScopes(requestedScopes: string[]): boolean {
    if (this.revoked_at) {
      return false;
    }
    return requestedScopes.every((scope) => this.scopes.includes(scope));
  }
}
