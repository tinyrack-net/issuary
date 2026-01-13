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
      description: 'Generate WebAuthn authentication options for passkey login',
      tags: [TAGS.AUTH],
      response: {
        200: r.PasskeyAuthenticationOptionsResponse,
        400: e.PasskeyNotEnabled.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if passkey is enabled
      if (!fastify.passkeyService.isEnabled()) {
        throw new e.PasskeyNotEnabled.Error();
      }

      // Generate authentication options (usernameless - allow any discoverable credential)
      const options =
        await fastify.passkeyService.generateAuthenticationOptions();

      // Store challenge in session
      req.session.set('passkey_challenge', options.challenge);

      return res.status(200).send({
        options,
      });
    },
  });
};
