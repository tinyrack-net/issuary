import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * DELETE /api/v1/user/totp
 *
 * Disable TOTP two-factor authentication.
 * Requires the current TOTP code for security verification.
 */
export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'DELETE',
    url: '',
    schema: {
      summary: 'Disable TOTP',
      description:
        'Disable TOTP two-factor authentication for the current user. ' +
        'Requires a valid TOTP code from the authenticator app.',
      tags: [TAGS.USER],
      body: z.object({
        code: f.totpCode,
      }),
      response: {
        200: r.OkResponse,
        400: z.union([
          e.TotpNotEnabled.Schema,
          e.InvalidTotpCode.Schema,
          e.CannotRemoveLastSecondFactor.Schema,
        ]),
        401: e.Unauthorized.Schema,
        403: e.SecondFactorNotAllowedForConfigUser.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      // Config users cannot manage 2FA
      if (userSession.managed_by === 'config') {
        throw new e.SecondFactorNotAllowedForConfigUser.Error();
      }

      // Check if 2FA is required
      const secondFactorRequired =
        fastify.config.auth.password.second_factor.required;

      // Check if user has other 2FA method (passkey)
      const passkeyCount = await fastify.mikro.userPasskey.countByUserId(
        userSession.id,
      );
      const hasOtherSecondFactor = passkeyCount > 0;

      await fastify.totpService.disable(userSession.id, req.body.code, {
        secondFactorRequired,
        hasOtherSecondFactor,
      });

      return res.status(200).send({ ok: true });
    },
  });
