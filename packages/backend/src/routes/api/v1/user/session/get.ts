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
        200: r.UserSessionNullableResponse,
      },
    },
    handler: async (req, res) => {
      try {
        const user = await req.auth.verify();
        const secondFactorRequired =
          fastify.userService.userSecondFactorRequired(user);
        const available2FAMethods =
          fastify.userService.getAvailable2FASetupMethods();
        const needsSecondFactorSetup =
          secondFactorRequired &&
          available2FAMethods.length > 0 &&
          !user.totp_enabled &&
          user.passkey_count === 0;

        return res.status(200).send({
          user: {
            id: user.id,
            managed_by: user.managed_by,
            email: user.email,
            email_verified: user.email_verified,
            has_password: user.has_password,
            totp_enabled: user.totp_enabled,
            passkey_count: user.passkey_count,
          },
          second_factor_setup_required: needsSecondFactorSetup,
        });
      } catch {
        return res.status(200).send({
          user: null,
        });
      }
    },
  });
