import { f } from '@/schemas/field.js';
import type { FastifyWithZodInstance } from '@/server.js';
import z from 'zod/v4';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.transporter) {
    return;
  }

  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Resend Verification Email',
      description: 'Resend email verification link to user',
      tags: ['Auth'],
      body: z.object({
        email: f.userEmail,
      }),
      response: {
        200: z.object({
          message: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const verification =
        await fastify.emailVerificationService.resendVerification(
          req.body.email,
        );

      // Send verification email asynchronously (fire-and-forget)
      fastify.emailService.sendVerificationEmailAsync({
        email: req.body.email,
        token: verification.token,
      });

      res.status(200).send({
        message: 'Verification email has been resent. Please check your inbox.',
      });
    },
  });
};
