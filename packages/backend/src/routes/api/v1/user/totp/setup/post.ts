import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/totp/setup
 *
 * Start TOTP setup for the current user.
 * Generates a new secret and returns QR code for authenticator app.
 * Accepts both full user session and pending 2FA setup session.
 */
export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.auth.password.totp?.enabled) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Start TOTP Setup',
      description:
        'Generate a new TOTP secret and QR code for authenticator app setup. ' +
        'Call verify endpoint after user scans the QR code to complete setup.',
      tags: [TAGS.USER],
      response: {
        200: r.TotpSetupResponse,
        401: e.Unauthorized.Schema,
        403: e.SecondFactorNotAllowedForConfigUser.Schema,
        409: e.TotpAlreadyEnabled.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = req.session.get('user');
      const pending2FASetup = req.session.get('pending2FASetup');
      const userId = userSession?.id ?? pending2FASetup?.id;

      if (!userId) {
        throw new e.Unauthorized.Error();
      }

      const user = await fastify.mikro.user.findOneOrFail(
        { id: userId },
        { failHandler: () => new e.UserNotFound.Error() },
      );

      // Config users cannot setup 2FA
      if (user.managed_by === 'config') {
        throw new e.SecondFactorNotAllowedForConfigUser.Error();
      }

      const setupData = await fastify.totpService.startSetup(user);

      return res.status(200).send({
        secret: setupData.secret,
        otpauth_url: setupData.otpauthUrl,
        qr_code: setupData.qrCodeDataUrl,
      });
    },
  });
};
