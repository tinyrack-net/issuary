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

      const totpRegistered = await fastify.mikro.userTotp.isRegistered(user.id);
      const registeredPassKeyCount =
        await fastify.mikro.userPasskey.countByUserId(user.id);

      const secondFactorRequired =
        fastify.userService.user2FASetupRequired(user);
      const available2FAMethods =
        fastify.userService.getAvailable2FASetupMethods();

      const userSession: z.infer<typeof r.AuthResponse>['user'] = {
        id: user.id,
        managed_by: 'database' as const,
        email: user.email,
        email_verified: user.email_verified,
        email_verification_required:
          fastify.userService.userEmailVerificationRequired(user),
        has_password: user.hasPassword(),
        totp_registered: totpRegistered,
        second_factor_required: secondFactorRequired,
        passkey_count: registeredPassKeyCount,
      };

      if (
        secondFactorRequired &&
        !totpRegistered &&
        registeredPassKeyCount === 0 &&
        available2FAMethods.length > 0
      ) {
        req.setPending2FASetupSession(user.id);
        return res.status(200).send({
          user: userSession,
        });
      }

      req.setUserSession(user.id);
      res.status(200).send({
        user: userSession,
      });
    },
  });
};
