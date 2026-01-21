import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.basic_authentication_methods.passkey.enabled) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify Passkey 2FA',
      description:
        'Complete login by verifying passkey as second factor. Requires pending 2FA session from password login.',
      tags: [TAGS.AUTH],
      body: z.object({
        response: r.AuthenticationResponseJSON,
      }),
      response: {
        200: r.AuthResponse,
        400: z.union([
          e.PasskeyNotEnabled.Schema,
          e.PasskeyChallengeNotFound.Schema,
          e.PasskeyVerificationFailed.Schema,
        ]),
        401: e.SecondFactorSessionExpired.Schema,
        403: e.PasskeyUserMismatch.Schema,
        404: e.PasskeyNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const pending2FAUser = req.session.get('pending2FAUser');

      if (!pending2FAUser) {
        throw new e.SecondFactorSessionExpired.Error();
      }

      const challenge = req.session.get('passkey_challenge');

      if (!challenge) {
        throw new e.PasskeyChallengeNotFound.Error();
      }

      req.session.set('passkey_challenge', undefined);

      const authResponse = req.body.response as AuthenticationResponseJSON;

      const passkeyUser = await fastify.passkeyService.verifyAuthentication(
        authResponse,
        challenge,
      );

      // Verify the passkey belongs to the pending 2FA user
      if (passkeyUser.id !== pending2FAUser.id) {
        throw new e.PasskeyUserMismatch.Error();
      }

      const user = await fastify.userService.verifyUserById(passkeyUser.id);

      // Clear pending session and create full session
      req.session.set('pending2FAUser', undefined);

      const authTime =
        pending2FAUser.authenticated_at ?? Math.floor(Date.now() / 1000);

      req.session.set('user', {
        id: user.id,
        authenticated_at: authTime,
      });

      return res.status(200).send({
        user,
      });
    },
  });
};
