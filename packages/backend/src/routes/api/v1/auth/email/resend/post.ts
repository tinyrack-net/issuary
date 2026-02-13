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
    url: '/auth/email/resend',
    schema: {
      summary: 'Resend Verification Email',
      description: 'Resend email verification link to user',
      tags: [TAGS.AUTH],
      headers: z.object({
        'accept-language': f.acceptLanguage,
      }),
      body: z.object({
        email: f.userEmail,
      }),
      response: {
        200: r.MessageResponse,
        400: e.EmailAlreadyVerified.Schema,
        404: e.UserNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      if (!fastify.emailVerificationService) {
        throw new e.EmailNotActivated.Error();
      }

      const verification =
        await fastify.emailVerificationService.resendVerification(
          req.body.email,
        );

      fastify.emailService.sendVerificationEmailAsync({
        email: req.body.email,
        token: verification.token,
        locale: req.headers['accept-language'],
      });

      res.status(200).send({
        message: 'Verification email has been resent. Please check your inbox.',
      });
    },
  });
};
