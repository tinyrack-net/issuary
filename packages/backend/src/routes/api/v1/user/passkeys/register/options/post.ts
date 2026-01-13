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
      summary: 'Get Passkey Registration Options',
      description:
        'Generate WebAuthn registration options for registering a new passkey',
      tags: [TAGS.USER],
      response: {
        200: r.PasskeyRegistrationOptionsResponse,
        400: e.PasskeyNotEnabled.Schema,
        401: e.Unauthorized.Schema,
      },
    },
    handler: async (req, res) => {
      // Check if passkey is enabled
      if (!fastify.passkeyService.isEnabled()) {
        throw new e.PasskeyNotEnabled.Error();
      }

      const userSession = await req.auth.verify();

      // Get user entity for registration
      const user = await fastify.mikro.user.findOneOrFail({
        id: userSession.id,
      });

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
