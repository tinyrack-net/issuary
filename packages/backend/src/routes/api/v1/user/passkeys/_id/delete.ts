import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'DELETE',
    url: '',
    schema: {
      summary: 'Delete Passkey',
      description: 'Delete a passkey by ID',
      tags: [TAGS.USER],
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: r.SuccessResponse,
        400: z.union([
          e.PasskeyNotEnabled.Schema,
          e.CannotRemoveLastPasskey.Schema,
        ]),
        401: e.Unauthorized.Schema,
        404: e.PasskeyNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if passkey is enabled
      if (!fastify.passkeyService.isEnabled(fastify.config)) {
        throw new e.PasskeyNotEnabled.Error();
      }

      const userSession = await req.auth.verify();

      // Check if user has other auth methods
      const user = await fastify.mikro.user.findOneOrFail(
        { id: userSession.id },
        { populate: ['password_hash'] },
      );
      const hasLinkedOAuth =
        (await fastify.mikro.userOAuth.count({ user: { id: user.id } })) > 0;
      const hasOtherAuthMethods = user.hasPassword() || hasLinkedOAuth;

      // Delete passkey
      await fastify.passkeyService.deletePasskey(
        userSession.id,
        req.params.id,
        hasOtherAuthMethods,
      );

      return res.status(200).send({
        success: true,
      });
    },
  });
