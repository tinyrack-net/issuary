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
        return res.status(200).send({
          user: {
            id: user.id,
            managed: user.managed,
            email: user.email,
            email_verified: user.email_verified,
            has_password: user.has_password,
            totp_enabled: user.totp_enabled,
            totp_required: user.totp_required,
            passkey_count: user.passkey_count,
          },
        });
      } catch {
        return res.status(200).send({
          user: null,
        });
      }
    },
  });
