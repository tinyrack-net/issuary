import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * Consent item schema for terms agreement
 */
const ConsentItem = z.object({
  termsId: z.string().describe('Term ID to consent to'),
  agreed: z.boolean().describe('Whether user agrees to this term'),
});

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.app.public_registration) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Register',
      description:
        'Register a new user with terms consent and send email verification',
      tags: [TAGS.AUTH],
      body: z.object({
        email: f.userEmail,
        password: f.userPassword,
        consents: z
          .array(ConsentItem)
          .optional()
          .describe('Terms consent decisions'),
      }),
      response: {
        200: r.AuthResponse,
        400: e.ValidationError.Schema,
        403: e.RegistrationDisabled.Schema,
        409: e.EmailAlreadyExists.Schema,
      },
    },
    handler: async (req, res) => {
      const { email, password, consents } = req.body;

      // Register the user (terms consent validation and recording handled inside)
      const userSession = await fastify.userService.register({
        email,
        password,
        ...(consents && { consents }),
      });

      if (userSession.email_verification_required) {
        return res.status(200).send({
          user: userSession,
        });
      }

      if (userSession.second_factor_required) {
        req.setPending2FASetupSession(userSession.id);
      } else {
        req.setUserSession(userSession.id);
      }

      res.status(200).send({
        user: userSession,
      });
    },
  });
};
