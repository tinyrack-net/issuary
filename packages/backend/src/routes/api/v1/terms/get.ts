import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { termsSchema } from '@/schemas/terms.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * GET /api/v1/terms
 *
 * Returns list of terms with user consent status.
 * Can be called by both authenticated and unauthenticated users.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get terms of service',
      description:
        'Returns list of terms with consent mode and user consent status. ' +
        'If user is authenticated, includes their consent history.',
      tags: [TAGS.TERMS],
      querystring: z.object({
        lang: z
          .string()
          .default('en')
          .describe('Language code for localized content'),
      }),
      response: {
        200: termsSchema.TermsResponse,
      },
    },
    handler: async (req, res) => {
      const { lang } = req.query;

      const userId = req.session.get('user')?.id || null;

      const terms = await fastify.termsService.getGlobalTermsWithConsent(
        userId,
        lang,
      );

      let pendingTerms: string[] = [];
      if (userId) {
        pendingTerms =
          await fastify.termsService.getPendingRequiredTerms(userId);
      } else {
        pendingTerms = terms.filter((t) => t.required).map((t) => t.id);
      }

      // Check if there are any implicit terms to determine if notice should be shown
      const hasImplicitTerms = terms.some((t) => t.consentMode === 'implicit');
      const implicitNotice = hasImplicitTerms
        ? fastify.termsService.getImplicitNotice(lang)
        : null;

      return res.status(200).send({
        implicitNotice,
        terms: terms.map((t) => ({
          ...t,
          userConsent: t.userConsent
            ? {
                ...t.userConsent,
                agreedAt: t.userConsent.agreedAt?.toISOString() ?? null,
              }
            : null,
        })),
        pendingTerms,
      });
    },
  });
};
