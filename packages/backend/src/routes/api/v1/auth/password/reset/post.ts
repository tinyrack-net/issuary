import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.mail) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '/auth/password/reset',
    schema: {
      summary: 'Reset password',
      description: 'Resets the user password using a valid reset token.',
      tags: [TAGS.AUTH],
      body: z.object({
        token: f.token,
        password: f.userPassword,
      }),
      response: {
        200: r.MessageResponse,
        400: e.InvalidPasswordResetToken.Schema,
        403: e.UserNotEditable.Schema,
      },
    },
    handler: async (req, res) => {
      const { token, password } = req.body;

      await fastify.passwordResetService.resetPassword({
        token,
        password,
      });

      res.status(200).send({
        message: 'Password has been reset successfully.',
      });
    },
  });
};
