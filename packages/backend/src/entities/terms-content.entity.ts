import {
  Entity,
  EntityRepositoryType,
  ManyToOne,
  PrimaryKey,
  Property,
  type Ref,
  ref,
  t,
  Unique,
} from '@mikro-orm/core';
import { TermsContentRepository } from '@/repositories/terms-content.repository.js';
import { BaseEntity } from './base.entity.js';
import { TermsEntity } from './terms.entity.js';

/**
 * TermsContentEntity stores localized content for terms.
 *
 * Each term can have multiple content entries, one per language.
 * Content includes title, and optionally a URL or body text.
 */
@Entity({
  tableName: 'terms_content',
  comment: 'Localized content for terms',
  repository: () => TermsContentRepository,
})
@Unique({
  properties: ['terms', 'lang'],
  name: 'terms_content_terms_lang_unique',
})
export class TermsContentEntity extends BaseEntity {
  [EntityRepositoryType]?: TermsContentRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  @ManyToOne({
    entity: () => TermsEntity,
    name: 'terms_id',
    comment: 'Reference to the terms',
    nullable: false,
    ref: true,
    deleteRule: 'cascade',
  })
  public terms: Ref<TermsEntity>;

  @Property({
    type: t.string,
    name: 'lang',
    comment: 'Language code (e.g., "en", "ko", "ja")',
    nullable: false,
  })
  public lang: string;

  @Property({
    type: t.string,
    name: 'title',
    comment: 'Display title',
    nullable: false,
  })
  public title: string;

  @Property({
    type: t.string,
    name: 'url',
    comment: 'URL to full document',
    nullable: true,
  })
  public url: string | null = null;

  @Property({
    type: t.text,
    name: 'body',
    comment: 'Inline body content',
    nullable: true,
  })
  public body: string | null = null;

  public constructor(params: {
    termsId: string;
    lang: string;
    title: string;
    url?: string | null;
    body?: string | null;
  }) {
    super();
    this.terms = ref(TermsEntity, params.termsId);
    this.lang = params.lang;
    this.title = params.title;
    if (params.url !== undefined) {
      this.url = params.url ?? null;
    }
    if (params.body !== undefined) {
      this.body = params.body ?? null;
    }
  }
}
