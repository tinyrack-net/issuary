import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/totp/confirm
 *
 * Confirm TOTP setup after user acknowledges saving recovery codes.
 * This completes the TOTP setup process.
 * Accepts both full user session and pending 2FA setup session.
 * If from pending setup session, converts to full user session.
 */
export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'POST',
    url: '/user/totp/confirm',
    schema: {
      summary: 'Confirm TOTP Setup',
      description:
        'Confirm that recovery codes have been saved to complete TOTP setup. ' +
        'Must call verify endpoint first to get recovery codes. ' +
        'This endpoint completes the TOTP setup and enables 2FA.',
      tags: [TAGS.USER],
      body: z.object({}).optional().nullable(),
      response: {
        200: r.UserSessionResponse,
        400: e.TotpNotSetup.Schema,
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

      await fastify.totpService.confirmSetup(userId);

      // Convert pending 2FA setup session to full user session
      if (pending2FASetup) {
        req.setUserSession(userId);
      }

      const userEntity = await fastify.mikro.user.verifyById(userId);
      const user =
        await fastify.userService.userEntityToSessionUser(userEntity);

      return res.status(200).send({
        user,
      });
    },
  });
