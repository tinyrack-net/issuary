import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import { TAGS } from '@/lib/swagger-tags.js';
import type { FastifyWithZodInstance } from '@/server.js';
import z from 'zod/v4';

export default (fastify: FastifyWithZodInstance) => {
  // Only enable if email service is available
  if (!fastify.transporter) {
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
        200: r.MessageResponse,
        403: e.UserNotEditable.Schema,
      },
    },
    handler: async (req, res) => {
      const { email } = req.body;

      try {
        const resetEntity =
          await fastify.passwordResetService.requestPasswordReset(email);

        if (resetEntity) {
          // Send password reset email asynchronously (fire-and-forget)
          fastify.emailService.sendPasswordResetEmailAsync({
            email,
            token: resetEntity.token,
          });
        }

        // Always return success to prevent email enumeration
        res.status(200).send({
          message:
            'If an account with that email exists, a password reset link has been sent.',
        });
      } catch (error) {
        // If user is not editable (config user), throw the error
        if (error instanceof e.UserNotEditable.Error) {
          throw error;
        }

        // For any other error, still return success to prevent enumeration
        res.status(200).send({
          message:
            'If an account with that email exists, a password reset link has been sent.',
        });
      }
    },
  });
};
