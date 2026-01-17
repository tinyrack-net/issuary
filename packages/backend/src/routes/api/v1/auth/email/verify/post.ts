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

      const user = await fastify.emailVerificationService.verifyEmail(
        req.body.token,
      );

      await fastify.mikro.em.populate(user, ['password_hash']);

      const totpEnabled = await fastify.mikro.userTotp.isEnabled(user.id);
      const passkeyCount = await fastify.mikro.userPasskey.countByUserId(
        user.id,
      );

      // Check if 2FA setup is required
      const secondFactorRequired =
        fastify.userService.userSecondFactorRequired(user);
      const available2FAMethods: ('totp' | 'passkey')[] = [];
      if (totpEnabled) {
        available2FAMethods.push('totp');
      }
      if (passkeyCount > 0) {
        available2FAMethods.push('passkey');
      }

      if (secondFactorRequired && available2FAMethods.length === 0) {
        req.session.set('pending2FASetup', {
          id: user.id,
        });
      } else {
        req.session.set('user', {
          id: user.id,
          authenticated_at: Math.floor(Date.now() / 1000),
          auth_methods: ['pwd'],
          acr: 'urn:tinyrack:acr:1',
        });
      }

      res.status(200).send({
        user: {
          id: user.id,
          managed_by: 'database',
          email: user.email,
          email_verified: user.email_verified,
          has_password: user.hasPassword(),
          totp_enabled: totpEnabled,
          passkey_count: passkeyCount,
        },
        second_factor_setup_required:
          secondFactorRequired && available2FAMethods.length === 0,
      });
    },
  });
};
