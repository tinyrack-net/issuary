import z from 'zod/v4';
import { isEmailAllowed } from '@/lib/email-pattern.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import { termsSchema } from '@/schemas/terms.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'POST',
    url: '/auth/register',
    schema: {
      summary: 'Register',
      description:
        'Register a new user with terms consent and send email verification',
      tags: [TAGS.AUTH],
      headers: z.object({
        'accept-language': f.acceptLanguage,
      }),
      body: z.object({
        email: f.userEmail,
        password: f.userPassword,
        consents: z
          .array(termsSchema.ConsentItem)
          .optional()
          .describe('Terms consent decisions'),
      }),
      response: {
        200: r.AuthResponse,
        400: e.ValidationError.Schema,
        403: z.union([
          e.RegistrationDisabled.Schema,
          e.RegistrationEmailNotAllowed.Schema,
        ]),
        409: e.EmailAlreadyExists.Schema,
      },
    },
    handler: async (req, res) => {
      const { email, password, consents } = req.body;
      const { allowed_signup_emails } = fastify.config.app;

      // Check if signup is disabled entirely
      if (allowed_signup_emails.length === 0) {
        throw new e.RegistrationDisabled.Error();
      }

      // Check if the email matches allowed patterns
      if (!isEmailAllowed(email, allowed_signup_emails)) {
        throw new e.RegistrationEmailNotAllowed.Error();
      }

      // Register the user (terms consent validation and recording handled inside)
      const userSession = await fastify.userService.register({
        email,
        password,
        locale: req.headers['accept-language'],
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
