import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.auth.passkey.enabled) {
    return;
  }
  fastify.route({
    method: 'DELETE',
    url: '',
    schema: {
      summary: 'Delete Passkey',
      description: 'Delete a passkey by ID',
      tags: [TAGS.USER],
      params: z.object({
        id: f.uuid,
      }),
      response: {
        200: r.OkResponse,
        400: z.union([
          e.PasskeyNotEnabled.Schema,
          e.CannotRemoveLastPasskey.Schema,
          e.CannotRemoveLastSecondFactor.Schema,
        ]),
        401: e.Unauthorized.Schema,
        403: e.SecondFactorNotAllowedForConfigUser.Schema,
        404: e.PasskeyNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      // Config users cannot manage 2FA
      if (userSession.managed_by === 'config') {
        throw new e.SecondFactorNotAllowedForConfigUser.Error();
      }

      // Check if user has other auth methods
      const user = await fastify.mikro.user.findOneOrFail(
        { id: userSession.id },
        { populate: ['password_hash'] },
      );
      const hasLinkedOAuth =
        (await fastify.mikro.userOAuth.count({ user: { id: user.id } })) > 0;
      const hasOtherAuthMethods = user.hasPassword() || hasLinkedOAuth;

      // Check if 2FA is required
      const secondFactorRequired =
        fastify.config.auth.password.second_factor.required;

      // Check if user has other 2FA method (TOTP)
      const totpEnabled = await fastify.mikro.userTotp.isRegistered(
        userSession.id,
      );

      // Delete passkey
      await fastify.passkeyService.deletePasskey(
        userSession.id,
        req.params.id,
        {
          hasOtherAuthMethods,
          secondFactorRequired,
          hasOtherSecondFactor: totpEnabled,
        },
      );

      return res.status(200).send({
        ok: true,
      });
    },
  });
};
