import { UserTermsConsentRepository } from '@backend/repositories/user-terms-consent.repository.js';
import {
  Entity,
  EntityRepositoryType,
  Index,
  ManyToOne,
  type Opt,
  PrimaryKey,
  Property,
  type Ref,
  ref,
  t,
} from '@mikro-orm/core';
import { BaseEntity } from './base.entity.js';
import { TermsEntity } from './terms.entity.js';
import { UserEntity } from './user.entity.js';

/**
 * UserTermsConsentEntity stores user consent records for terms of service.
 *
 * Each record represents a user's agreement (or disagreement for optional terms)
 * to a specific version of a term. When terms are updated to a new version,
 * users need to consent to the new version.
 */
@Entity({
  tableName: 'user_terms_consent',
  comment: 'User consent records for terms of service',
  repository: () => UserTermsConsentRepository,
})
@Index({
  properties: ['user', 'terms'],
  name: 'user_terms_consent_user_terms_index',
})
export class UserTermsConsentEntity extends BaseEntity {
  [EntityRepositoryType]?: UserTermsConsentRepository;

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
    comment: 'Reference to the user who gave consent',
    nullable: false,
    ref: true,
    index: 'user_terms_consent_user_id_index',
    deleteRule: 'cascade',
  })
  public user: Ref<UserEntity>;

  @ManyToOne({
    entity: () => TermsEntity,
    name: 'terms_id',
    comment: 'Reference to the terms',
    nullable: false,
    ref: true,
    index: 'user_terms_consent_terms_id_index',
    deleteRule: 'cascade',
  })
  public terms: Ref<TermsEntity>;

  @Property({
    type: t.string,
    name: 'terms_version',
    comment: 'Version of the term that was agreed to',
    nullable: false,
  })
  public termsVersion: string;

  @Property({
    type: t.boolean,
    name: 'agreed',
    comment: 'Whether the user agreed to the term',
    nullable: false,
  })
  public agreed: boolean;

  @Property({
    type: t.string,
    name: 'consent_type',
    comment: 'How consent was obtained: explicit (checkbox) or implicit',
    nullable: false,
  })
  public consentType: 'explicit' | 'implicit';

  @Property({
    type: t.datetime,
    name: 'agreed_at',
    comment: 'Timestamp when consent was given',
    nullable: false,
  })
  public agreedAt: Opt<Date> = new Date();

  public constructor(params: {
    userId: string;
    termsId: string;
    termsVersion: string;
    agreed: boolean;
    consentType: 'explicit' | 'implicit';
  }) {
    super();
    this.user = ref(UserEntity, params.userId);
    this.terms = ref(TermsEntity, params.termsId);
    this.termsVersion = params.termsVersion;
    this.agreed = params.agreed;
    this.consentType = params.consentType;
  }

  /**
   * Get the terms ID (for backward compatibility)
   */
  public get termsId(): string {
    return this.terms.id;
  }
}
