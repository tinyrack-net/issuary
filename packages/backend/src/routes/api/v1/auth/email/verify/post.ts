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
        200: r.AuthResponse,
        400: e.InvalidVerificationToken.Schema,
      },
    },
    handler: async (req, res) => {
      if (!fastify.emailVerificationService) {
        throw new e.EmailNotActivated.Error();
      }

      const user = await fastify.emailVerificationService.verifyEmail(
        req.body.token,
      );

      await fastify.mikro.em.populate(user, ['password_hash']);

      const totpEnabled = await fastify.mikro.userTotp.isRegistered(user.id);
      const passkeyCount = await fastify.mikro.userPasskey.countByUserId(
        user.id,
      );

      // Check if 2FA setup is required
      const secondFactorRequired =
        fastify.userService.user2FASetupRequired(user);
      const available2FAMethods =
        fastify.userService.getAvailable2FASetupMethods();

      const userSession = {
        id: user.id,
        managed_by: 'database' as const,
        email: user.email,
        email_verified: user.email_verified,
        email_verification_required:
          fastify.userService.userEmailVerificationRequired(user),
        has_password: user.hasPassword(),
        totp_enabled:
          fastify.config.basic_authentication_methods.password.totp.enabled,
        totp_registered: totpEnabled,
        second_factor_required: secondFactorRequired,
        passkey_enabled:
          fastify.config.basic_authentication_methods.passkey.enabled,
        passkey_count: passkeyCount,
      };

      // Case 1: 2FA setup required (user has no 2FA methods set up)
      if (
        secondFactorRequired &&
        !totpEnabled &&
        passkeyCount === 0 &&
        available2FAMethods.length > 0
      ) {
        req.session.set('pending2FASetup', {
          id: user.id,
        });
        return res.status(200).send({
          user: userSession,
        });
      }

      // Case 2: Success - email verified and fully authenticated
      req.session.set('user', {
        id: user.id,
        authenticated_at: Math.floor(Date.now() / 1000),
      });
      res.status(200).send({
        user: userSession,
      });
    },
  });
};
