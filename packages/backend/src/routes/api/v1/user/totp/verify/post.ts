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
 * Accepts both full user session and pending 2FA setup session.
 * If from pending setup session, converts to full user session.
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
        200: r.TotpSetupVerifyResponse,
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

      await fastify.totpService.verifySetup(userId, req.body.code);

      // Check if this was from pending setup session
      const wasPendingSetup = !!pending2FASetup;

      if (wasPendingSetup) {
        // Clear pending setup session and create full user session
        req.session.set('pending2FASetup', undefined);
        req.session.set('user', {
          id: userId,
          authenticated_at: Math.floor(Date.now() / 1000),
          auth_methods: ['pwd', 'otp', 'mfa'],
          acr: 'urn:tinyrack:acr:2',
        });

        // Get user data for response
        const user = await fastify.userService.verifyUserById(userId);

        return res.status(200).send({
          success: true,
          user,
          second_factor_setup_completed: true,
        });
      }

      return res.status(200).send({
        success: true,
        second_factor_setup_completed: false,
      });
    },
  });
