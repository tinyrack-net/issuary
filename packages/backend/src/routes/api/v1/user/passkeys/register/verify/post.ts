import z from 'zod/v4';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * Zod schema for WebAuthn RegistrationResponseJSON
 * Uses passthrough() to accept the full WebAuthn response structure
 */
const RegistrationResponseSchema = z
  .object({
    id: z.string(),
    rawId: z.string(),
    response: z
      .object({
        clientDataJSON: z.string(),
        attestationObject: z.string(),
      })
      .passthrough(),
    type: z.literal('public-key'),
  })
  .passthrough();

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify Passkey Registration',
      description: 'Verify and complete passkey registration',
      tags: [TAGS.USER],
      body: z.object({
        response: RegistrationResponseSchema,
        name: z.string().max(100).optional(),
      }),
      response: {
        200: r.SuccessResponse,
        400: z.union([
          e.PasskeyNotEnabled.Schema,
          e.PasskeyChallengeNotFound.Schema,
          e.PasskeyVerificationFailed.Schema,
        ]),
        401: e.Unauthorized.Schema,
        409: e.PasskeyAlreadyExists.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if passkey is enabled
      if (!fastify.passkeyService.isEnabled(fastify.config)) {
        throw new e.PasskeyNotEnabled.Error();
      }

      const userSession = await req.auth.verify();

      // Get challenge from session
      const challenge = req.session.get('passkey_challenge');
      if (!challenge) {
        throw new e.PasskeyChallengeNotFound.Error();
      }

      // Get user entity
      const user = await fastify.mikro.user.findOneOrFail({
        id: userSession.id,
      });

      // The validated body already conforms to RegistrationResponseJSON structure
      // Use type assertion since Zod validation guarantees the structure
      const registrationResponse =
        req.body.response as unknown as RegistrationResponseJSON;

      // Verify registration
      await fastify.passkeyService.verifyRegistration(
        user,
        registrationResponse,
        challenge,
        req.body.name,
      );

      // Clear challenge from session
      req.session.set('passkey_challenge', undefined);

      return res.status(200).send({
        success: true,
      });
    },
  });
