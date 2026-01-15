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
        200: r.UserSessionResponse,
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

      // Clear the challenge immediately to prevent replay
      req.session.set('passkey_challenge', undefined);

      // Extract and cast the validated response
      // The Zod schema validates the structure, but we need to cast for
      // @simplewebauthn compatibility since it expects its own interface type
      const authResponse = req.body
        .response as unknown as AuthenticationResponseJSON;

      const user = await fastify.passkeyService.verifyAuthentication(
        authResponse,
        challenge,
      );

      // Get user session info
      const sessionUser = await fastify.userService.verifyUserById(user.id);

      // Set user session
      req.session.set('user', {
        id: user.id,
      });
      // Set authentication metadata for OIDC claims (auth_time, amr, acr)
      req.session.set('authenticated_at', Math.floor(Date.now() / 1000));
      req.session.set('auth_methods', ['hwk']); // Hardware key (passkey)
      req.session.set('acr', 'urn:tinyrack:acr:1'); // Single factor (passkey)

      // Check if TOTP is required (only for database-managed users)
      const passwordAuthMethod =
        fastify.config.basic_authentication_methods.password;
      const isConfigManaged = sessionUser.managed_by === 'config';

      const totpRequired =
        !isConfigManaged &&
        (passwordAuthMethod.totp?.required ?? false) &&
        !sessionUser.totp_enabled;

      return res.status(200).send({
        user: {
          id: sessionUser.id,
          managed_by: sessionUser.managed_by,
          email: sessionUser.email,
          email_verified: sessionUser.email_verified,
          has_password: sessionUser.has_password,
          totp_enabled: sessionUser.totp_enabled,
          totp_required: totpRequired,
          passkey_count: sessionUser.passkey_count,
        },
      });
    },
  });
};
