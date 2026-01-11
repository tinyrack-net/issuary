import z from 'zod/v4';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
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
        200: r.UserSessionResponse,
        400: e.ValidationError.Schema,
        401: e.InvalidEmailOrPassword.Schema,
      },
    },
    handler: async (req, res) => {
      const user = await fastify.userService.login({
        email: req.body.email,
        password: req.body.password,
      });

      req.session.set('user', {
        id: user.id,
      });

      return res.status(200).send({
        user: {
          id: user.id,
          managed: user.managed,
          email: user.email,
          email_verified: true,
        },
      });
    },
  });
