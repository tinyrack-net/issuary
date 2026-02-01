import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.auth.password.enabled) {
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
        200: r.AuthResponse,
        400: e.ValidationError.Schema,
        401: e.InvalidEmailOrPassword.Schema,
        403: e.EmailVerificationRequired.Schema,
      },
    },
    handler: async (req, res) => {
      const userEntity = await fastify.mikro.user.verifyByEmailAndPassword({
        email: req.body.email,
        password: req.body.password,
      });

      if (!(await userEntity.verifyPassword(req.body.password))) {
        throw new e.InvalidEmailOrPassword.Error();
      }

      const userSession =
        await fastify.userService.userEntityToSessionUser(userEntity);

      if (
        fastify.userService.userEmailVerificationRequired(userSession) &&
        !userSession.email_verified
      ) {
        return res.status(200).send({
          user: userSession,
        });
      }

      const userRegistered2FAMethods =
        await fastify.userService.userRegistered2FAMethods(userSession.id);

      if (userRegistered2FAMethods.length > 0) {
        req.setPending2FASession(userSession.id);
      } else if (userSession.second_factor_required) {
        req.setPending2FASetupSession(userSession.id);
      } else {
        req.setUserSession(userSession.id);
      }

      return res.status(200).send({
        user: userSession,
      });
    },
  });
};
