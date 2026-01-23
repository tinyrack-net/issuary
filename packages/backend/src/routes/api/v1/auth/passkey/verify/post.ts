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
      summary: 'Verify Passkey Authentication',
      description:
        'Verify WebAuthn authentication response and create session. ' +
        'Supports both passwordless login and 2FA. ' +
        'If a pending 2FA session exists, verifies the passkey belongs to ' +
        'that user and completes the 2FA flow.',
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
        403: e.PasskeyUserMismatch.Schema,
        404: e.PasskeyNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const pending2FAUser = req.session.get('pending2FAUser');

      // Get challenge from session
      const challenge = req.session.get('passkey_challenge');

      if (!challenge) {
        throw new e.PasskeyChallengeNotFound.Error();
      }

      req.session.set('passkey_challenge', undefined);

      // Extract and cast the validated response
      // The Zod schema validates the structure, but we need to cast for
      // @simplewebauthn compatibility since it expects its own interface type
      const authResponse = req.body.response as AuthenticationResponseJSON;

      const passkeyUser = await fastify.passkeyService.verifyAuthentication(
        authResponse,
        challenge,
      );

      if (pending2FAUser && passkeyUser.id !== pending2FAUser.id) {
        throw new e.PasskeyUserMismatch.Error();
      }

      const userEntity = await fastify.mikro.user.verifyById(passkeyUser.id);
      const sessionUser =
        await fastify.userService.userEntityToSessionUser(userEntity);

      if (pending2FAUser) {
        req.session.set('pending2FAUser', undefined);
        req.session.set('pending2FASetup', undefined);
      }

      const authTime =
        pending2FAUser?.authenticated_at ?? Math.floor(Date.now() / 1000);

      req.session.set('user', {
        id: passkeyUser.id,
        authenticated_at: authTime,
      });

      return res.status(200).send({
        user: sessionUser,
      });
    },
  });
};
