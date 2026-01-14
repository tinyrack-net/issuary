import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/totp/setup
 *
 * Start TOTP setup for the current user.
 * Generates a new secret and returns QR code for authenticator app.
 * Accepts both full user session and pending TOTP setup session.
 */
export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.basic_authentication_methods.password.totp?.enabled) {
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
        409: e.TotpAlreadyEnabled.Schema,
      },
    },
    handler: async (req, res) => {
      // Allow both full user session and pending TOTP setup session
      const userSession = req.session.get('user');
      const pendingTotpSetup = req.session.get('pendingTotpSetup');
      const userId = userSession?.id ?? pendingTotpSetup?.id;

      if (!userId) {
        throw new e.Unauthorized.Error();
      }

      console.log(userId);
      // Get user entity
      const user = await fastify.mikro.user.findOneOrFail(
        { id: userId },
        { failHandler: () => new e.UserNotFound.Error() },
      );

      const setupData = await fastify.totpService.startSetup(user);

      return res.status(200).send({
        secret: setupData.secret,
        otpauth_url: setupData.otpauthUrl,
        qr_code: setupData.qrCodeDataUrl,
      });
    },
  });
};
