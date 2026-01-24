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
 * Content type for terms content.
 * - 'link': Content is a URL to external document
 * - 'text': Content is inline text
 */
export type TermsContentType = 'link' | 'text';

/**
 * TermsContentEntity stores localized content for terms.
 *
 * Each term can have multiple content entries, one per language.
 * Content includes title and content value, with type indicating
 * how to interpret the content (as a link or text).
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
    name: 'type',
    comment: 'Content type: link or text',
    nullable: false,
    default: 'link',
  })
  public type: TermsContentType = 'link';

  @Property({
    type: t.text,
    name: 'content',
    comment: 'Content value (URL if type=link, text if type=text)',
    nullable: false,
  })
  public content: string;

  public constructor(params: {
    termsId: string;
    lang: string;
    title: string;
    type?: TermsContentType;
    content: string;
  }) {
    super();
    this.terms = ref(TermsEntity, params.termsId);
    this.lang = params.lang;
    this.title = params.title;
    this.type = params.type ?? 'link';
    this.content = params.content;
  }
}
