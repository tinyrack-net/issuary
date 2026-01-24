import {
  Collection,
  Entity,
  EntityRepositoryType,
  OneToMany,
  type Opt,
  PrimaryKey,
  Property,
  t,
} from '@mikro-orm/core';
import { TermsRepository } from '@/repositories/terms.repository.js';
import { BaseEntity } from './base.entity.js';
import { TermsContentEntity } from './terms-content.entity.js';
import { UserTermsConsentEntity } from './user-terms-consent.entity.js';

/**
 * TermsEntity stores terms of service definitions.
 *
 * Terms can be managed via config.yaml (managed_by='config') or
 * created at runtime via database (managed_by='database').
 */
@Entity({
  tableName: 'terms',
  comment: 'Terms of service definitions',
  repository: () => TermsRepository,
})
export class TermsEntity extends BaseEntity {
  [EntityRepositoryType]?: TermsRepository;

  @PrimaryKey({
    type: t.string,
    name: 'id',
    comment: 'Unique identifier (e.g., "tos", "privacy")',
    nullable: false,
  })
  public id: string;

  @Property({
    type: t.boolean,
    name: 'required',
    comment: 'Whether agreement is mandatory',
    nullable: false,
    default: true,
  })
  public required: Opt<boolean> = true;

  @Property({
    type: t.boolean,
    name: 'always_explicit',
    comment: 'Show checkbox even in implicit consent mode',
    nullable: false,
    default: false,
  })
  public alwaysExplicit: Opt<boolean> = false;

  @Property({
    type: t.string,
    name: 'version',
    comment: 'Version string (e.g., "1.0.0")',
    nullable: false,
  })
  public version: string;

  @Property({
    type: t.string,
    name: 'managed_by',
    comment: 'Data source: config or database',
    nullable: false,
    default: 'database',
  })
  public managed_by: Opt<'config' | 'database'> = 'database';

  @OneToMany(
    () => TermsContentEntity,
    (content) => content.terms,
    {
      orphanRemoval: true,
    },
  )
  public contents = new Collection<TermsContentEntity>(this);

  @OneToMany(
    () => UserTermsConsentEntity,
    (consent) => consent.terms,
  )
  public consents = new Collection<UserTermsConsentEntity>(this);

  public constructor(params: {
    id: string;
    required?: boolean;
    alwaysExplicit?: boolean;
    version: string;
    managed_by?: 'config' | 'database';
  }) {
    super();
    this.id = params.id;
    if (params.required !== undefined) {
      this.required = params.required;
    }
    if (params.alwaysExplicit !== undefined) {
      this.alwaysExplicit = params.alwaysExplicit;
    }
    this.version = params.version;
    if (params.managed_by !== undefined) {
      this.managed_by = params.managed_by;
    }
  }
}
