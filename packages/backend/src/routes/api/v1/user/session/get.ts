import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get Session',
      description: 'Get Session',
      tags: [TAGS.USER],
      response: {
        200: r.UserSessionNullableResponse,
      },
    },
    handler: async (req, res) => {
      try {
        const user = await req.auth.verify();

        // Check if TOTP or Passkey is required (only for database-managed users)
        const passwordAuthMethod =
          fastify.config.authentication_methods?.['password'];
        const isConfigManaged = user.managed === 'config';

        const totpRequired =
          !isConfigManaged &&
          passwordAuthMethod?.type === 'password' &&
          (passwordAuthMethod.totp?.required ?? false) &&
          !user.totp_enabled;

        const passkeyRequired =
          !isConfigManaged &&
          passwordAuthMethod?.type === 'password' &&
          (passwordAuthMethod.passkey?.required ?? false) &&
          user.passkey_count === 0;

        return res.status(200).send({
          user: {
            id: user.id,
            managed: user.managed,
            email: user.email,
            email_verified: user.email_verified,
            has_password: user.has_password,
            totp_enabled: user.totp_enabled,
            totp_required: totpRequired,
            passkey_count: user.passkey_count,
            passkey_required: passkeyRequired,
          },
        });
      } catch {
        return res.status(200).send({
          user: null,
        });
      }
    },
  });
