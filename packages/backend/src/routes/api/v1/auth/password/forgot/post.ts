import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  // Only enable if email service is available
  if (!fastify.mail) {
    return;
  }

  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Request password reset',
      description:
        'Sends a password reset email to the user. Always returns success to prevent email enumeration.',
      tags: [TAGS.AUTH],
      body: z.object({
        email: f.userEmail,
      }),
      response: {
        200: r.OkResponse,
        403: e.UserNotEditable.Schema,
      },
    },
    handler: async (req, res) => {
      const { email } = req.body;
      try {
        const resetEntity =
          await fastify.passwordResetService.requestPasswordReset(email);

        if (resetEntity) {
          fastify.emailService.sendPasswordResetEmailAsync({
            email,
            token: resetEntity.token,
          });
        }

        res.status(200).send({
          ok: true,
        });
      } catch (error) {
        // Always return success to prevent email enumeration
        if (
          error instanceof e.UserNotEditable.Error ||
          error instanceof e.UserNotFound.Error
        ) {
          res.status(200).send({
            ok: true,
          });
        } else {
          throw error;
        }
      }
    },
  });
};
