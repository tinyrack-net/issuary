import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { termsSchema } from '@/schemas/terms.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/terms/consent
 *
 * Record user consent for terms of service.
 * Requires authentication.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Submit terms consent',
      description:
        'Record user consent decisions for terms of service. ' +
        'Required terms must be agreed to.',
      tags: [TAGS.TERMS],
      body: termsSchema.TermsConsentRequest,
      response: {
        200: termsSchema.TermsConsentResponse,
        400: e.ValidationError.Schema,
        401: e.Unauthorized.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      const { consents } = req.body;

      const validation =
        await fastify.termsService.validateRequiredConsents(consents);

      if (!validation.valid) {
        throw new e.ValidationError.Error(
          `Missing required terms: ${validation.missingTerms.join(', ')}`,
        );
      }

      const consentMode = fastify.termsService.getConsentMode();
      const recorded = await fastify.termsService.recordConsents({
        userId: userSession.id,
        consents,
        consentType: consentMode,
      });

      return res.status(200).send({
        ok: true,
        recorded: recorded.length,
      });
    },
  });
};
