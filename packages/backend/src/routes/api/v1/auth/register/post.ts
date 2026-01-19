import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.app.public_registration) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Register',
      description: 'Register a new user and send email verification',
      tags: [TAGS.AUTH],
      body: z.object({
        email: f.userEmail,
        password: f.userPassword,
      }),
      response: {
        200: r.UserSessionResponse,
        400: e.ValidationError.Schema,
        403: e.RegistrationDisabled.Schema,
        409: e.EmailAlreadyExists.Schema,
      },
    },
    handler: async (req, res) => {
      const { emailVerificationRequired, userSession } =
        await fastify.userService.register({
          email: req.body.email,
          password: req.body.password,
        });

      const secondFactorRequired =
        fastify.userService.user2FASetupRequired(userSession);

      if (emailVerificationRequired) {
        if (secondFactorRequired) {
          req.session.set('pending2FASetup', {
            id: userSession.id,
          });
        } else {
          req.session.set('user', {
            id: userSession.id,
            authenticated_at: Math.floor(Date.now() / 1000),
          });
        }
      }

      res.status(200).send({
        user: userSession,
        second_factor_setup_required: secondFactorRequired,
      });
    },
  });
};
