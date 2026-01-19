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
      description: 'Verify WebAuthn authentication response and create session',
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
        404: e.PasskeyNotFound.Schema,
      },
    },
    handler: async (req, res) => {
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

      const user = await fastify.passkeyService.verifyAuthentication(
        authResponse,
        challenge,
      );

      const sessionUser = await fastify.userService.verifyUserById(user.id);

      req.session.set('user', {
        id: user.id,
        authenticated_at: Math.floor(Date.now() / 1000),
      });

      return res.status(200).send({
        status: 'authenticated',
        user: {
          id: sessionUser.id,
          managed_by: sessionUser.managed_by,
          email: sessionUser.email,
          email_verified: sessionUser.email_verified,
          has_password: sessionUser.has_password,
          totp_enabled: sessionUser.totp_enabled,
          second_factor_required: sessionUser.second_factor_required,
          passkey_count: sessionUser.passkey_count,
        },
      });
    },
  });
};
