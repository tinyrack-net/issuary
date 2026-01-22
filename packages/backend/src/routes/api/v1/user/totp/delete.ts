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
        400: z.union([e.TotpNotEnabled.Schema, e.InvalidTotpCode.Schema]),
        401: e.Unauthorized.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();
      await fastify.totpService.disable(userSession.id, req.body.code);

      return res.status(200).send({ ok: true });
    },
  });
