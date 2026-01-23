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
      summary: 'Get Passkey Authentication Options',
      description:
        'Generate WebAuthn authentication options for passkey login. ' +
        'Supports both passwordless login and 2FA. ' +
        'If a pending 2FA session exists, returns options for that user only.',
      tags: [TAGS.AUTH],
      response: {
        200: r.PasskeyAuthenticationOptionsResponse,
        400: e.PasskeyNotEnabled.Schema,
      },
    },
    handler: async (req, res) => {
      const pending2FAUser = req.session.get('pending2FAUser');

      const options =
        await fastify.passkeyService.generateAuthenticationOptions(
          pending2FAUser?.id,
        );

      req.session.set('passkey_challenge', options.challenge);

      return res.status(200).send({
        options,
      });
    },
  });
};
