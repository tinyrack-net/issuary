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
      summary: 'Get Passkey 2FA Options',
      description:
        'Generate WebAuthn authentication options for passkey 2FA. Requires pending 2FA session from password login.',
      tags: [TAGS.AUTH],
      response: {
        200: r.PasskeyAuthenticationOptionsResponse,
        400: e.PasskeyNotEnabled.Schema,
        401: e.SecondFactorSessionExpired.Schema,
      },
    },
    handler: async (req, res) => {
      const pending2FAUser = req.session.get('pending2FAUser');

      if (!pending2FAUser) {
        throw new e.SecondFactorSessionExpired.Error();
      }

      // Generate options for the specific user's passkeys only
      const options =
        await fastify.passkeyService.generateAuthenticationOptions(
          pending2FAUser.id,
        );

      req.session.set('passkey_challenge', options.challenge);

      return res.status(200).send({
        options,
      });
    },
  });
};
