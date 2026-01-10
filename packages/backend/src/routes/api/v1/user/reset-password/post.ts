import z from 'zod/v4';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Reset password',
      description: 'Resets the user password using a valid reset token.',
      tags: ['User'],
      body: z.object({
        token: z.string().min(1).describe('Password reset token'),
        password: f.userPassword,
      }),
      response: {
        200: z.object({
          message: z.string(),
        }),
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
