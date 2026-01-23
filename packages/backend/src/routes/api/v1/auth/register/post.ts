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
        200: r.AuthResponse,
        400: e.ValidationError.Schema,
        403: e.RegistrationDisabled.Schema,
        409: e.EmailAlreadyExists.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await fastify.userService.register({
        email: req.body.email,
        password: req.body.password,
      });

      if (userSession.email_verification_required) {
        return res.status(200).send({
          user: userSession,
        });
      }

      if (userSession.second_factor_required) {
        req.session.set('user', undefined);
        req.session.set('pending2FAUser', undefined);
        req.session.set('pending2FASetup', {
          id: userSession.id,
        });
      } else {
        req.session.set('pending2FASetup', undefined);
        req.session.set('pending2FAUser', undefined);
        req.session.set('user', {
          id: userSession.id,
          authenticated_at: Math.floor(Date.now() / 1000),
        });
      }

      res.status(200).send({
        user: userSession,
      });
    },
  });
};
