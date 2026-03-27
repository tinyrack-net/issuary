import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { UserTermsConsentRepository } from '../repositories/user-terms-consent.repository.ts';
import { BaseSchema } from './base.entity.ts';
import { TermsEntitySchema } from './terms.entity.ts';
import { UserEntitySchema } from './user.entity.ts';

/**
 * UserTermsConsentEntity stores user consent records for terms of service.
 *
 * Each record represents a user's agreement (or disagreement for optional terms)
 * to a specific version of a term. When terms are updated to a new version,
 * users need to consent to the new version.
 */
export const UserTermsConsentEntitySchema = defineEntity({
  name: 'UserTermsConsentEntity',
  tableName: 'user_terms_consent',
  comment: 'User consent records for terms of service',
  extends: BaseSchema,
  repository: () => UserTermsConsentRepository,
  properties: (p) => ({
    id: p
      .uuid()
      .primary()
      .comment('Primary key as UUID')
      .onCreate(() => crypto.randomUUID()),
    user: () =>
      p
        .manyToOne(UserEntitySchema)
        .comment('Reference to the user who gave consent')
        .index('user_terms_consent_user_sub_index')
        .deleteRule('cascade'),
    terms: () =>
      p
        .manyToOne(TermsEntitySchema)
        .comment('Reference to the terms')
        .index('user_terms_consent_terms_id_index')
        .deleteRule('cascade'),
    termsVersion: p.string().comment('Version of the term that was agreed to'),
    agreed: p.boolean().comment('Whether the user agreed to the term'),
    consentType: p
      .string()
      .$type<'explicit' | 'implicit'>()
      .comment('How consent was obtained: explicit (checkbox) or implicit'),
    agreedAt: p
      .datetime()
      .comment('Timestamp when consent was given')
      .onCreate(() => new Date()),
  }),
  indexes: [
    {
      name: 'user_terms_consent_user_terms_index',
      properties: ['user', 'terms'],
    },
  ],
});

export type IUserTermsConsentEntity = InferEntity<
  typeof UserTermsConsentEntitySchema
>;

export class UserTermsConsentEntity extends UserTermsConsentEntitySchema.class {
  /**
   * Get the terms ID (for backward compatibility)
   */
  public get termsId(): string {
    return this.terms.id;
  }
}

UserTermsConsentEntitySchema.setClass(UserTermsConsentEntity);
