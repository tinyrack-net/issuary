import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/auth/totp/recovery/verify
 *
 * Complete login by verifying a TOTP recovery code.
 * Requires pending 2FA session from password login.
 * Each recovery code is single-use and invalidated upon use.
 */
export default (fastify: FastifyWithZodInstance) => {
  if (
    !fastify.config.auth.password.enabled ||
    !fastify.config.auth.password.totp.enabled
  ) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify TOTP recovery code for login',
      description:
        'Complete login by verifying a one-time TOTP recovery code. ' +
        'Requires pending 2FA session from password login. ' +
        'Each recovery code can only be used once.',
      tags: [TAGS.AUTH],
      body: z.object({
        code: f.recoveryCode,
      }),
      response: {
        200: r.UserSessionResponse,
        400: z.union([
          e.ValidationError.Schema,
          e.InvalidRecoveryCode.Schema,
          e.NoRecoveryCodesAvailable.Schema,
          e.TotpNotEnabled.Schema,
        ]),
        401: e.SecondFactorSessionExpired.Schema,
      },
    },
    handler: async (req, res) => {
      const pending2FAUser = req.session.get('pending2FAUser');

      if (!pending2FAUser) {
        throw new e.SecondFactorSessionExpired.Error();
      }

      await fastify.totpService.verifyRecoveryCode(
        pending2FAUser.id,
        req.body.code,
      );

      const userEntity = await fastify.mikro.user.verifyById(pending2FAUser.id);
      const user =
        await fastify.userService.userEntityToSessionUser(userEntity);

      const authTime =
        pending2FAUser.authenticated_at ?? Math.floor(Date.now() / 1000);

      req.setUserSession(user.id, authTime);

      return res.status(200).send({
        user,
      });
    },
  });
};
