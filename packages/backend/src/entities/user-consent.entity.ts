import {
  Entity,
  EntityRepositoryType,
  Index,
  type Opt,
  PrimaryKey,
  Property,
  t,
  Unique,
} from '@mikro-orm/core';
import { UserConsentRepository } from '@/repositories/user-consent.repository.js';
import { BaseEntity } from './base.entity.js';

/**
 * UserConsentEntity stores user consent decisions for OAuth clients.
 *
 * When a user grants consent to an OAuth client for specific scopes,
 * this entity records that decision. Future authorization requests
 * from the same client with the same or subset of scopes can skip
 * the consent screen (unless prompt=consent is specified).
 *
 * Note: user_id is stored as a string to support both database users
 * and config-based users (which don't exist in the database).
 */
@Entity({
  tableName: 'user_consent',
  comment: 'User consent decisions for OAuth clients',
  repository: () => UserConsentRepository,
})
@Unique({ properties: ['user_id', 'client_id'], name: 'user_consent_unique' })
export class UserConsentEntity extends BaseEntity {
  [EntityRepositoryType]?: UserConsentRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  @Index({ name: 'user_consent_user_id_index' })
  @Property({
    type: t.string,
    name: 'user_id',
    comment: 'User ID who granted consent (can be config-based or DB user)',
    nullable: false,
  })
  public user_id!: string;

  @Index({ name: 'user_consent_client_id_index' })
  @Property({
    type: t.string,
    name: 'client_id',
    comment: 'OAuth client ID that received consent',
    nullable: false,
  })
  public client_id!: string;

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

  public constructor(init?: {
    user_id: string;
    client_id: string;
    scopes: string[];
  }) {
    super();
    if (init) {
      this.user_id = init.user_id;
      this.client_id = init.client_id;
      this.scopes = init.scopes;
    }
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

  /**
   * Check if consent is active (not revoked)
   */
  public isActive(): boolean {
    return this.revoked_at === null || this.revoked_at === undefined;
  }
}
