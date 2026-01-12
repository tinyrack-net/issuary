import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/totp/verify
 *
 * Verify TOTP code and complete setup.
 * This endpoint verifies the code from user's authenticator app
 * and activates TOTP for the account.
 */
export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify TOTP Setup',
      description:
        'Verify the TOTP code from authenticator app to complete setup. ' +
        'Must call setup endpoint first to get the QR code.',
      tags: [TAGS.USER],
      body: z.object({
        code: f.totpCode,
      }),
      response: {
        200: r.SuccessResponse,
        400: z.union([e.TotpNotSetup.Schema, e.InvalidTotpCode.Schema]),
        401: e.Unauthorized.Schema,
        409: e.TotpAlreadyEnabled.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      await fastify.totpService.verifySetup(userSession.id, req.body.code);

      return res.status(200).send({ success: true });
    },
  });
