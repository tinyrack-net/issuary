import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import type { AuthenticationMethod } from '@/plugins/secure-session.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (
    !fastify.config.basic_authentication_methods.password.enabled ||
    !fastify.config.basic_authentication_methods.password.totp.enabled
  ) {
    return;
  }
  fastify.route({
    method: 'POST',
    url: '',
    schema: {
      summary: 'Verify TOTP for login',
      description:
        'Complete login by verifying TOTP code. Requires pending 2FA session from password login.',
      tags: [TAGS.AUTH],
      body: z.object({
        code: f.totpCode,
      }),
      response: {
        200: r.UserSessionResponse,
        400: z.union([e.ValidationError.Schema, e.InvalidTotpCode.Schema]),
        401: e.SecondFactorSessionExpired.Schema,
      },
    },
    handler: async (req, res) => {
      const pending2FAUser = req.session.get('pending2FAUser');

      if (!pending2FAUser) {
        throw new e.SecondFactorSessionExpired.Error();
      }

      await fastify.totpService.verifyForAuth(pending2FAUser.id, req.body.code);

      const user = await fastify.userService.verifyUserById(pending2FAUser.id);
      req.session.set('pending2FAUser', undefined);

      const authTime =
        pending2FAUser.authenticated_at ?? Math.floor(Date.now() / 1000);

      const authMethods: AuthenticationMethod[] = [
        ...pending2FAUser.auth_methods,
        'otp',
        'mfa',
      ];

      req.session.set('user', {
        id: user.id,
        authenticated_at: authTime,
        auth_methods: authMethods,
        acr: 'urn:tinyrack:acr:2',
      });

      return res.status(200).send({
        user,
      });
    },
  });
};
