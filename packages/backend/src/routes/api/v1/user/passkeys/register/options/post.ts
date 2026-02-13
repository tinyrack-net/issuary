import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/passkeys/register/options
 *
 * Generate WebAuthn registration options for registering a new passkey.
 * Accepts both full user session and pending 2FA setup session.
 */
export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.auth.passkey.enabled) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '/user/passkeys/register/options',
    schema: {
      summary: 'Get Passkey Registration Options',
      description:
        'Generate WebAuthn registration options for registering a new passkey. ' +
        'Accepts both full user session and pending 2FA setup session.',
      tags: [TAGS.USER],
      response: {
        200: r.PasskeyRegistrationOptionsResponse,
        400: e.PasskeyNotEnabled.Schema,
        401: e.Unauthorized.Schema,
        403: e.SecondFactorNotAllowedForConfigUser.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = req.session.get('user');
      const pending2FASetup = req.session.get('pending2FASetup');
      const userId = userSession?.id ?? pending2FASetup?.id;

      if (!userId) {
        throw new e.Unauthorized.Error();
      }

      // Get user entity for registration
      const user = await fastify.mikro.user.findOneOrFail(
        {
          id: userId,
        },
        {
          failHandler: () => new e.UserNotFound.Error(),
        },
      );

      // Config users cannot setup 2FA
      if (user.managed_by === 'config') {
        throw new e.SecondFactorNotAllowedForConfigUser.Error();
      }

      // Generate registration options
      const options =
        await fastify.passkeyService.generateRegistrationOptions(user);

      // Store challenge in session
      req.session.set('passkey_challenge', options.challenge);

      return res.status(200).send({
        options,
      });
    },
  });
};
