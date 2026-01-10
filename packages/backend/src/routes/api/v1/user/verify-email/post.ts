import z from 'zod/v4';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify Email',
      description: 'Verify user email with verification token',
      tags: ['User'],
      body: z.object({
        token: z.string().min(1, 'Token is required'),
      }),
      response: {
        200: z.object({
          user: r.UserSession,
          message: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const user = await fastify.emailVerificationService.verifyEmail(
        req.body.token,
      );

      // Create session after successful verification
      req.session.set('user', {
        id: user.id,
      });

      res.status(200).send({
        user: {
          id: user.id,
          managed: 'database',
          email: user.email,
          email_verified: user.email_verified,
        },
        message: 'Email verified successfully. You are now logged in.',
      });
    },
  });
