import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * POST /api/v1/user/passkeys/register/verify
 *
 * Verify and complete passkey registration.
 * Accepts both full user session and pending 2FA setup session.
 * If from pending setup session, converts to full user session.
 */
export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.basic_authentication_methods.passkey.enabled) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify Passkey Registration',
      description:
        'Verify and complete passkey registration. ' +
        'Accepts both full user session and pending 2FA setup session.',
      tags: [TAGS.USER],
      body: r.PasskeyRegistrationBody,
      response: {
        200: r.PasskeySetupVerifyResponse,
        400: e.PasskeyNotEnabled.Schema.or(
          e.PasskeyChallengeNotFound.Schema,
        ).or(e.PasskeyVerificationFailed.Schema),
        401: e.Unauthorized.Schema,
        409: e.PasskeyAlreadyExists.Schema,
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

      // Get challenge from session
      const challenge = req.session.get('passkey_challenge');
      if (!challenge) {
        throw new e.PasskeyChallengeNotFound.Error();
      }

      // Get user entity
      const user = await fastify.mikro.user.findOneOrFail({
        id: userId,
      });

      // The validated body already conforms to RegistrationResponseJSON structure
      // Use type assertion since Zod validation guarantees the structure
      const registrationResponse = req.body
        .response as unknown as RegistrationResponseJSON;

      // Verify registration
      await fastify.passkeyService.verifyRegistration(
        user,
        registrationResponse,
        challenge,
        req.body.name,
      );

      // Clear challenge from session
      req.session.set('passkey_challenge', undefined);

      // Check if this was from pending 2FA setup session
      const wasPendingSetup = !!pending2FASetup;

      if (wasPendingSetup) {
        // Clear pending setup sessions and create full user session
        req.session.set('pending2FASetup', undefined);
        req.session.set('user', {
          id: userId,
          authenticated_at: Math.floor(Date.now() / 1000),
        });

        // Get user data for response
        const userEntity = await fastify.mikro.user.verifyById(userId);
        const userSessionData =
          await fastify.userService.userEntityToSessionUser(userEntity);

        return res.status(200).send({
          success: true,
          user: userSessionData,
          second_factor_setup_completed: true,
        });
      }

      return res.status(200).send({
        success: true,
        second_factor_setup_completed: false,
      });
    },
  });
};
