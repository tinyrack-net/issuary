import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { TermsContentRepository } from '#backend/repositories/terms-content.repository.js';
import { BaseSchema } from './base.entity.js';
import { TermsEntitySchema } from './terms.entity.js';

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
export const TermsContentEntitySchema = defineEntity({
  name: 'TermsContentEntity',
  tableName: 'terms_content',
  comment: 'Localized content for terms',
  extends: BaseSchema,
  repository: () => TermsContentRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    terms: () =>
      p
        .manyToOne(TermsEntitySchema)
        .comment('Reference to the terms')
        .deleteRule('cascade'),
    lang: p.string().comment('Language code (e.g., "en", "ko", "ja")'),
    title: p.string().comment('Display title'),
    type: p
      .string()
      .$type<TermsContentType>()
      .comment('Content type: link or text')
      .default('link'),
    content: p
      .text()
      .comment('Content value (URL if type=link, text if type=text)'),
  }),
  uniques: [
    {
      name: 'terms_content_terms_lang_unique',
      properties: ['terms', 'lang'],
    },
  ],
});

export type ITermsContentEntity = InferEntity<typeof TermsContentEntitySchema>;
