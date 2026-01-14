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
    url: '',
    schema: {
      summary: 'Verify Email',
      description: 'Verify user email with verification token',
      tags: [TAGS.AUTH],
      body: z.object({
        token: f.token,
      }),
      response: {
        200: r.UserSessionResponse,
        400: e.InvalidVerificationToken.Schema,
      },
    },
    handler: async (req, res) => {
      if (!fastify.emailVerificationService) {
        throw new e.EmailNotActivated.Error();
      }

      const user = await fastify.emailVerificationService.verifyEmail(req.body.token);

      // Populate password_hash to check if password is set
      await fastify.mikro.em.populate(user, ['password_hash']);

      // Check if TOTP is enabled for the user
      const totpEnabled = await fastify.mikro.userTotp.isEnabled(user.id);

      // Get passkey count for the user
      const passkeyCount = await fastify.mikro.userPasskey.countByUserId(
        user.id,
      );

      // Check if TOTP is required (only for database-managed users without TOTP)
      const passwordAuthMethod =
        fastify.config.basic_authentication_methods.password;
      const totpRequired =
        (passwordAuthMethod.totp?.required ?? false) && !totpEnabled;

      // Create session based on TOTP requirement
      if (totpRequired) {
        // Set pending TOTP setup session instead of full session
        req.session.set('pendingTotpSetup', {
          id: user.id,
        });
      } else {
        // Create full session after successful verification
        req.session.set('user', {
          id: user.id,
        });
      }

      res.status(200).send({
        user: {
          id: user.id,
          managed: 'database',
          email: user.email,
          email_verified: user.email_verified,
          has_password: user.hasPassword(),
          totp_enabled: totpEnabled,
          totp_required: totpRequired,
          passkey_count: passkeyCount,
        },
      });
    },
  });
};
