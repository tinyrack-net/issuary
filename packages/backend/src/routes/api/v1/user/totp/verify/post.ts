import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/totp/verify
 *
 * Verify TOTP code during setup.
 * This endpoint verifies the code from user's authenticator app
 * and returns recovery codes. The user must confirm the recovery codes
 * via the confirm endpoint to complete the TOTP setup.
 * Accepts both full user session and pending 2FA setup session.
 * Does NOT convert session - that happens in the confirm endpoint.
 */
export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '/user/totp/verify',
    schema: {
      summary: 'Verify TOTP Setup',
      description:
        'Verify the TOTP code from authenticator app. ' +
        'Must call setup endpoint first to get the QR code. ' +
        'Returns one-time recovery codes. Call confirm endpoint after ' +
        'user acknowledges saving the recovery codes to complete setup.',
      tags: [TAGS.USER],
      body: z.object({
        code: f.totpCode,
      }),
      response: {
        200: r.RecoveryCodesResponse,
        400: z.union([e.TotpNotSetup.Schema, e.InvalidTotpCode.Schema]),
        401: e.Unauthorized.Schema,
        409: e.TotpAlreadyEnabled.Schema,
      },
    },
    handler: async (req, res) => {
      // Allow both full user session and pending 2FA setup session
      const userSession = req.session.get('user');
      const pending2FASetup = req.session.get('pending2FASetup');
      const userId = userSession?.id ?? pending2FASetup?.id;

      if (!userId) {
        throw new e.Unauthorized.Error();
      }

      const recoveryCodes = await fastify.totpService.verifySetup(
        userId,
        req.body.code,
      );

      // Do NOT convert session here - that happens in the confirm endpoint
      // after user acknowledges saving the recovery codes

      return res.status(200).send({
        recovery_codes: recoveryCodes,
      });
    },
  });
