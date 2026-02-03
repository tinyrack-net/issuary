import z from 'zod/v4';

/**
 * User consent status for a term
 */
const TermsUserConsent = z
  .object({
    agreed: z.boolean().describe('Whether the user agreed to this term'),
    agreedVersion: z
      .string()
      .nullable()
      .describe('Version of the term the user agreed to'),
    agreedAt: z
      .string()
      .datetime()
      .nullable()
      .describe('When the user agreed to the term'),
    consentType: z
      .enum(['explicit', 'implicit'])
      .nullable()
      .describe('How consent was obtained'),
    requiresUpdate: z
      .boolean()
      .describe('Whether the user needs to re-consent due to version change'),
  })
  .describe('User consent status');

/**
 * Content type for terms content
 */
const TermsContentType = z
  .enum(['link', 'text'])
  .describe('Content type: link (URL) or text (inline content)');

/**
 * Term item with localized content and user consent status
 */
const TermItem = z
  .object({
    id: z.string().describe('Unique identifier for the term'),
    required: z.boolean().describe('Whether this term is mandatory'),
    consentMode: z
      .enum(['explicit', 'implicit'])
      .describe(
        'Consent mode: explicit (checkbox required) or implicit (auto-agree)',
      ),
    version: z.string().describe('Version of the term'),
    effectiveDate: z
      .string()
      .optional()
      .describe('When this version became effective'),
    title: z.string().describe('Localized title'),
    type: TermsContentType.describe('How to interpret the content'),
    content: z
      .string()
      .describe('Content value (URL if type=link, text if type=text)'),
    userConsent: TermsUserConsent.nullable().describe(
      'User consent status (null if not logged in)',
    ),
  })
  .describe('Term item with user consent');

/**
 * GET /api/v1/terms response
 */
const TermsResponse = z
  .object({
    terms: z.array(TermItem).describe('List of terms'),
    pendingTerms: z.array(z.string()).describe('Term IDs that require consent'),
  })
  .describe('Terms response');

/**
 * Single consent item in request
 */
const ConsentItem = z.object({
  termsId: z.string().describe('Term ID to consent to'),
  agreed: z.boolean().describe('Whether user agrees to this term'),
  consentType: z
    .enum(['explicit', 'implicit'])
    .optional()
    .describe(
      'How consent was obtained. Defaults to term consentMode if omitted',
    ),
});

/**
 * POST /api/v1/terms/consent request body
 */
const TermsConsentRequest = z
  .object({
    consents: z.array(ConsentItem).min(1).describe('List of consent decisions'),
  })
  .describe('Terms consent request');

/**
 * POST /api/v1/terms/consent response
 */
const TermsConsentResponse = z
  .object({
    ok: z.literal(true),
    recorded: z.number().int().describe('Number of consents recorded'),
    registered: z
      .boolean()
      .optional()
      .describe(
        'True if OAuth registration was completed with this consent submission',
      ),
  })
  .describe('Terms consent response');

export const termsSchema = {
  TermsResponse,
  TermsConsentRequest,
  TermsConsentResponse,
  TermsUserConsent,
  TermItem,
};
