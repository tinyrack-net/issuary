import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get Session',
      description: 'Get Session',
      tags: [TAGS.USER],
      response: {
        200: r.AuthResponse,
      },
    },
    handler: async (req, res) => {
      try {
        const user = await req.auth.verify();

        const secondFactorRequired =
          fastify.userService.user2FASetupRequired(user);
        const available2FAMethods =
          fastify.userService.getAvailable2FASetupMethods();

        const needsSecondFactorSetup =
          secondFactorRequired &&
          available2FAMethods.length > 0 &&
          !user.totp_enabled &&
          user.passkey_count === 0;

        const userSession = {
          id: user.id,
          managed_by: user.managed_by,
          email: user.email,
          email_verified: user.email_verified,
          has_password: user.has_password,
          totp_enabled: user.totp_enabled,
          second_factor_required: user.second_factor_required,
          passkey_count: user.passkey_count,
        };

        // Case 1: 2FA setup required
        if (needsSecondFactorSetup) {
          return res.status(200).send({
            status: '2fa_setup_required',
            available_methods: available2FAMethods,
          });
        }

        // Case 2: Authenticated
        return res.status(200).send({
          status: 'authenticated',
          user: userSession,
        });
      } catch {
        // Case 3: Unauthenticated
        return res.status(200).send({
          status: 'unauthenticated',
        });
      }
    },
  });
