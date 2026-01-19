import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.basic_authentication_methods.password.enabled) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Login',
      description: 'Login',
      tags: [TAGS.AUTH],
      body: z.object({
        email: f.userEmail,
        password: f.userPassword,
      }),
      response: {
        200: r.LoginResponse,
        400: e.ValidationError.Schema,
        401: e.InvalidEmailOrPassword.Schema,
        403: e.EmailVerificationRequired.Schema,
      },
    },
    handler: async (req, res) => {
      const user = await fastify.userService.verifyUserByEmailAndPassword({
        email: req.body.email,
        password: req.body.password,
      });

      if (
        fastify.userService.userEmailVerificationRequired(user) &&
        !user.email_verified
      ) {
        return res.status(200).send({
          status: 'email_verification_required',
        });
      }

      const user2FASetupRequired =
        fastify.userService.user2FASetupRequired(user);
      const userRegistered2FAMethods =
        await fastify.userService.userRegistered2FAMethods(user.id);
      const available2FAMethods =
        fastify.userService.getAvailable2FASetupMethods();

      if (userRegistered2FAMethods.length > 0) {
        req.session.set('pending2FAUser', {
          id: user.id,
          authenticated_at: Math.floor(Date.now() / 1000),
        });
        return res.status(200).send({
          status: '2fa_required',
          available_methods: userRegistered2FAMethods,
        });
      } else if (user2FASetupRequired) {
        req.session.set('pending2FASetup', {
          id: user.id,
        });
        return res.status(200).send({
          status: '2fa_setup_required',
          available_methods: available2FAMethods,
        });
      }

      req.session.set('user', {
        id: user.id,
        authenticated_at: Math.floor(Date.now() / 1000),
      });

      return res.status(200).send({
        status: 'success',
        user: user,
      });
    },
  });
};
