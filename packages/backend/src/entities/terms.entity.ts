import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { TermsRepository } from '#backend/repositories/terms.repository.js';
import { BaseSchema } from './base.entity.js';
import { TermsContentEntitySchema } from './terms-content.entity.js';
import { UserTermsConsentEntitySchema } from './user-terms-consent.entity.js';

/**
 * TermsEntity stores terms of service definitions.
 *
 * Terms can be managed via config.yaml (managed_by='config') or
 * created at runtime via database (managed_by='database').
 */
export const TermsEntitySchema = defineEntity({
  name: 'TermsEntity',
  tableName: 'terms',
  comment: 'Terms of service definitions',
  extends: BaseSchema,
  repository: () => TermsRepository,
  properties: (p) => ({
    id: p
      .string()
      .primary()
      .comment('Unique identifier (e.g., "tos", "privacy")'),
    required: p
      .boolean()
      .comment('Whether agreement is mandatory')
      .default(true),
    consentMode: p
      .string()
      .$type<'explicit' | 'implicit'>()
      .comment('Consent mode: explicit (checkbox) or implicit (auto-agree)')
      .default('explicit'),
    version: p.string().comment('Version string (e.g., "1.0.0")'),
    managed_by: p
      .string()
      .$type<'database' | 'config'>()
      .comment('Data source: config or database')
      .default('database'),
    contents: () =>
      p.oneToMany(TermsContentEntitySchema).mappedBy('terms').orphanRemoval(),
    consents: () => p.oneToMany(UserTermsConsentEntitySchema).mappedBy('terms'),
  }),
});

export type ITermsEntity = InferEntity<typeof TermsEntitySchema>;
