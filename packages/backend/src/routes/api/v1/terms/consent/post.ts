import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { termsSchema } from '@/schemas/terms.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/terms/consent
 *
 * Record user consent for terms of service.
 *
 * This endpoint handles two scenarios:
 * 1. Authenticated user: Records consent for the logged-in user
 * 2. Pending OAuth registration: Completes OAuth signup by creating user
 *    in DB and recording consent (GDPR compliant - user created only after
 *    consent is given)
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Submit terms consent',
      description:
        'Record user consent decisions for terms of service. ' +
        'Required terms must be agreed to. ' +
        'For pending OAuth registration, this also completes user registration.',
      tags: [TAGS.TERMS],
      body: termsSchema.TermsConsentRequest,
      response: {
        200: termsSchema.TermsConsentResponse,
        400: z.union([e.ValidationError.Schema, e.OAuthSessionExpired.Schema]),
        401: e.Unauthorized.Schema,
      },
    },
    handler: async (req, res) => {
      const { consents } = req.body;

      // Check for pending OAuth registration session
      const pendingRegistration = req.session.get('pendingOAuthRegistration');

      if (pendingRegistration) {
        // Check if session has expired
        if (Date.now() > pendingRegistration.expiresAt) {
          req.session.set('pendingOAuthRegistration', undefined);
          throw new e.OAuthSessionExpired.Error();
        }

        // Validate explicit terms consent
        const validation =
          await fastify.termsService.validateExplicitConsents(consents);

        if (!validation.valid) {
          throw new e.ValidationError.Error(
            `Missing required terms: ${validation.missingTerms.join(', ')}`,
          );
        }

        // Complete OAuth registration - creates user in DB with consent
        const result =
          await fastify.oauthConnectService.completeOAuthRegistration({
            providerId: pendingRegistration.providerId,
            tokens: {
              access_token: pendingRegistration.tokens.access_token,
              refresh_token: pendingRegistration.tokens.refresh_token,
              expires_in: pendingRegistration.tokens.expires_in,
              token_type: pendingRegistration.tokens.token_type,
            },
            userInfo: {
              id: pendingRegistration.userInfo.id,
              email: pendingRegistration.userInfo.email,
              email_verified: pendingRegistration.userInfo.email_verified,
              name: pendingRegistration.userInfo.name,
              picture: pendingRegistration.userInfo.picture,
            },
            consents,
          });

        // Set user session
        req.setUserSession(result.user.id);

        // Clear pending registration session
        req.session.set('pendingOAuthRegistration', undefined);

        return res.status(200).send({
          ok: true,
          recorded: consents.length,
          registered: true,
        });
      }

      // Standard flow: authenticated user recording consent
      const userSession = await req.auth.verify();

      // Validate only explicit terms (implicit terms are auto-agreed)
      const validation =
        await fastify.termsService.validateExplicitConsents(consents);

      if (!validation.valid) {
        throw new e.ValidationError.Error(
          `Missing required terms: ${validation.missingTerms.join(', ')}`,
        );
      }

      // Record consents - consentType is determined by each term's consentMode
      const recorded = await fastify.termsService.recordConsents({
        userId: userSession.id,
        consents,
      });

      return res.status(200).send({
        ok: true,
        recorded: recorded.length,
      });
    },
  });
};
